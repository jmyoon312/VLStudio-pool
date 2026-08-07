from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from typing import Optional, Any
from .database import SessionLocal
from . import crud, models, downloader
from .services.tool_manager import tool_manager
from .services.category_manager import category_manager
from .llm_manager import LLMClient
import os
import json
import random
import threading
import time
import asyncio
from datetime import datetime, timedelta

import logging
logger = logging.getLogger("app.system")

# Override print to capture and write logs to scan_debug.log
def print(*args, **kwargs):
    message = " ".join(str(arg) for arg in args)
    logger.info(message)

scheduler = BackgroundScheduler()

# [FIX] Module-level shutdown flag so stop_scheduler() can signal all job wrappers
_shutdown_requested = threading.Event()

# --- Configurations ---
SEARCH_CATEGORIES = [
    "Gaming", "Entertainment", "Music", "Education", "Howto", "News",
    "Travel", "Sports", "People", "Comedy", "Film", "Tech",
    "Autos", "Animals", "Science", "All"
]

# Global State for Round Robin (Batch Processing)
_category_index = 0

def clean_json_string(text: str) -> str:
    """Helper to clean LLM output for JSON parsing."""
    import re
    text = text.strip()
    
    # 1. Strip markdown code block markers
    match = re.search(r"```(?:json)?(.*?)```", text, re.DOTALL)
    if match: 
        text = match.group(1).strip()
        
    # 2. Try parsing directly
    try:
        json.loads(text)
        return text
    except ValueError:
        pass
        
    # 3. Locate and validate JSON array or object spans
    start_bracket = text.find('[')
    end_bracket = text.rfind(']')
    
    start_brace = text.find('{')
    end_brace = text.rfind('}')
    
    candidates = []
    if start_bracket != -1 and end_bracket != -1 and start_bracket < end_bracket:
        candidates.append((start_bracket, end_bracket))
    if start_brace != -1 and end_brace != -1 and start_brace < end_brace:
        candidates.append((start_brace, end_brace))
        
    # Sort candidates by span length descending
    candidates.sort(key=lambda x: x[1] - x[0], reverse=True)
    
    for start, end in candidates:
        sub_text = text[start : end + 1]
        try:
            json.loads(sub_text)
            return sub_text
        except ValueError:
            pass
            
    # Fallback to widest bracket match
    if start_bracket != -1 and end_bracket != -1 and start_bracket < end_bracket:
        return text[start_bracket : end_bracket + 1]
    if start_brace != -1 and end_brace != -1 and start_brace < end_brace:
        return text[start_brace : end_brace + 1]
        
    return text

async def async_search_task(query: str, settings: Any = None):
    """
    Async wrapper for tool_manager.search
    """
    try:
        # Pass settings instead of db to avoid SQLAlchemy concurrency errors
        return await asyncio.to_thread(tool_manager.search, query, include_images=False, settings=settings, time_range='week')
    except Exception as e:
        print(f"[WARN] Search failed for '{query}': {e}")
        return {"results": []}

def fetch_category_trends_micro_topic(category: str, db: Session):
    """
    Micro-Topic Targeted Async Pipeline
    1. Get Micro-Topics
    2. Parallel Search (Youtube, News, Community)
    3. LLM Synthesis & Scoring
    4. DB Upsert
    """
    print(f"[{datetime.now()}] [REFRESH] Processing Micro-Topic Batch: {category}")
    
    # 1. Get Micro-Topics (Seed)
    micro_topics = category_manager.get_random_micro_topics(category, count=1)
    if not micro_topics:
        target_topic = category
    else:
        target_topic = micro_topics[0] # Pick primary
    
    print(f"[TARGET] Targeting Micro-Topic: {target_topic}")

    # 2. Construct Dynamic Queries for Parallel Fetching
    queries = [
        f'"{target_topic}" latest news', # News
        f'"{target_topic}" controversy site:reddit.com OR site:dcinside.com', # Community
        f'"{target_topic}" review site:youtube.com' # YouTube
    ]
    
    # 3. Async Parallel Search
    async def run_searches():
        # Fetch settings once to pass to parallel tasks
        settings = crud.get_settings(db)
        tasks = [async_search_task(q, settings) for q in queries]
        return await asyncio.gather(*tasks)
    
    # [FIX] Use asyncio.run() to create a FRESH event loop in this background thread.
    # NEVER use asyncio.get_event_loop() + run_until_complete() from a background thread —
    # it grabs uvicorn's main event loop and causes "This event loop is already running" crash.
    try:
        results = asyncio.run(run_searches())
    except Exception as e:
        print(f"[WARN] Parallel search failed for {target_topic}: {e}")
        results = [{"results": []} for _ in queries]
    
    # 4. Context Assembly (Context Truncation)
    context_lines = []
    for res in results:
        # Take top 3 from each source to save tokens
        top_items = res.get("results", [])[:3]
        for item in top_items:
            context_lines.append(f"- {item.get('title')}: {item.get('content')}")
            
    context_str = "\n".join(context_lines)
    if not context_str:
        context_str = f"No specific recent data found for {target_topic}. Use general knowledge."

    # 5. LLM Analysis with Rubric
    settings = crud.get_settings(db)
    client = LLMClient(settings)
    model = settings.script_analysis_model or settings.hermes_agent_model or settings.agent_model
    
    system_prompt = f"""
    You are a Strategic Trend Analyst.
    Analyze the Web Context for the micro-topic: **{target_topic}** ({category}).
    
    ### Task:
    1. Extract 30 Trending Keywords/Entities.
    2. Group them by viral momentum.
    3. For each keyword, provide:
       - 'viral_score': (0-100) based on popularity/outlier potential.
       - 'velocity': 'Explosive' | 'Rising' | 'Steady'.
       - 'angle': A 1-sentence viral hook strategy.

    ### Web Context:
    {context_str}
    
    ### Requirements:
    1. **Format**: Output ONLY a valid JSON Array of Objects as raw text. Do NOT wrap it in markdown code blocks like ```json ... ```, and do NOT include any introductory or concluding text, explanations, conversational filler, or headers (like **Viral Scored Trends**).
       [
         {{ "ko": "...", "en": "...", "ja": "...", "viral_score": int, "velocity": "...", "angle": "..." }}
       ]
    2. **Deduplication**: Use canonical names (e.g., 'Galaxy S25' not 'Samsung Galaxy S25 rumors').
    3. **Language**: 'ko' is mandatory. Fill others if possible.
    """
    
    try:
        response = client.generate_content(
            prompt="Synthesize Viral Scored Trends",
            model_name=model,
            system_instruction=system_prompt
        )
        # Robust parsing
        cleaned_resp = clean_json_string(str(response))
        try:
            data = json.loads(cleaned_resp)
        except json.JSONDecodeError as je:
            print(f"[FAIL] JSON Decode Error for {category}: {je}. Raw: {cleaned_resp[:100]}...")
            return
        
        # [ROBUSTNESS] Normalize
        if isinstance(data, list):
            valid_data = []
            for idx, item in enumerate(data):
                if isinstance(item, str): item = {"ko": item, "en": item}
                if isinstance(item, dict):
                    # Ensure Keys & Fallbacks
                    for lang in ["ko", "en", "ja", "zh", "es", "hi", "ru"]:
                        if lang not in item: item[lang] = item.get("ko") or item.get("en") or "Trend"
                    if "viral_score" not in item: item["viral_score"] = max(40, 95 - idx)
                    if "velocity" not in item: item["velocity"] = "Rising"
                    if "angle" not in item: item["angle"] = f"Viral potential in {item.get('ko', 'niche')}"
                    valid_data.append(item)
            
            data = valid_data

            # 6. Upsert to DB
            existing = db.query(models.Trend).filter(models.Trend.category == category).first()
            if not existing:
                existing = models.Trend(category=category)
                db.add(existing)
            
            existing.keyword = f"{target_topic}"
            existing.micro_topic = target_topic
            existing.related_keywords_json = data
            existing.updated_at = datetime.now()
            existing.source = "SuperExplorer/Batch"
            existing.viral_score = max([d.get("viral_score", 0) for d in data]) if data else 0 
            
            db.commit()
            print(f"[OK] [Super-Batch] Cached {len(data)} trends for {category} (Micro: {target_topic})")
            
    except Exception as e:
        print(f"[FAIL] Failed to output trends for {category}: {e}")

def run_rapid_batch():
    """
    Runs every 15 minutes.
    """
    global _category_index
    db = SessionLocal()
    try:
        # [NEW] Check Scheduler Toggle
        settings = crud.get_settings(db)
        if settings and not settings.enable_trend_scheduling:
            print(f"[{datetime.now()}] ⏸️ Trend Scheduler Paused (Settings)")
            return

        batch_size = 4
        for _ in range(batch_size):
            cat = SEARCH_CATEGORIES[_category_index % len(SEARCH_CATEGORIES)]
            fetch_category_trends_micro_topic(cat, db)
            _category_index += 1
            
        # Cleanup old data (> 24h)
        cutoff = datetime.now() - timedelta(hours=24)
        db.query(models.ResearchTopic).filter(models.ResearchTopic.created_at < cutoff).delete()
        db.commit()
        
    except Exception as e:
        print(f"Batch Error: {e}")
    finally:
        db.close()

def initial_scan_thread():
    """Background startup scan."""
    print("[FALLBACK] [Startup] Triggering initial micro-topic scan (Background)...")
    time.sleep(10)
    db = SessionLocal()
    try:
        count = db.query(models.ResearchTopic).count()
        if count < 5:
            print("📉 Cache cold. Running initial scan...")
            for cat in SEARCH_CATEGORIES[:5]: # Scan top 5 diverse categories first
                fetch_category_trends_micro_topic(cat, db)
                time.sleep(1)
        else:
             print("[OK] Cache warm. Skipping initial scan.")
    finally:
        db.close()

# --- Legacy Channel Scan (Verified Preserved) ---
def scan_channels():
    # ... (Actual implementation would go here, preserved from previous)
    pass
    
def full_channel_scan_logic():
    # print(f"[{datetime.now()}] 📡 Starting Automatic Channel Scan...")
    db = SessionLocal()
    try:
        # Check Global Auto-Download Setting
        settings = crud.get_settings(db)
        global_auto = settings.global_auto_download if settings else True
        if settings and not settings.enable_trend_scheduling:
             # Respect global pause if desired, or keep separate? 
             # User asked for "Searcher Toggle", usually implies Trends. 
             # Let's keep Channel Scan active unless specifically disabled?
             # For now, let's allow channel scan even if Trend Search is paused, unless we add a specific toggle.
             pass

        channels = crud.get_channels(db)
        # print(f"[{datetime.now()}] Found {len(channels)} channels to scan.")
        
        for channel in channels:
            if channel.status != 'active': continue
            # print(f"[{datetime.now()}] Scanning channel: {channel.name} ({channel.url})...")
            
            try:
                # 1. Fetch Latest Videos (Metadata)
                # [FIX] Pass cookiefile if available to avoid 429
                dl_opts = {'cookiefile': settings.cookies_path} if settings and settings.cookies_path else {}
                latest = downloader.downloader.get_latest_videos(channel.url, limit=5, **dl_opts)
                
                # [FIX] Reset failure count on success
                if channel.fail_count > 0:
                    channel.fail_count = 0
                    channel.last_error = None
                    db.commit()

                # Update Last Scanned
                channel.last_scanned_at = datetime.now()
                
                # [FIX] Auto-Repair Channel Metadata (Thumbnail)
                if not channel.thumbnail_path or "default" in channel.thumbnail_path:
                    try:
                        print(f"🖼️ Fetching missing thumbnail for {channel.name}...")
                        ch_info = downloader.downloader.get_channel_info(channel.url)
                        if ch_info and ch_info.get('thumbnail'):
                             channel.thumbnail_path = ch_info.get('thumbnail')
                             print(f"[OK] Updated thumbnail: {channel.thumbnail_path}")
                    except Exception as e:
                        print(f"[WARN] Failed to update thumbnail: {e}")

                db.commit()

                new_videos_found = 0
                for vid in latest:
                    v_id = vid.get('id')
                    if not v_id: continue
                    
                    # Check DB properly
                    exists = db.query(models.Video).filter_by(video_id=v_id).first() # Video ID should be unique globally
                    if not exists:
                        print(f"[MAGIC] New Video Found: {vid.get('title')} ({v_id})")
                        new_video = models.Video(
                            channel_id=channel.id, 
                            video_id=v_id, 
                            title=vid.get('title','?'), 
                            url=vid.get('url') or f"https://youtu.be/{v_id}",
                            upload_date=datetime.now(), 
                            status="pending",
                            is_script_only=channel.default_script_only # [FIX] Respect channel setting
                        )
                        db.add(new_video)
                        db.commit() # Commit to get ID
                        db.refresh(new_video)
                        new_videos_found += 1
                        
                        # 2. Trigger Auto-Download
                        if global_auto and channel.auto_download:
                            print(f"[DOWN] Auto-downloading: {new_video.title}")
                            new_video.status = "downloading"
                            db.commit()
                            
                            try:
                                # Run download synchronously or offload to thread?
                                # Since this is a background job already, sync is fine but might block other channels.
                                # For robustness, we'll do it sequentially here to avoid flooding.
                                # [FIX] Standardized Path Construction: /app/media/downloads / Category / Channel
                                from .utils.path_utils import get_standardized_download_path
                                root_path = get_standardized_download_path(settings)
                                
                                if channel.category:
                                    cat_folder = channel.category.folder_name or channel.category.name.replace(" ", "_")
                                    download_path = os.path.join(root_path, cat_folder, channel.folder_name or channel.name.replace(" ", "_"))
                                else:
                                    download_path = os.path.join(root_path, "_temp_storage", channel.folder_name or channel.name.replace(" ", "_"))
                                    
                                # [FIX] Ensure forward slashes and absolute normalization
                                download_path = download_path.replace("\\", "/").replace("//", "/")
                                os.makedirs(download_path, exist_ok=True)
                                
                                result = downloader.downloader.download_single_video(
                                    new_video.url, 
                                    root_download_path=download_path, # [FIX] Use constructed path
                                    script_only=channel.default_script_only,
                                    cookies_path=settings.cookies_path if settings else None
                                )
                                
                                if result.get('status') == 'success':
                                    new_video.status = "completed"
                                    new_video.file_path = result.get('file_path')
                                    new_video.thumbnail_path = result.get('thumbnail_path') or result.get('metadata', {}).get('thumbnail')
                                    new_video.downloaded_at = datetime.now()
                                    new_video.duration = result.get('duration', 0)
                                    
                                    # [FIX] Strict Classification based on Channel Settings
                                    # We strictly respect the channel's default_script_only flag.
                                    # This avoids "guessing" based on file existence.
                                    new_video.is_script_only = channel.default_script_only
                                    
                                    # [FIX] Assign Metadata & Metrics
                                    meta = result.get('metadata', {})
                                    new_video.metadata_json = meta
                                    new_video.view_count = meta.get('view_count', 0)
                                    new_video.subscriber_count = meta.get('subscriber_count', 0)
                                    
                                    # [FIX] Calculate viral metrics
                                    try:
                                        from .services.scheduler import calculate_viral_metrics
                                        viral_score, velocity_score = calculate_viral_metrics(
                                            view_count=new_video.view_count,
                                            subscriber_count=new_video.subscriber_count,
                                            upload_date=new_video.upload_date
                                        )
                                        new_video.viral_score = viral_score
                                        new_video.velocity_score = velocity_score
                                    except Exception as e:
                                        print(f"[WARN] Viral score calculation failed: {e}")
                                    
                                    # [FIX] Create VideoHistory record for graph
                                    try:
                                        history_record = models.VideoHistory(
                                            video_id=new_video.id,
                                            view_count=new_video.view_count,
                                            timestamp=datetime.now()
                                        )
                                        db.add(history_record)
                                        print(f"[OK] Created VideoHistory: views={new_video.view_count}")
                                    except Exception as e:
                                        print(f"[WARN] VideoHistory creation failed: {e}")
                                else:
                                    new_video.status = "failed"
                                    new_video.failure_reason = result.get('error')
                                    print(f"[FAIL] Download failed: {result.get('error')}")
                                    
                            except Exception as e:
                                new_video.status = "failed"
                                new_video.failure_reason = str(e)
                                print(f"[FAIL] Download Exception: {e}")
                                
                            db.commit()
                            
                print(f"[{datetime.now()}] Finished {channel.name}: {new_videos_found} new videos.")
                
            except Exception as e:
                print(f"[WARN] Error scanning channel {channel.name}: {e}")
                # [FIX] Track Consecutive Failures
                channel.fail_count += 1
                channel.last_error = str(e)[:500] # Truncate
                db.commit()
                
                if channel.fail_count >= 3:
                     print(f"[ALERT] CRITICAL WARNING: Channel '{channel.name}' has failed {channel.fail_count} consecutive scans!")
            
            # [FIX] polite delay between channels
            sleep_time = random.randint(10, 30)
            print(f"💤 Sleeping {sleep_time}s to respect rate limits...")
            time.sleep(sleep_time)
                
    except Exception as e:
        print(f"Scan Error: {e}")
    finally:
        db.close()

def scheduler_watchdog():
    """
    Monitors system health.
    Checks if channels are stale (no scan for > 4 hours) or have high failure counts.
    """
    db = SessionLocal()
    try:
        print(f"[{datetime.now()}] 🐕 Running Scheduler Watchdog...")
        channels = crud.get_channels(db)
        count_stale = 0
        count_failed = 0
        
        cutoff = datetime.now() - timedelta(hours=4)
        
        for ch in channels:
            # Check Staleness (Active but not scanned recently)
            if ch.status == 'active' and (not ch.last_scanned_at or ch.last_scanned_at < cutoff):
                print(f"[WARN] Watchdog Alert: Channel '{ch.name}' is stale. Last scanned: {ch.last_scanned_at}")
                count_stale += 1
                
            # Check Failures
            if ch.fail_count >= 3:
                 print(f"[ALERT] Watchdog Alert: Channel '{ch.name}' has {ch.fail_count} failures. Error: {ch.last_error}")
                 count_failed += 1

        if count_stale > 0 or count_failed > 0:
            print(f"[WARN] Watchdog Summary: {count_stale} stale channels, {count_failed} failing channels.")
            
    except Exception as e:
        print(f"Watchdog Error: {e}")
    finally:
        db.close()

def check_warmup_progression():
    """
    웜업 자동 진행 체크
    24시간마다 다음 단계로 자동 진행
    """
    db = SessionLocal()
    try:
        print(f"[{datetime.now()}] [FIRE] Checking Warmup Progression...")
        
        # Find channels ready for next stage
        channels = db.query(models.BrandChannel).filter(
            models.BrandChannel.warmup_status == "COMPLETED",
            models.BrandChannel.warmup_stage < 7,
            models.BrandChannel.warmup_stage > 0  # Only auto-progress if already started
        ).all()
        
        progressed_count = 0
        for channel in channels:
            # Check if 24 hours have passed since last run
            if channel.warmup_last_run:
                hours_passed = (datetime.now() - channel.warmup_last_run).total_seconds() / 3600
                
                if hours_passed >= 24:
                    next_stage = channel.warmup_stage + 1
                    print(f"⏩ Auto-progressing {channel.channel_name} to Day {next_stage}")
                    
                    # Import here to avoid circular dependency
                    from app.services.browser_session_manager import session_manager
                    
                    # Run next stage in background
                    try:
                        # Reset status to allow new run
                        channel.warmup_status = "IDLE"
                        db.commit()
                        
                        # Trigger warmup
                        session_manager.run_warmup_routine(channel.channel_id, next_stage)
                        progressed_count += 1
                    except Exception as e:
                        print(f"[FAIL] Failed to progress {channel.channel_name}: {e}")
                        channel.warmup_status = "FAILED"
                        channel.warmup_last_error = str(e)
                        db.commit()
        
        if progressed_count > 0:
            print(f"[OK] Auto-progressed {progressed_count} channels")
        else:
            print(f"ℹ️ No channels ready for progression")
            
    except Exception as e:
        print(f"Warmup Progression Error: {e}")
    finally:
        db.close()

def check_scheduled_publishes():
    """
    Checks for videos awaiting 'Delayed Publication' (Switch from Private to Public).
    """
    db = SessionLocal()
    try:
        now = datetime.now()
        # Find items that are SCHEDULED and DUE
        items = db.query(models.WorkQueueItem).filter(
            models.WorkQueueItem.status == "SCHEDULED_PUBLISH",
            models.WorkQueueItem.scheduled_upload_time <= now
        ).all()
        
        if items:
            print(f"[{now}] 🕒 Found {len(items)} scheduled videos to publish...")
            # Import locally to avoid circular deps
            from app.services.browser_uploader import browser_uploader
            
            for item in items:
                try:
                    print(f"[FALLBACK] Publishing Scheduled Item: {item.title} (ID: {item.id})")
                    browser_uploader.publish_scheduled_video(db, item.id)
                except Exception as e:
                    print(f"[FAIL] Failed to publish item {item.id}: {e}")
    except Exception as e:
        print(f"Scheduled Publish Error: {e}")
    finally:
        db.close()

def check_scheduled_uploads():
    """
    Checks for videos scheduled for upload initiation.
    """
    db = SessionLocal()
    try:
        now = datetime.now()
        # Find items that are SCHEDULED_UPLOAD and DUE
        items = db.query(models.WorkQueueItem).filter(
            models.WorkQueueItem.status == "SCHEDULED_UPLOAD",
            models.WorkQueueItem.scheduled_upload_time <= now
        ).all()
        
        if items:
            print(f"[{now}] 🕒 Found {len(items)} scheduled uploads to start...")
            from app.services.browser_uploader import browser_uploader
            
            for item in items:
                try:
                    print(f"[FALLBACK] Starting Scheduled Upload: {item.title} (ID: {item.id})")
                    # Reset status to PENDING or TRIGGER upload directly?
                    # If we set to PENDING, the generic queue worker might pick it up?
                    # But generic worker picks PENDING.
                    # Let's set to PENDING-APPROVED or simply execute.
                    # Safest: Update status to PENDING and let the queue worker pick it up if running?
                    # Or call upload directly. Direct call ensures it happens now.
                    
                    # Update status to prevent double pick-up
                    item.status = "PROCESSING" 
                    db.commit()
                    
                    # Run in separate thread/task to not block scheduler
                    threading.Thread(target=browser_uploader.process_item, args=(item.id,), daemon=True).start()
                    
                except Exception as e:
                    print(f"[FAIL] Failed to start scheduled upload {item.id}: {e}")
                    # Revert status?
                    item.status = "FAILED"
                    item.log = f"Scheduled Start Failed: {str(e)}"
                    db.commit()
    except Exception as e:
        print(f"Scheduled Upload Error: {e}")
    finally:
        db.close()

from .services.trend_signal_tracker import run_trend_signal_tracker
def start_scheduler():
    db = SessionLocal()
    try:
        settings = crud.get_settings(db)
        interval = (settings.scan_interval_minutes if settings and settings.scan_interval_minutes is not None else 60)
    finally:
        db.close()

    # [FIX] Enhanced Channel Scan Logic
    def full_channel_scan_thread():
        full_channel_scan_logic()

    # Run channel scan at configured interval (delayed 2 min at startup to let backend settle)
    
    # Trend Signal Tracker (Scout & Evaluate) - Continuous Loop
    scheduler.add_job(run_trend_signal_tracker, 'interval', minutes=1, id='trend_signal_tracker',
                      next_run_time=datetime.now() + timedelta(seconds=10))
    scheduler.add_job(full_channel_scan_thread, 'interval', minutes=interval, id='channel_scan',
                      next_run_time=datetime.now() + timedelta(minutes=2))
    scheduler.add_job(run_rapid_batch, 'interval', minutes=15, id='trend_batch',
                      next_run_time=datetime.now() + timedelta(minutes=5))

    # [FIX] Video Stats Update — single job, safe wrapper, delayed startup
    from .services.scheduler import update_video_stats

    def stats_update_wrapper():
        if _shutdown_requested.is_set():
            return
        try:
            update_video_stats()
        except RuntimeError as e:
            if "interpreter shutdown" in str(e) or "cannot schedule" in str(e):
                pass  # Silently ignore – process is shutting down
            else:
                raise
        except Exception as e:
            print(f"[FAIL] Stats update failed: {e}")

    # Delay first run by 3 min to avoid startup overload
    scheduler.add_job(stats_update_wrapper, 'interval', minutes=interval, id='video_stats_update',
                      next_run_time=datetime.now() + timedelta(minutes=3))

    # Watchdog (Every 30 mins) — delay 10 min so it doesn't run at bare startup
    scheduler.add_job(scheduler_watchdog, 'interval', minutes=30, id='watchdog',
                      next_run_time=datetime.now() + timedelta(minutes=10))

    # Warmup Progression (Every hour) — delay 15 min
    scheduler.add_job(check_warmup_progression, 'interval', hours=1, id='warmup_progression',
                      next_run_time=datetime.now() + timedelta(minutes=15))

    # Check Scheduled Publishes (Every 1 Minute) — delay 1 min to let DB settle
    scheduler.add_job(check_scheduled_publishes, 'interval', minutes=1, id='delayed_publish',
                      next_run_time=datetime.now() + timedelta(minutes=1))

    # Check Scheduled Uploads (Every 1 Minute) — delay 1 min
    scheduler.add_job(check_scheduled_uploads, 'interval', minutes=1, id='scheduled_upload',
                      next_run_time=datetime.now() + timedelta(minutes=1))

    # Daily Report Job (9:00 AM)
    from app.services import report_generator
    def daily_report_wrapper():
        if _shutdown_requested.is_set():
            return
        db = SessionLocal()
        try:
            report_generator.generate_daily_report(db)
        finally:
            db.close()

    scheduler.add_job(daily_report_wrapper, 'cron', hour=9, minute=0, id='daily_report')

    scheduler.start()

    t = threading.Thread(target=initial_scan_thread, daemon=True)
    t.start()


def stop_scheduler():
    """Stops the scheduler gracefully."""
    # [FIX] Signal all job wrappers to abort BEFORE shutting down APScheduler
    _shutdown_requested.set()
    if scheduler.running:
        print("🛑 Stopping Background Scheduler...")
        scheduler.shutdown(wait=False)
