"""
Maintenance API Router
자동 정리 및 유지보수 기능
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import os
import shutil
import logging

from .. import models, database
from ..utils.path_utils import normalize_path, get_related_files

router = APIRouter(tags=["maintenance"])

logger = logging.getLogger(__name__)

@router.get("/old-videos-count")
def get_old_videos_count(
    days: int = Query(10, description="경과 일수"),
    db: Session = Depends(database.get_db)
):
    """
    오래된 비디오 개수 조회
    
    Args:
        days: 경과 일수 (기본 10일)
    
    Returns:
        개수 및 예상 삭제 용량
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # 10일 이상 경과한 비디오 조회
        old_videos = db.query(models.Video).filter(
            models.Video.downloaded_at < cutoff_date
        ).all()
        
        # 파일 크기 계산
        total_size = 0
        for video in old_videos:
            file_path = normalize_path(video.file_path) if video.file_path else None
            if file_path and os.path.exists(file_path):
                total_size += os.path.getsize(file_path)
            
            # Related files (subtitles, etc)
            related_files = get_related_files(file_path) if file_path else []
            for rel_file in related_files:
                if os.path.exists(rel_file):
                    total_size += os.path.getsize(rel_file)

            # Thumbnail
            if video.thumbnail_path:
                thumb_path = normalize_path(video.thumbnail_path)
                if os.path.exists(thumb_path) and thumb_path not in related_files:
                    total_size += os.path.getsize(thumb_path)
        
        return {
            "count": len(old_videos),
            "days": days,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "cutoff_date": cutoff_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to count old videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup-old-videos")
def cleanup_old_videos(
    days: int = Query(10, description="경과 일수"),
    dry_run: bool = Query(False, description="테스트 모드 (실제 삭제 안 함)"),
    db: Session = Depends(database.get_db)
):
    """
    오래된 비디오 삭제
    
    Args:
        days: 경과 일수 (기본 10일)
        dry_run: True면 삭제하지 않고 목록만 반환
    
    Returns:
        삭제 결과
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # 10일 이상 경과한 비디오 조회
        old_videos = db.query(models.Video).filter(
            models.Video.downloaded_at < cutoff_date
        ).all()
        
        deleted_count = 0
        deleted_size = 0
        errors = []
        deleted_videos = []
        
        for video in old_videos:
            try:
                # Resolve paths
                file_path = normalize_path(video.file_path) if video.file_path else None
                related_files = get_related_files(file_path) if file_path else []
                
                # 파일 크기 계산
                file_size = 0
                if file_path and os.path.exists(file_path):
                    file_size += os.path.getsize(file_path)
                
                for rel_file in related_files:
                    if os.path.exists(rel_file):
                        file_size += os.path.getsize(rel_file)
                
                if video.thumbnail_path:
                    thumb_path = normalize_path(video.thumbnail_path)
                    if os.path.exists(thumb_path) and thumb_path not in related_files:
                        file_size += os.path.getsize(thumb_path)

                if not dry_run:
                    # 비디오 파일 삭제
                    if file_path and os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"Deleted video file: {file_path}")
                    
                    # 관련 파일 삭제 (자막 등)
                    for rel_file in related_files:
                        if os.path.exists(rel_file):
                            os.remove(rel_file)
                            logger.info(f"Deleted related file: {rel_file}")
                    
                    # 썸네일 삭제
                    if video.thumbnail_path:
                        thumb_path = normalize_path(video.thumbnail_path)
                        if os.path.exists(thumb_path) and thumb_path not in related_files:
                            os.remove(thumb_path)
                            logger.info(f"Deleted thumbnail: {thumb_path}")
                    
                    # DB 레코드 삭제
                    db.delete(video)
                
                deleted_count += 1
                deleted_size += file_size
                
                deleted_videos.append({
                    "id": video.id,
                    "title": video.title,
                    "created_at": video.created_at.isoformat() if video.created_at else None,
                    "size_mb": round(file_size / 1024 / 1024, 2)
                })
                
            except Exception as e:
                error_msg = f"Failed to delete video {video.id} ({video.title}): {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        if not dry_run:
            db.commit()
            logger.info(f"✅ Cleanup completed: {deleted_count} videos deleted, {deleted_size / 1024 / 1024:.2f} MB freed")
        else:
            logger.info(f"🔍 Dry run: {deleted_count} videos would be deleted, {deleted_size / 1024 / 1024:.2f} MB would be freed")
        
        return {
            "status": "success",
            "deleted_count": deleted_count,
            "deleted_size_mb": round(deleted_size / 1024 / 1024, 2),
            "dry_run": dry_run,
            "errors": errors,
            "deleted_videos": deleted_videos[:10] if dry_run else []  # dry_run일 때만 목록 반환 (최대 10개)
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
def get_system_metrics(db: Session = Depends(database.get_db)):
    """
    Returns system health metrics: Storage, DB Size, Zombie Tasks, API Status, CPU/RAM, Queue Stats.
    """
    try:
        from .. import crud
        settings = crud.get_settings(db)
        
        # 1. Storage Usage (Download Path)
        from app.config import settings as settings_conf
        root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
        if not os.path.isabs(root_path):
            root_path = os.path.abspath(root_path)
            
        storage_info = {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}
        if os.path.exists(root_path):
            total, used, free = shutil.disk_usage(root_path)
            storage_info = {
                "total_gb": round(total / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "free_gb": round(free / (1024**3), 2),
                "percent": round((used / total) * 100, 1)
            }
            
        # 2. Database Size
        db_path = "viral_loop.db"
        if settings_conf.DATABASE_URL.startswith("sqlite:///"):
            db_path = settings_conf.DATABASE_URL[10:]
        db_size_mb = 0
        if os.path.exists(db_path):
            db_size_mb = round(os.path.getsize(db_path) / (1024**2), 2)
            
        # 3. Zombie Tasks (Downloading for > 2 hours)
        zombie_cutoff = datetime.now() - timedelta(hours=2)
        zombies = db.query(models.Video).filter(
            models.Video.status == "downloading",
            models.Video.downloaded_at < zombie_cutoff
        ).count()
        
        # 4. API Status (Simple Check)
        api_status = {
            "openai": bool(settings.openai_api_key),
            "gemini": bool(settings.gemini_api_keys),
            "searxng": bool(settings.searxng_url),
            "tavily": bool(settings.tavily_api_keys)
        }
        
        # 5. [NEW] CPU & Memory (psutil)
        cpu_percent = 0
        memory_info = {"total_gb": 0, "used_gb": 0, "percent": 0}
        
        try:
            import psutil
            cpu_percent = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            memory_info = {
                "total_gb": round(mem.total / (1024**3), 2),
                "used_gb": round(mem.used / (1024**3), 2),
                "percent": mem.percent
            }
        except ImportError:
            logger.warning("psutil not installed, skipping CPU/RAM metrics")
        except Exception as e:
            logger.error(f"Failed to get psutil metrics: {e}")

        # 6. [NEW] Queue Stats
        # Active Downloads, Pending Videos
        active_downloads = db.query(models.Video).filter(models.Video.status == "downloading").count()
        pending_videos = db.query(models.Video).filter(models.Video.status.in_(["pending", "queued"])).count() # Adjust based on actual status values
        
        return {
            "storage": storage_info,
            "db_size_mb": db_size_mb,
            "zombie_tasks": zombies,
            "api_status": api_status,
            "cpu_percent": cpu_percent,
            "memory": memory_info,
            "queue": {
                "active_downloads": active_downloads,
                "pending_videos": pending_videos
            }
        }
        
    except Exception as e:
        logger.error(f"Metrics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

