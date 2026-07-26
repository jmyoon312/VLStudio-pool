from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import SessionLocal
from datetime import datetime

router = APIRouter(tags=["dashboard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    # 1. Counts
    total_channels = db.query(models.Channel).count()
    active_channels = db.query(models.Channel).filter(models.Channel.status == "active").count()
    
    # 2. Videos Logic
    # Differentiate between Videos and Scripts for counts?
    # User's frontend displayed "Total Videos". Usually implies ALL or just Videos.
    # Given the split, likely "Total Videos" means `is_script_only=False` + `True` OR just `False`.
    # Let's count ALL for 'total_videos' to match previous behavior (get_videos/ len), 
    # but maybe we should split them if we want precision.
    # For now, let's keep 'total_videos' as ALL to match "Videos" table size.
    total_videos = db.query(models.Video).count()
    
    # Downloaded Today (All)
    today_str = datetime.now().strftime("%Y-%m-%d")
    downloaded_today = db.query(models.Video).filter(models.Video.downloaded_at.like(f"{today_str}%")).count()
    
    # 3. Recent Lists
    recent_videos = crud.get_recent_videos_only(db, limit=5)
    recent_scripts = crud.get_recent_scripts(db, limit=5)

    return {
        "total_channels": total_channels,
        "active_channels": active_channels,
        "total_videos": total_videos,
        "downloaded_today": downloaded_today,
        "recent_videos": recent_videos,
        "recent_scripts": recent_scripts
    }
