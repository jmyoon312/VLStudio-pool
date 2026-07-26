import logging
import os
import random
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models, crud
from ..utils.path_utils import normalize_path, get_related_files

logger = logging.getLogger(__name__)

def update_video_stats():
    from app.database import SessionLocal
    db = SessionLocal()
    """
    Periodic task to update view counts and calculate viral metrics.
    [UPGRADE] Added jitter (random delay) to avoid YouTube rate limits.
    """
    try:
        # [NEW] Check Toggle
        settings = crud.get_settings(db)
        if settings and not settings.enable_view_stats_collection:
            logger.info("⏸️ View stats collection is disabled in settings. Skipping update.")
            return

        # [IMPROVEMENT] Fetch candidate IDs based on priority (Recent or High Velocity)
        cutoff = datetime.now() - timedelta(days=7)
        recent_videos = db.query(models.Video.id, models.Video.url, models.Video.title)\
            .filter((models.Video.upload_date >= cutoff) | (models.Video.downloaded_at >= cutoff))\
            .order_by(models.Video.velocity_score.desc().nulls_last())\
            .limit(50).all()
            
        viral_videos = db.query(models.Video.id, models.Video.url, models.Video.title)\
            .filter(models.Video.upload_date < cutoff, models.Video.velocity_score > 10)\
            .order_by(models.Video.velocity_score.desc().nulls_last())\
            .limit(30).all()
            
        candidates = list(set(recent_videos + viral_videos))
        if not candidates:
            candidates = db.query(models.Video.id, models.Video.url, models.Video.title)\
                .order_by(models.Video.last_updated.asc().nulls_first()).limit(20).all()

        if not candidates:
            return
            
        # Shuffle and pick smaller batch (10) but much higher quality targets to save API quota
        target_batch = random.sample(candidates, k=min(len(candidates), 10))
        
        updated_count = 0
        from ..downloader import get_video_info
        
        # Use top-level crud and models
        current_settings = crud.get_settings(db)
        cookies_path = current_settings.cookies_path if current_settings else None
        
        for vid_data in target_batch:
            # [JITTER] Randomized delay between requests (3-7 seconds)
            delay = random.uniform(3, 7)
            logger.info(f"⏳ Jitter delay: {delay:.1f}s before fetching {vid_data.title}")
            try:
                time.sleep(delay)
            except Exception:
                # Interrupted during sleep (e.g., process shutdown)
                break
            
            video = db.query(models.Video).filter(models.Video.id == vid_data.id).first()
            if not video or not video.url: continue
            
            try:
                info = get_video_info(video.url, cookies_path=cookies_path)
                if not info:
                    logger.info(f"Could not fetch stats for {video.title} (Video may be unavailable, private, or rate-limited)")
                    continue
                    
                current_views = info.get('view_count', 0)
                if current_views > 0:
                    video.view_count = current_views
                
                # Update Channel Subs
                channel = video.channel
                fresh_subs = info.get('channel_follower_count') or info.get('uploader_sub_count')
                if channel and fresh_subs:
                     channel.subscriber_count = fresh_subs
                
                # Update History
                last_hist = db.query(models.VideoHistory).filter(models.VideoHistory.video_id == video.id).order_by(models.VideoHistory.timestamp.desc()).first()
                if not last_hist or (datetime.now() - last_hist.timestamp).total_seconds() > 3600:
                    history = models.VideoHistory(video_id=video.id, view_count=current_views)
                    db.add(history)

                # Velocity & Viral Scores (Using unified helper)
                v_score, vel_score = calculate_viral_metrics(
                    current_views, 
                    fresh_subs or (channel.subscriber_count if channel else 0),
                    video.upload_date or video.downloaded_at
                )
                video.viral_score = v_score
                video.velocity_score = vel_score
                    
                video.last_updated = datetime.now()
                db.commit() 
                print(f"✅ Updated {video.title}: Views={current_views}, Viral={video.viral_score:.1f}%")
                
                # Auto HD Upgrade Trigger
                try:
                    from .auto_hd import process_video_for_auto_hd
                    process_video_for_auto_hd(db, video, settings)
                except: pass

                updated_count += 1
                
            except RuntimeError as e:
                err_str = str(e)
                # [FIX] Gracefully handle interpreter shutdown during background tasks
                if "interpreter shutdown" in err_str or "cannot schedule" in err_str:
                    logger.warning("⚠️ Stats update interrupted: interpreter shutting down. Exiting cleanly.")
                    return
                logger.error(f"Failed to update stats for {video.id}: {e}")
                db.rollback()
                continue
            except Exception as v_e:
                logger.error(f"Failed to update stats for {video.id}: {v_e}")
                db.rollback()
                continue

        logger.info(f"Updated stats for {updated_count} videos (Batch Mode with Jitter)")
        
    except RuntimeError as e:
        err_str = str(e)
        if "interpreter shutdown" in err_str or "cannot schedule" in err_str:
            logger.warning("⚠️ Stats update aborted: interpreter shutting down.")
            return
        logger.error(f"Error in update_video_stats: {e}")
        db.rollback()
    except Exception as e:
        logger.error(f"Error in update_video_stats: {e}")
        db.rollback()
    finally:
        db.close()


def reset_daily_quotas(db: Session = None):
    # Stealth Protocol: Removed Global Quota Reset.
    # Quotas are now per TinCanAccount and handled via CredentialManager or manual check.
    pass

def calculate_viral_metrics(view_count: int, subscriber_count: int, upload_date):
    """
    Calculate viral score and velocity for a video.
    
    Args:
        view_count: Current view count
        subscriber_count: Channel subscriber count
        upload_date: Video upload datetime
        
    Returns:
        tuple: (viral_score, velocity_score)
    """
    from datetime import datetime
    
    # Viral Score: Views vs Subscribers ratio
    subs = subscriber_count or 1000  # Fallback if no sub count
    viral_score = (view_count / subs) * 100 if subs > 0 else 0
    
    # Velocity Score: Views per hour since upload
    age_seconds = (datetime.now() - (upload_date or datetime.now())).total_seconds()
    age_hours = age_seconds / 3600
    # [FIX] Clamp min hours to 1.0 so Velocity never exceeds Total Views
    velocity_score = view_count / max(1.0, age_hours)
    
    return viral_score, velocity_score

def daily_cleanup_task():
    """
    하루 1회 자동 정리 작업
    10일 경과한 비디오 자동 삭제
    """
    from app.database import SessionLocal
    from datetime import datetime, timedelta
    import os
    
    logger.info("🗑️ Starting daily cleanup task...")
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.now() - timedelta(days=10)
        
        # 10일 이상 경과한 비디오 조회
        old_videos = db.query(models.Video).filter(
            models.Video.downloaded_at < cutoff_date
        ).all()
        
        if not old_videos:
            logger.info("✅ No old videos to clean up")
            return
        
        deleted_count = 0
        deleted_size = 0
        
        for video in old_videos:
            try:
                # Resolve paths for cleanup
                file_path = normalize_path(video.file_path) if video.file_path else None
                related_files = get_related_files(file_path) if file_path else []
                
                # Calculate total size of evidence to delete
                file_size = 0
                
                # 1. Main Video File
                if file_path and os.path.exists(file_path):
                    file_size += os.path.getsize(file_path)
                    os.remove(file_path)
                    logger.info(f"Deleted video file: {file_path}")
                
                # 2. Related Files (Subtitles, Thumbnails, etc.)
                for rel_file in related_files:
                    if os.path.exists(rel_file):
                        file_size += os.path.getsize(rel_file)
                        os.remove(rel_file)
                        logger.info(f"Deleted related file: {rel_file}")
                
                # 3. Thumbnail (If not caught by related_files)
                if video.thumbnail_path:
                    thumb_path = normalize_path(video.thumbnail_path)
                    if os.path.exists(thumb_path) and thumb_path not in related_files:
                        file_size += os.path.getsize(thumb_path)
                        os.remove(thumb_path)
                        logger.info(f"Deleted thumbnail: {thumb_path}")

                # DB 레코드 삭제
                db.delete(video)
                
                deleted_count += 1
                deleted_size += file_size
                
            except Exception as e:
                logger.error(f"Failed to delete video {video.id}: {e}")
        
        db.commit()
        logger.info(f"✅ Cleanup completed: {deleted_count} videos deleted, {deleted_size / 1024 / 1024:.2f} MB freed")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to run daily cleanup: {e}")
    finally:
        db.close()




def reset_daily_quotas(db: Session = None):
    # Stealth Protocol: Removed Global Quota Reset.
    # Quotas are now per TinCanAccount and handled via CredentialManager or manual check.
    pass

def calculate_viral_metrics(view_count: int, subscriber_count: int, upload_date):
    """
    Calculate viral score and velocity for a video.
    
    Args:
        view_count: Current view count
        subscriber_count: Channel subscriber count
        upload_date: Video upload datetime
        
    Returns:
        tuple: (viral_score, velocity_score)
    """
    from datetime import datetime
    
    # Viral Score: Views vs Subscribers ratio
    subs = subscriber_count or 1000  # Fallback if no sub count
    viral_score = (view_count / subs) * 100 if subs > 0 else 0
    
    # Velocity Score: Views per hour since upload
    age_seconds = (datetime.now() - (upload_date or datetime.now())).total_seconds()
    age_hours = age_seconds / 3600
    # [FIX] Clamp min hours to 1.0 so Velocity never exceeds Total Views
    velocity_score = view_count / max(1.0, age_hours)
    
    return viral_score, velocity_score

def daily_cleanup_task():
    """
    하루 1회 자동 정리 작업
    10일 경과한 비디오 자동 삭제
    """
    from app.database import SessionLocal
    from datetime import datetime, timedelta
    import os
    
    logger.info("🗑️ Starting daily cleanup task...")
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.now() - timedelta(days=10)
        
        # 10일 이상 경과한 비디오 조회
        old_videos = db.query(models.Video).filter(
            models.Video.downloaded_at < cutoff_date
        ).all()
        
        if not old_videos:
            logger.info("✅ No old videos to clean up")
            return
        
        deleted_count = 0
        deleted_size = 0
        
        for video in old_videos:
            try:
                # Resolve paths for cleanup
                file_path = normalize_path(video.file_path) if video.file_path else None
                related_files = get_related_files(file_path) if file_path else []
                
                # Calculate total size of evidence to delete
                file_size = 0
                
                # 1. Main Video File
                if file_path and os.path.exists(file_path):
                    file_size += os.path.getsize(file_path)
                    os.remove(file_path)
                    logger.info(f"Deleted video file: {file_path}")
                
                # 2. Related Files (Subtitles, Thumbnails, etc.)
                for rel_file in related_files:
                    if os.path.exists(rel_file):
                        file_size += os.path.getsize(rel_file)
                        os.remove(rel_file)
                        logger.info(f"Deleted related file: {rel_file}")
                
                # 3. Thumbnail (If not caught by related_files)
                if video.thumbnail_path:
                    thumb_path = normalize_path(video.thumbnail_path)
                    if os.path.exists(thumb_path) and thumb_path not in related_files:
                        file_size += os.path.getsize(thumb_path)
                        os.remove(thumb_path)
                        logger.info(f"Deleted thumbnail: {thumb_path}")

                # DB 레코드 삭제
                db.delete(video)
                
                deleted_count += 1
                deleted_size += file_size
                
            except Exception as e:
                logger.error(f"Failed to delete video {video.id}: {e}")
        
        db.commit()
        logger.info(f"✅ Cleanup completed: {deleted_count} videos deleted, {deleted_size / 1024 / 1024:.2f} MB freed")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to run daily cleanup: {e}")
    finally:
        db.close()


def channel_cleanup_task():
    """
    주기적 채널 정리 작업
    1. 구독자 0이거나 이름이 누락된 채널 정보를 재수집
    2. 구독자가 1,000명 미만이거나 100,000명 이상인 채널 삭제
    """
    from app.database import SessionLocal
    from app import models
    from app.services.category_discovery_service import fetch_single_channel_info
    
    logger.info("🧹 Starting channel pool cleanup task...")
    db = SessionLocal()
    
    try:
        # 1. Resolve missing info (0 subscribers or name starts with UC)
        bad_channels = db.query(models.DiscoveryChannel).filter(
            (models.DiscoveryChannel.subscriber_count == 0) | 
            (models.DiscoveryChannel.name.like('UC%')) | 
            (models.DiscoveryChannel.name.like('Seed UC%'))
        ).limit(50).all() # Limit to 50 to avoid long blocking
        
        resolved_count = 0
        for ch in bad_channels:
            try:
                info = fetch_single_channel_info(ch.url)
                if info and info.get('subscriber_count') is not None:
                    ch.subscriber_count = info.get('subscriber_count')
                    if info.get('name'):
                        ch.name = info.get('name')
                    db.commit()
                    resolved_count += 1
            except Exception as e:
                logger.error(f"Failed to resolve channel {ch.url}: {e}")
                
        logger.info(f"✅ Resolved {resolved_count} missing channel infos.")

        from sqlalchemy import func
        # 2. Purge channels outside 1k ~ 100k
        # Exception: Do not purge if the channel has any video with view_count >= 30,000
        purge_query = db.query(models.DiscoveryChannel).outerjoin(
            models.DiscoveryVideo, models.DiscoveryChannel.id == models.DiscoveryVideo.channel_id
        ).filter(
            (models.DiscoveryChannel.subscriber_count > 0) & 
            ((models.DiscoveryChannel.subscriber_count < 1000) | 
             (models.DiscoveryChannel.subscriber_count >= 100000))
        ).group_by(models.DiscoveryChannel.id).having(
            func.max(func.coalesce(models.DiscoveryVideo.view_count, 0)) < 30000
        )
        
        # Since DELETE with JOIN/GROUP BY might not be supported directly, we fetch IDs first
        channels_to_delete = purge_query.all()
        purge_count = len(channels_to_delete)
        
        if purge_count > 0:
            for ch in channels_to_delete:
                db.delete(ch)
            db.commit()
            logger.info(f"🗑️ Purged {purge_count} channels outside target range (kept high performers).")
        else:
            logger.info("✅ No channels to purge in this run.")

    except Exception as e:
        logger.error(f"❌ Failed to run channel cleanup: {e}")
    finally:
        db.close()
