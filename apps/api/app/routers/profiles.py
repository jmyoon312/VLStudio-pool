from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import logging

from app.database import get_db
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["profiles"])
@router.get("")
def list_profiles(db: Session = Depends(get_db)):
    """List all available brand channel profiles for SwarmHub selection"""
    try:
        channels = db.query(models.BrandChannel).all()
        return [
            {
                "id": c.channel_id,
                "email": getattr(c, 'account_email', None) or "no-email@viraloop.ai",
                "status": "ACTIVE" if getattr(c, 'is_active', True) else "INACTIVE",
                "profile_type": "BRAND"
            } for c in channels
        ]
    except Exception as e:
        logger.error(f"❌ Failed to list profiles: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

@router.get("/{channel_id}")
def get_profile_details(channel_id: str, db: Session = Depends(get_db)):
    """Get specific profile details"""
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.channel_id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Profile not found")
    return channel
