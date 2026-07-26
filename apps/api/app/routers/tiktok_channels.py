
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app import models

router = APIRouter(tags=["tiktok_channels"])

# === Schemas ===
class TikTokChannelCreate(BaseModel):
    id: str # username
    browser_profile_id: str
    nickname: Optional[str] = None

class TikTokChannelResponse(BaseModel):
    id: str
    browser_profile_id: str
    nickname: Optional[str]
    status: str
    follower_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# === Endpoints ===

@router.get("/", response_model=List[TikTokChannelResponse])
def get_tiktok_channels(db: Session = Depends(get_db)):
    return db.query(models.TikTokChannel).all()

@router.post("/", response_model=TikTokChannelResponse)
def add_tiktok_channel(
    channel_in: TikTokChannelCreate, 
    db: Session = Depends(get_db)
):
    # Check if profile exists
    profile = db.query(models.BrowserProfile).filter(models.BrowserProfile.id == channel_in.browser_profile_id).first()
    if not profile:
        raise HTTPException(404, "Browser Profile not found")
        
    # Check if channel exists
    existing = db.query(models.TikTokChannel).filter(models.TikTokChannel.id == channel_in.id).first()
    if existing:
        raise HTTPException(400, "Channel already exists")

    channel = models.TikTokChannel(
        id=channel_in.id,
        browser_profile_id=channel_in.browser_profile_id,
        nickname=channel_in.nickname,
        status="ACTIVE"
    )
    
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel

@router.delete("/{channel_id}")
def delete_tiktok_channel(channel_id: str, db: Session = Depends(get_db)):
    channel = db.query(models.TikTokChannel).filter(models.TikTokChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    db.delete(channel)
    db.commit()
    return {"message": "Channel deleted"}
