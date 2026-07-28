from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging

from app.database import get_db
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["profiles"])
@router.get("")
def list_profiles(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, alias="type", description="Filter by profile type (CAPTAIN, TIN_CAN, etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, DRAFT, etc.)"),
):
    try:
        query = db.query(models.Profile)
        if type:
            query = query.filter(models.Profile.profile_type == type)
        if status:
            query = query.filter(models.Profile.status == status)
        profiles = query.all()

        results = []
        for p in profiles:
            results.append({
                "id": p.id,
                "email": p.email or "no-email@viraloop.ai",
                "profile_type": p.profile_type,
                "status": p.status,
                "engine_type": p.engine_type,
                "folder_path": p.folder_path,
                "tags": p.tags or [],
                "daily_gen_count": p.daily_gen_count or 0,
                "last_gen_at": str(p.last_gen_at) if p.last_gen_at else None,
                "proxy_mode": p.proxy_mode,
            })

        if not type and not status:
            channels = db.query(models.BrandChannel).all()
            results.extend([
                {
                    "id": c.channel_id,
                    "email": getattr(c, "account_email", None) or "no-email@viraloop.ai",
                    "status": "ACTIVE" if getattr(c, "is_active", True) else "INACTIVE",
                    "profile_type": "BRAND"
                } for c in channels
            ])

        return results
    except Exception as e:
        logger.error(f"Failed to list profiles: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

@router.get("/{channel_id}")
def get_profile_details(channel_id: str, db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == channel_id).first()
    if profile:
        return profile
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.channel_id == channel_id).first()
    if channel:
        return channel
    raise HTTPException(status_code=404, detail="Profile not found")