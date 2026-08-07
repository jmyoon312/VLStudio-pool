from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from .. import database, models, schemas
from googleapiclient.discovery import build
from .auth import decrypt_token, ENCRYPTION_KEY # Import helper functions
from cryptography.fernet import Fernet
import json

router = APIRouter(tags=["brand-channels"])

@router.get("/", response_model=List[schemas.BrandChannel])
def get_brand_channels(db: Session = Depends(database.get_db)):
    # Only return active channels by default
    return db.query(models.BrandChannel).filter(models.BrandChannel.is_active == True).all()

@router.delete("/{channel_id}")
def delete_brand_channel(channel_id: int, db: Session = Depends(database.get_db)):
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Brand Channel not found")
    
    # Soft delete
    channel.is_active = False 
    db.commit()
    return {"ok": True}

@router.patch("/{channel_id}", response_model=schemas.BrandChannel)
def update_brand_channel(channel_id: int, update: schemas.BrandChannelUpdate, db: Session = Depends(database.get_db)):
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Brand Channel not found")
    
    if update.default_privacy is not None:
        channel.default_privacy = update.default_privacy
    if update.default_tags is not None:
        channel.default_tags = update.default_tags
    if update.growth_phase is not None:
        channel.growth_phase = update.growth_phase
        
    # [UPDATED] Stealth Protocol
    if hasattr(update, 'tin_can_account_id') and update.tin_can_account_id is not None:
        channel.tin_can_account_id = update.tin_can_account_id
    if hasattr(update, 'captain_account_id') and update.captain_account_id is not None:
        channel.captain_account_id = update.captain_account_id
        
    db.commit()
    db.refresh(channel)
    return channel

# [DEPRECATED] Worker Sync logic removed in Stealth Protocol.
# New auth flow will be handled via TinCanWizard and specific Resource endpoints.

from fastapi import BackgroundTasks
from app.services.stealth_ops_v2 import stealth_ops  # [UPDATED] Use v2
from datetime import datetime

@router.post("/{channel_id}/warmup")
def trigger_channel_warmup(
    channel_id: str, 
    background_tasks: BackgroundTasks, 
    stage: int = 1,
    captain_id: str = None, # [Optional] context for fallback search
    db: Session = Depends(database.get_db)
):
    """
    [Incubator] Trigger automated warmup routine for a specific Brand Channel.
    - Uses assigned Captain Profile.
    - Runs in background (StealthOps).
    """
    # [Fix] Query by channel_id (string UC...) instead of DB ID (int) for robustness
    print(f"DEBUG: Requesting Warmup for channel_id='{channel_id}' captain_id='{captain_id}'")
    
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.channel_id == channel_id).first()
    
    # [Fallback 1] specific owner search (matches list_captain_channels logic)
    if not channel and captain_id:
        print(f"[WARN] Direct lookup failed. Trying owner-based lookup for captain_id='{captain_id}'...")
        owner_channels = db.query(models.BrandChannel).filter(models.BrandChannel.owner_profile_id == captain_id).all()
        for ch in owner_channels:
             # loose match
            if ch.channel_id == channel_id:
                channel = ch
                print("   -> Match found via owner list (Exact)!")
                break
            if ch.channel_id.strip() == channel_id.strip():
                channel = ch
                print("   -> Match found via owner list (Strip)!")
                break
    
    # [Fallback 2] Full Scan (Last Resort)
    if not channel:
        print(f"[WARN] Owner lookup failed. checking ALL channels...")
        all_channels = db.query(models.BrandChannel).all()
        for ch in all_channels:
            if ch.channel_id == channel_id:
                channel = ch
                break
            if ch.channel_id.strip() == channel_id.strip():
                channel = ch
                break
                
    if not channel:
        print("[FAIL] Still not found after ALL scans.")
        raise HTTPException(status_code=404, detail=f"Brand Channel '{channel_id}' not found. Check server logs.")
        
    if not channel.captain_account:
        raise HTTPException(status_code=400, detail="No Captain assigned to this channel.")
    
    # Update Status
    channel.warmup_status = "RUNNING"
    channel.warmup_last_run = datetime.now()
    if stage > 0:
        channel.warmup_stage = stage
    db.commit()
    
    # Wrapper for Background Task to handle DB updates on completion
    def _warmup_task_wrapper(profile_id, channel_title, db_id, stage_num):
        success = stealth_ops.run_warmup_routine(profile_id, channel_title, stage_num)
        
        # New DB Session for background thread
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_ch = bg_db.query(models.BrandChannel).filter(models.BrandChannel.id == db_id).first()
            if bg_ch:
                bg_ch.warmup_status = "COMPLETED" if success else "FAILED"
                bg_db.commit()
        except Exception as e:
            print(f"Failed to update warmup status: {e}")
        finally:
            bg_db.close()

    # Launch Background Task
    background_tasks.add_task(
        _warmup_task_wrapper, 
        str(channel.captain_account.id), 
        channel.title,
        channel.id,
        stage
    )
    
    return {"status": "Warmup Started", "stage": stage, "captain": channel.captain_account.id}