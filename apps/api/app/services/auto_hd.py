
import os
from sqlalchemy.orm import Session
from .. import models, crud
from .. import downloader
from datetime import datetime

def process_video_for_auto_hd(db: Session, video: models.Video, settings: models.Settings) -> bool:
    """
    Checks if a video qualifies for Auto HD upgrade based on thresholds.
    Triggers download if qualified.
    Returns True if upgrade was triggered, False otherwise.
    """
    try:
        is_currently_hd = video.metadata_json and video.metadata_json.get('is_hd')
        
        # Check Settings for Thresholds
        auto_upgrade = False
        reason = ""
        
        if not is_currently_hd:
            if settings.auto_hd_viral_threshold and settings.auto_hd_viral_threshold > 0:
                if video.viral_score and video.viral_score >= settings.auto_hd_viral_threshold:
                    auto_upgrade = True
                    reason = f"Viral Score ({video.viral_score:.1f}) >= {settings.auto_hd_viral_threshold}"
            
            if not auto_upgrade and settings.auto_hd_velocity_threshold and settings.auto_hd_velocity_threshold > 0:
                if video.velocity_score and video.velocity_score >= settings.auto_hd_velocity_threshold:
                    auto_upgrade = True
                    reason = f"Velocity Score ({video.velocity_score:.1f}) >= {settings.auto_hd_velocity_threshold}"
        
        if auto_upgrade:
            print(f"🚀 [AUTO-HD] Triggering HD Upgrade for '{video.title}' | Reason: {reason}")
            
            # Trigger Download with force_hd=True
            root_path = settings.root_download_path if settings else "downloads"
            
            # Re-construct path (Same logic as initial download)
            # Try to start with category folder if it exists
            download_path = ""
            channel = video.channel
            
            # Lazy load channel if missing (should be joined in query usually, but safe guard)
            if not channel and video.channel_id:
                channel = db.query(models.Channel).filter(models.Channel.id == video.channel_id).first()

            if channel:
                # Use Category if available
                if channel.category:
                    cat_folder = channel.category.folder_name or channel.category.name.replace(" ", "_").strip()
                    # Sanitize channel name handling
                    ch_name_clean = (channel.folder_name or channel.name).replace(" ", "_").strip()
                    download_path = os.path.join(root_path, cat_folder, ch_name_clean)
                else:
                    # No Category -> Temp Storage? Or Channel Root?
                    # Scheduler logic was: _temp_storage / ChannelName
                    ch_name_clean = (channel.folder_name or channel.name).replace(" ", "_").strip()
                    download_path = os.path.join(root_path, "_temp_storage", ch_name_clean)
            else:
                 # Fallback
                 download_path = os.path.join(root_path, "_temp_storage", "Unknown_Channel")

            os.makedirs(download_path, exist_ok=True)

            # Call Downloader
            try:
                # [FIX] Delete existing file(s) to FORCE re-download
                # yt-dlp skips if file exists, so we must clean up first.
                import glob
                search_pattern = os.path.join(download_path, f"*{video.id}*.*") 
                # Note: video.id might be internal DB ID? No, usually YouTube URL.
                # Actually we need the YouTube ID from URL or metadata. 
                # Ideally, we extract it.
                yt_id = None
                if video.url:
                     import re
                     match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", video.url)
                     if match: yt_id = match.group(1)
                
                if yt_id:
                     delete_pattern = os.path.join(download_path, f"*{yt_id}*.*")
                     existing_files = glob.glob(delete_pattern)
                     print(f"🧹 [AUTO-HD] Cleaning up {len(existing_files)} existing files for upgrade: {delete_pattern}")
                     for f in existing_files:
                         try:
                             if not f.endswith('.json'): # Keep metadata? No, refresh everything.
                                 os.remove(f)
                                 print(f"   - Deleted: {os.path.basename(f)}")
                         except Exception as del_err:
                             print(f"   ⚠️ Failed to delete {f}: {del_err}")
                
                # Direct subprocess call to yt-dlp (Mirroring manual_hd_download logic)
                import subprocess
                
                # Construct proper output template
                # Manual logic uses: timestamp_safe_title.%(ext)s
                # We should stick to what downloader usually does OR match manual exactly.
                # Matching manual exactly:
                safe_title = "".join(c for c in video.title if c.isalnum() or c in (' ', '-', '_')).strip()
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_template = os.path.join(download_path, f"{timestamp}_{safe_title}.%(ext)s")
                
                cmd = [
                    'yt-dlp',
                    # [FIX] No client restrictions - yt-dlp smart defaults provide full quality access
                    '--format', 'bestvideo[height<=1080]+bestaudio/best',
                    '--merge-output-format', 'mp4',
                    '--output', output_template,
                    '--write-thumbnail',
                    '--write-sub',
                    '--write-auto-sub',
                    '--sub-lang', 'en,ko',
                    '--convert-subs', 'srt',
                    '--embed-subs',
                    '--no-playlist',
                    video.url
                ]
                
                print(f"   running: {' '.join(cmd)}")
                
                # Run yt-dlp
                result_proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=900
                )
                
                if result_proc.returncode == 0:
                    print(f"   ✅ yt-dlp success. scanning for file...")
                    # Find downloaded file
                    search_pattern_result = os.path.join(download_path, f"{timestamp}_{safe_title}.*")
                    video_files = glob.glob(search_pattern_result)
                    hd_file = None
                    
                    for file in video_files:
                        if file.endswith(('.mp4', '.mkv', '.webm')):
                            hd_file = file
                            break
                            
                    if hd_file:
                        # Success!
                        # Update metadata
                        import json
                        # We didn't get info_json from subprocess nicely without --print-json
                        # But we can try to load the .info.json if written?
                        # Manual download doesn't read info_json back explicitly in the snippet I saw,
                        # it just sets 'is_hd' = True.
                        
                        # Let's trust it.
                        video.file_path = hd_file
                        video.downloaded_at = datetime.now()
                        
                        if not video.metadata_json: video.metadata_json = {}
                        if isinstance(video.metadata_json, str): video.metadata_json = json.loads(video.metadata_json)
                        
                        video.metadata_json['is_hd'] = True
                        video.metadata_json['hd_downloaded_at'] = datetime.now().isoformat()
                        
                        # Just in case, try to clear other flags
                        video.metadata_json['height'] = 1080 # Assumption/Flag
                        
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(video, 'metadata_json')
                        
                        db.add(video)
                        db.commit()
                        db.refresh(video)
                        
                        print(f"✅ [AUTO-HD] Upgrade Complete & DB Updated for '{video.title}'")
                        return True
                    else:
                        print(f"❌ [AUTO-HD] Download success but file not found matching {search_pattern_result}")
                else:
                    error_msg = result_proc.stderr or result_proc.stdout or "Unknown error"
                    print(f"❌ [AUTO-HD] yt-dlp failed for '{video.title}': {error_msg[:200]}")
                    
            except Exception as e:
                print(f"❌ [AUTO-HD] Error downloading '{video.title}': {e}")
                import traceback
                traceback.print_exception(type(e), e, e.__traceback__)
        
    except Exception as e:
        try:
            print(f"❌ [AUTO-HD] Error processing video '{video.title}': {e}".encode('utf-8', errors='ignore').decode('utf-8'))
        except:
            print("❌ [AUTO-HD] Critical error in processing video (Print failed)")
        
    return False

def scan_all_videos_for_auto_hd(db: Session):
    """
    Scans ALL videos in the database and triggers Auto HD for any that qualify.
    This is intended to be run as a background task when settings change.
    """
    print("🔄 [AUTO-HD] Starting manual scan for Auto HD upgrades...")
    settings = crud.get_settings(db)
    if not settings:
        return
        
    # Optimization: Filter by threshold in SQL?
    # Viral score is computed in Python in scheduler loop generally, but saved to DB?
    # Yes, video.viral_score is a column now.
    
    # We only care about videos that are NOT HD.
    # We can't easily filter JSON field 'is_hd' in all SQL dialects efficiently without extensions.
    # So we iterate. But we can filter by Viral/Velocity threshold in SQL to reduce set.
    
    query = db.query(models.Video)
    
    # Filter candidates: either viral > thresh OR velocity > thresh
    # AND (viral_score is not null OR velocity_score is not null)
    
    # Note: Logic is (Viral >= Thresh) OR (Velocity >= Thresh)
    # We can do this filter in Python for simplicity/safety if dataset isn't huge.
    # But SQL is better.
    
    from sqlalchemy import or_
    
    filters = []
    if settings.auto_hd_viral_threshold:
        filters.append(models.Video.viral_score >= settings.auto_hd_viral_threshold)
    
    if settings.auto_hd_velocity_threshold:
        filters.append(models.Video.velocity_score >= settings.auto_hd_velocity_threshold)
        
    if not filters:
        print("⚠️ [AUTO-HD] No thresholds set. Skipping scan.")
        return

    candidates = query.filter(or_(*filters)).all()
    print(f"🔍 [AUTO-HD] Found {len(candidates)} candidates matching thresholds. Checking HD status...")
    
    upgraded_count = 0
    for video in candidates:
        # DB session might be shared.
        if process_video_for_auto_hd(db, video, settings):
            upgraded_count += 1
            
    print(f"✅ [AUTO-HD] Manual scan complete. Upgraded {upgraded_count} videos.")

