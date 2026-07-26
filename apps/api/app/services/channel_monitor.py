import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app import crud, models, database
from app.downloader import downloader
from app.scrapers.douyin_scraper import DouyinChannelScraper
import re
import logging

import logging
import sys

# [DEBUG] Configure File Logging
logger = logging.getLogger("app.system")
# [FIX] hasHandlers() returns True even for parent (root) handlers inherited from uvicorn,
# so we check specifically if *this* logger already has a FileHandler attached.
# This ensures the file handler is always registered on first load.
try:
    _has_file_handler = any(isinstance(h, logging.FileHandler) for h in logger.handlers)
    if not _has_file_handler:
        # Keep log path in apps/api/ root to match logs.py router
        api_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        log_path = os.path.join(api_dir, "scan_debug.log")
        f_handler = logging.FileHandler(log_path, encoding='utf-8')
        f_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        f_handler.setFormatter(formatter)
        logger.addHandler(f_handler)
        logger.propagate = False  # Prevent double-logging to uvicorn console
except Exception as e:
    print(f"WARNING: Could not setup channel_monitor logging: {e}")

logger.setLevel(logging.DEBUG)

from app.config import settings as app_settings

def sanitize_folder_name(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).replace(" ", "_")

def get_channel_download_path(settings, channel):
    """Constructs the correct path: Root / downloads / Category / Channel"""
    # [FIX] Force absolute path and avoid relative leaks
    raw_root = settings.root_download_path or app_settings.MEDIA_ROOT
    
    # Safety: Ensure the path is absolute for the current OS
    is_absolute = os.path.isabs(raw_root)
    if not is_absolute:
        logger.warning(f"⚠️ Suspicious relative path: '{raw_root}'. Forcing absolute root: '{app_settings.MEDIA_ROOT}'.")
        raw_root = app_settings.MEDIA_ROOT
        
    from ..utils.path_utils import get_standardized_download_path
    downloads_path = get_standardized_download_path(settings)
    
    if channel.category:
        cat_folder = channel.category.folder_name or sanitize_folder_name(channel.category.name)
        full_path = os.path.join(downloads_path, cat_folder, channel.folder_name)
    else:
        full_path = os.path.join(downloads_path, "_temp_storage", channel.folder_name)
        
    # [FIX] Ensure forward slashes and normalize
    resolved_path = full_path.replace("\\", "/").replace("//", "/")
    logger.info(f"📍 Resolved Download Path: {resolved_path}")
    return resolved_path

def scan_specific_channel(db: Session, channel: models.Channel, headless: bool = True, is_manual: bool = False):
    """
    Scans a single channel for new videos.
    """
    cat_name = channel.category.name if channel.category else "Uncategorized"
    log_prefix = f"[{cat_name}][{channel.name}]"
    logger.info(f"🕵️‍♂️ Scanning {log_prefix} ({channel.platform})...")
    
    settings = crud.get_settings(db)
    download_path = get_channel_download_path(settings, channel)
    os.makedirs(download_path, exist_ok=True)
    
    new_videos_found = 0
    candidates = [] # List of (url, metadata_date)

    try:
        # [FIX] 24-Hour Window Constraint (Relaxed for manual scans)
        # User requested: "Scan only 24h window... not all videos"
        # For manual scans, expand window to 7 days.
        scan_days = 7 if is_manual else 1
        yesterday = datetime.now() - timedelta(days=scan_days)
        yesterday_str = yesterday.strftime('%Y%m%d')
        
        # 1. Fetch Candidates (URLs)
        if 'douyin' in channel.platform or 'douyin.com' in channel.url:
            scraper = DouyinChannelScraper(settings=settings)
            # Douyin Scraper doesn't support dateafter yet, but loop filter will catch it
            urls = scraper.get_latest_video_urls(channel.url, limit=15, headless=headless)
            logger.debug(f"Douyin Scraper found {len(urls)} URLs")
            for url in urls:
                candidates.append({'url': url, 'date': None, 'title': 'Douyin Video'}) 
        else:
            # [UPGRADE] RSS Fallback for YouTube to avoid 429 Rate Limits
            entries = []
            is_rss_success = False
            
            if ('youtube' in channel.url.lower() or channel.platform == 'YoutubeTab') and not ('/videos' in channel.url.lower() or '/shorts' in channel.url.lower()):
                try:
                    # 1. Ensure platform_id exists
                    if not channel.platform_id:
                        logger.info(f"🔍 [ID FETCH] Fetching platform_id for {channel.name}...")
                        c_info = downloader.get_channel_info(channel.url)
                        if c_info and c_info.get('id'):
                            channel.platform_id = c_info['id']
                            db.commit()
                            logger.info(f"✅ Saved platform_id: {channel.platform_id}")
                    
                    if channel.platform_id:
                        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel.platform_id}"
                        logger.info(f"📡 [RSS] Fetching RSS for {channel.name}...")
                        
                        import requests
                        import xml.etree.ElementTree as ET
                        
                        resp = requests.get(rss_url, timeout=15)
                        if resp.status_code == 200:
                            root = ET.fromstring(resp.content)
                            # Namespace handling
                            ns = {'ns': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
                            
                            for entry in root.findall('ns:entry', ns):
                                try:
                                    v_id_node = entry.find('yt:videoId', ns)
                                    v_id = v_id_node.text if v_id_node is not None else None
                                    
                                    v_title_node = entry.find('ns:title', ns)
                                    v_title = v_title_node.text if v_title_node is not None else "Unknown Title"
                                    
                                    v_pub_node = entry.find('ns:published', ns)
                                    v_published = v_pub_node.text if v_pub_node is not None else None
                                    
                                    v_url = f"https://www.youtube.com/watch?v={v_id}" if v_id else None
                                    
                                    # Convert ISO to YYYYMMDD for compatibility
                                    v_date = None
                                    if v_published:
                                        try:
                                            dt = datetime.fromisoformat(v_published.replace('Z', '+00:00'))
                                            v_date = dt.strftime('%Y%m%d')
                                        except: pass
                                        
                                    if v_url:
                                        entries.append({
                                            'url': v_url,
                                            'webpage_url': v_url,
                                            'id': v_id,
                                            'title': v_title,
                                            'upload_date': v_date,
                                            'from_rss': True
                                        })
                                except Exception as inner_e:
                                    logger.warning(f"Error parsing RSS entry: {inner_e}")
                            
                            if entries:
                                logger.info(f"✅ [RSS SUCCESS] Found {len(entries)} videos via RSS.")
                                is_rss_success = True
                except Exception as rss_e:
                    logger.warning(f"⚠️ [RSS FAILED] {rss_e}. Falling back to standard scan.")

            if not is_rss_success:
                # YouTube / Others via yt-dlp
                # Pass 'dateafter' to optimization download scope
                logger.debug(f"Fetching via yt-dlp: {channel.url} (After {yesterday_str})")
                entries = downloader.get_latest_videos(channel.url, limit=50, dateafter=yesterday_str)
            logger.debug(f"yt-dlp returned {len(entries)} entries")
            
            for entry in entries:
                url = entry.get('webpage_url') or entry.get('url')
                date_str = entry.get('upload_date') # YYYYMMDD
                vid_id = entry.get('id')
                view_count = entry.get('view_count') # Capture View Count
                title = entry.get('title', 'Unknown Title')
                
                if url:
                    # logger.debug(f"  > Found: {vid_id} | Date: {date_str} | Views: {view_count}")
                    candidates.append({'url': url, 'date': date_str, 'id': vid_id, 'view_count': view_count, 'title': title})

        # 2. Filter & Download
        consecutive_old_misses = 0 # [FIX] Track consecutive old videos to stop early
        items_processed = 0 # [FIX] Track actual items processed
        
        for item in candidates:
            items_processed += 1
            url = item['url']
            vid_id = item.get('id')
            title = item.get('title', 'Unknown Title')
            
            # Helper for consistent logging
            # Format: Action [Category][Channel]
            log_prefix = f"[{cat_name}][{channel.name}]"
            date_info = item.get('date') if item.get('date') else "N/A"
            
            # A. Check DB Duplication (AND Update Metadata)
            is_existing_failed = False
            if vid_id:
                existing = db.query(models.Video).filter(models.Video.video_id == vid_id).first()
                if existing:
                    # [OPTIMIZATION] Reset miss counter since we found a known video (Anchor)
                    consecutive_old_misses = 0
                    
                    # Check if video file actually exists and status is completed
                    from app.utils.path_utils import get_absolute_path
                    file_exists = False
                    if existing.file_path:
                        try:
                            abs_file = get_absolute_path(existing.file_path)
                            if os.path.exists(abs_file):
                                file_exists = True
                        except:
                            pass
                    current_script_only = channel.default_script_only if hasattr(channel, 'default_script_only') else False
                    mode_mismatch = existing.is_script_only != current_script_only
                    is_completed = (existing.status == "completed" and file_exists)

                    if not mode_mismatch and is_completed:
                        # [FIX] Update Metadata for existing videos
                        new_views = item.get('view_count')
                        if new_views is not None:
                            # [OPTIMIZATION] Skip update if views unchanged
                            if existing.view_count == new_views:
                                 logger.debug(f"💤 [NO CHANGE] {log_prefix} [{title}] | {new_views} views")
                                 continue
                            
                            # [FIX] Protect against Zero-View Overwrite (yt-dlp glitch)
                            if new_views == 0 and existing.view_count > 0:
                                 logger.warning(f"🛡️ [PROTECT] {log_prefix} Ignored 0 view update (Current: {existing.view_count})")
                                 continue

                            # Update current view count
                            existing.view_count = new_views
                            
                            # [FIX] Recalculate Velocity & Viral Score
                            # 1. Update Upload Date if available
                            if item.get('date'):
                                 try:
                                     existing.upload_date = datetime.strptime(item['date'], '%Y%m%d')
                                 except:
                                     pass
                            
                            # 2. Calculate Metrics
                            try:
                                # Default to Lifetime Velocity (Fallback)
                                upload_dt = existing.upload_date or datetime.now()
                                lifetime_hours = max(0.1, (datetime.now() - upload_dt).total_seconds() / 3600)
                                velocity = new_views / lifetime_hours
                                
                                # Try to calculate Instant Velocity
                                last_history = db.query(models.VideoHistory).filter(models.VideoHistory.video_id == existing.id).order_by(models.VideoHistory.timestamp.desc()).first()
                                
                                if last_history:
                                    time_diff_hours = (datetime.now() - last_history.timestamp).total_seconds() / 3600
                                    if time_diff_hours > 0:
                                        view_diff = new_views - last_history.view_count
                                        instant_velocity = view_diff / time_diff_hours
                                        
                                        if instant_velocity > 0:
                                            velocity = instant_velocity
                                
                                existing.velocity_score = round(velocity, 1)
                                
                                if channel.subscriber_count and channel.subscriber_count > 0:
                                    existing.viral_score = round((new_views / channel.subscriber_count) * 100, 1)
                                else:
                                    existing.viral_score = 0.0
                            except Exception as calc_err:
                                logger.warning(f"Failed to calc metrics for {vid_id}: {calc_err}")

                            # Update metadata_json
                            if existing.metadata_json:
                                updated_meta = dict(existing.metadata_json)
                                updated_meta['view_count'] = new_views
                                updated_meta['velocity_score'] = existing.velocity_score
                                updated_meta['viral_score'] = existing.viral_score
                                existing.metadata_json = updated_meta
                            
                            # Add History Record
                            history = models.VideoHistory(
                                video_id=existing.id,
                                view_count=new_views,
                                timestamp=datetime.now()
                            )
                            db.add(history)
                            db.commit()
                            logger.info(f"📈 [UPDATE] {log_prefix} [{title}] | Views: {new_views} | URL: {url}")
                        else:
                            logger.debug(f"x [KNOWN] {log_prefix} (No View Data)")
                        
                        continue # Skip re-download, only metadata updated
                    else:
                        logger.info(f"🔄 [RE-PROCESS] {log_prefix} Mode change detected ({existing.is_script_only} -> {current_script_only}) for [{title}]")
                        is_existing_failed = True
            
            # B. Date Filter (YouTube only)
            if not is_existing_failed:
                if not item.get('date'):
                    logger.debug(f"? [Checking Date] {log_prefix} missing metadata...")
                    try:
                        # [FIX] Add timeout to prevent hanging on slow metadata extraction
                        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
                        
                        def fetch_info():
                            return downloader.get_video_info(url)
                        
                        with ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(fetch_info)
                            try:
                                info = future.result(timeout=30)  # [FIX] Increased from 5s to 30s to prevent skipping videos on slow networks
                                if info and info.get('upload_date'):
                                    item['date'] = info.get('upload_date')
                                    item['title'] = info.get('title', item.get('title'))
                                    title = item['title']
                                    date_info = item['date']
                                    logger.debug(f"✓ [Got Date] {log_prefix} {date_info}")
                            except FutureTimeoutError:
                                logger.warning(f"⏱️ [TIMEOUT] {log_prefix} Metadata fetch timeout (30s)")
                            except Exception as e:
                                err_msg = str(e)
                                if '429' in err_msg or 'rate limit' in err_msg.lower():
                                    logger.error(f"🚨 [RATE LIMIT] {log_prefix} YouTube blocked us. Stopping scan immediately.")
                                    return {"status": "failed", "error": "YouTube Rate Limit (429)"}
                                logger.warning(f"❌ [ERROR] {log_prefix} Metadata fetch failed: {e}")
                    except Exception as e:
                        err_msg = str(e)
                        if '429' in err_msg or 'rate limit' in err_msg.lower():
                             return {"status": "failed", "error": "YouTube Rate Limit (429)"}
                        logger.warning(f"Failed to fetch metadata for {vid_id}: {e}")

                if item.get('date'):
                    try:
                        v_date = datetime.strptime(item['date'], '%Y%m%d')
                        # [FIX] Relaxed check to 2 days to safely encompass "Yesterday" (which might be > 24h from now)
                        # Prevents rejecting recent videos due to midnight date boundaries.
                        # [FIX] Relaxed check to 2 days (7 days for manual scans)
                        limit_days = 7 if is_manual else 2
                        if datetime.now() - v_date > timedelta(days=limit_days): 
                            # [OPTIMIZATION] Strict Stop (Relaxed for manual scans)
                            # We only stop if we've seen several old videos in a row to avoid issues with mixed sorting
                            consecutive_old_misses += 1
                            if consecutive_old_misses >= 3:
                                logger.info(f"🛑 [STOP] {log_prefix} Found 3 consecutive old videos > {limit_days} days. Stopping scan.")
                                break
                            else:
                                logger.debug(f"⏳ [AGED] {log_prefix} Skipping old video [{title}] ({consecutive_old_misses}/3)")
                                continue
                        else:
                            consecutive_old_misses = 0
                        
                    except Exception as e:
                         logger.warning(f"Date parsing error: {e}")
                else:
                    logger.warning(f"⏭️ [SKIP] {log_prefix} (No Date): [{title}]")
                    continue

            logger.info(f"✨ [NEW FOUND] {log_prefix} ⬇️ Downloading: [{title}] | {url}")
            
            # [ANTI-BLOCKING] Add robust jitter between individual video downloads
            import time
            # [FIX] Reduced jitter for manual scans or general responsiveness (10-30s was too long)
            delay = random.uniform(2.0, 5.0) 
            logger.debug(f"⏳ Intra-Channel Jitter: Waiting {delay:.1f}s before download...")
            time.sleep(delay)
            
            try:
                if hasattr(channel, 'auto_download') and not channel.auto_download:
                    logger.info(f"🔔 [REF ALARM] New video detected on reference channel {channel.name}: {title} | {url}")
                    try:
                        from app.services import notification_service
                        if hasattr(notification_service, 'send_notification'):
                            notification_service.send_notification(f"Reference Channel Alert: {channel.name} uploaded '{title}'")
                    except ImportError:
                        pass
                    new_videos_found += 1
                    continue

                use_bypass = 'douyin' in channel.platform or 'douyin.com' in url
                script_only = channel.default_script_only if hasattr(channel, 'default_script_only') else False
                
                result = downloader.download_single_video(
                    video_url=url, 
                    root_download_path=download_path, 
                    cookies_path=settings.cookies_path,
                    use_bypass=use_bypass,
                    headless=headless,
                    script_only=script_only
                )
                
                if result.get('status') == 'success':
                    # [FIX] Strict Classification based on Channel Settings
                    # We strictly respect the channel's default_script_only flag.
                    # This avoids "guessing" based on file existence.
                    actual_script_only = script_only
                    
                    from app.routers.videos import save_video_to_db 
                    save_video_to_db(db, result, result.get('metadata'), channel.id, channel.category_id, is_script_only=actual_script_only)
                    new_videos_found += 1
                    logger.info(f"✅ [SAVED] {log_prefix} [{title}] (script_only={actual_script_only})")
                else:
                    logger.error(f"❌ [FAILED] {log_prefix} {result.get('error')}")
                    
            except Exception as e:
                err_msg = str(e)
                if '429' in err_msg or 'rate limit' in err_msg.lower():
                    logger.error(f"🚨 [RATE LIMIT] {log_prefix} YouTube blocked us during download. Stopping scan.")
                    return {"status": "failed", "error": "YouTube Rate Limit (429)"}
                logger.error(f"❌ [ERROR] {log_prefix} {e}")

        logger.info(f"✅ Scan Complete. Found {items_processed}, Downloaded {new_videos_found}.")
        return {"status": "success", "found": items_processed, "downloaded": new_videos_found}

    except Exception as e:
        err_msg = str(e)
        if '429' in err_msg or 'rate limit' in err_msg.lower():
            logger.error(f"🚨 [CRITICAL RATE LIMIT] {log_prefix} Global YouTube block detected. Stopping.")
            return {"status": "failed", "error": "YouTube Rate Limit (429) - Please wait an hour."}
        logger.error(f"Scan failed: {e}")
        return {"status": "failed", "error": str(e)}

import asyncio

async def run_channel_scan():
    """
    Scheduled task wrapper.
    Uses asyncio to handle concurrency limits and robust error handling.
    """
    logger.info("⏰ Starting Scheduled Channel Scan...")
    
    # 1. Get Candidate Channel IDs (Sync)
    # We fetch IDs first to avoid passing attached SQLAlchemy objects to threads
    db_main = database.SessionLocal()
    channel_ids = []
    try:
        active_channels = crud.get_active_channels(db_main)
        # Scan all active channels (reference channels have auto_download=False)
        channel_ids = [c.id for c in active_channels]
        
        # [ANTI-BLOCKING] Shuffle execution order to avoid predictable patterns
        random.shuffle(channel_ids)
        
        logger.info(f"Target Channels: {len(channel_ids)} (Shuffled)")
    except Exception as e:
        logger.error(f"Failed to fetch channels: {e}")
        return
    finally:
        db_main.close()

    if not channel_ids:
        logger.info("No active channels configured for auto-download.")
        return

    # 2. Async Worker Definition
    async def scan_worker(sem, cid):
        async with sem:
            # [ANTI-BLOCKING] Random jitter/sleep to prevent burst requests and rate-limiting
            # Sleep 30-60 seconds before processing each channel. 
            delay = random.uniform(30.0, 60.0)
            # logger.debug(f"⏳ Jitter: Waiting {delay:.1f}s for {cid}")
            await asyncio.sleep(delay)

            # Create dedicated DB session for this thread
            db_thread = database.SessionLocal()
            try:
                channel = crud.get_channel(db_thread, cid)
                if not channel: 
                    return
                
                logger.info(f"🚀 Starting scan for {channel.name} (Thread-Safe)...")
                
                # Run blocking scan function in a separate thread to not block the event loop
                await asyncio.to_thread(scan_specific_channel, db_thread, channel, headless=True)
                
            except Exception as e:
                logger.error(f"❌ Error scanning channel {cid}: {e}")
            finally:
                db_thread.close()

    # 3. Execution
    async def orchestrator():
        sem = asyncio.Semaphore(3) # Max 3 concurrent downloads
        tasks = [scan_worker(sem, cid) for cid in channel_ids]
        await asyncio.gather(*tasks)

    # Run the async loop
    try:
        await orchestrator()
        logger.info("✅ Scheduled Channel Scan Completed.")
    except Exception as e:
        logger.error(f"Critical Scheduler Error: {e}")
