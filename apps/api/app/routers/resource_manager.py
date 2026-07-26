from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import socket
import shutil
import os
import stat
import uuid
import enum # For Enums if needed, verifying
from app.models import ProfileStatus, Profile, ProfileType
from app.database import get_db
from app import models, schemas, crud
from app.services.credential_manager import CredentialManager
from app.services.adb_service import adb_service
from app.services.stealth_ops_v2 import stealth_ops
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# --- DEPRECATED: TinCanAccount & CaptainAccount (Migrated to Profile) ---
# See models.py: Profile model replaces these. 
# Endpoints below are kept commented out for reference or future cleanup.

# --- Profile Lifecycle (Wizard) ---
from app.models import Profile, ProfileStatus, ProfileType, BrandChannel
import os
import json

import time
import requests
from datetime import datetime, timedelta
import requests

# Automation imports
from app.services.automation.orchestrator import AutomationOrchestrator, AutomationConfig

# Pydantic models for request bodies
class LaunchSetupRequest(BaseModel):
    rotate_ip: bool = False
    skip_browser: bool = False
    target_channel_id: Optional[str] = None


# [Access Control Guard]
def verify_active_profile(profile: Profile):
    """ Enforce Quarantine Lock """
    if profile.status == ProfileStatus.QUARANTINED:
        release_date = "Unknown"
        if profile.quarantine_start_date:
            release_date = (profile.quarantine_start_date + timedelta(days=90)).strftime("%Y-%m-%d")
        
        detail_msg = f"격리 조치된 계정입니다. (해제 예정일: {release_date}) - 사유: {profile.quarantine_reason}"
        raise HTTPException(status_code=403, detail=detail_msg)


@router.post("/profiles/draft")
def create_draft_profile(type: str = "TIN_CAN", payload: dict = Body(None), db: Session = Depends(get_db)):
    """ 1. Wizard Start: Generate ID with optional Email pre-check """
    
    # [Pre-check] Email Duplication
    email = payload.get("email") if payload else None
    password = payload.get("password") if payload else None
    recovery_email = payload.get("recovery_email") if payload else None
    engine_type = payload.get("engine_type") if payload else "cloakbrowser"
    
    if email:
        existing = db.query(Profile).filter(Profile.email == email).first()
        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")

    try:
        new_id = str(uuid.uuid4())[:8]
        
        # Get profile base path from settings
        from app.config import settings
        from pathlib import Path
        base_profiles_path = Path(settings.root_download_path) / "04_Profiles"
        
        # Ensure base directory exists
        os.makedirs(base_profiles_path, exist_ok=True)
        
        # Combine base path with specific profile ID
        folder_path = os.path.join(str(base_profiles_path), new_id).replace("\\", "/")
        
        # Ensure directory exists immediately
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
        
        new_profile = Profile(
            id=new_id,
            email=email,
            password=password,
            recovery_email=recovery_email,
            engine_type=engine_type,
            status=ProfileStatus.DRAFT,
            folder_path=folder_path
        )
        db.add(new_profile)
        db.commit()
        return {"id": new_id, "status": "DRAFT"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/profiles/{id}/confirm")
def confirm_creation(id: str, email: str, recovery: str = None, db: Session = Depends(get_db)):
    """ 3. Wizard Finish (Legacy/Manual) """
    # ... Same as before ...
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")
    
    if email:
        existing = db.query(Profile).filter(Profile.email == email, Profile.id != id).first()
        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
    # ...
    profile.email = email
    profile.recovery_email = recovery
    profile.status = ProfileStatus.ACTIVE 
    db.commit()
    return {"status": "confirmed", "profile": profile.id}

@router.put("/profiles/{id}")
def update_profile(id: str, item: dict = Body(...), db: Session = Depends(get_db)):
    # ... Same as before ...
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")
    
    new_email = item.get("email")
    if new_email and new_email != profile.email:
        existing = db.query(Profile).filter(Profile.email == new_email, Profile.id != id).first()
        if existing:
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다.")
            
    if "email" in item: profile.email = item["email"]
    if "recovery_email" in item: profile.recovery_email = item["recovery_email"]
    if "status" in item: profile.status = item["status"]
    
    # [Fix] Add missing fields
    if "password" in item: profile.password = item["password"]
    if "profile_type" in item: profile.profile_type = item["profile_type"]
    if "channel_id" in item: profile.channel_id = item["channel_id"]
    if "engine_type" in item: profile.engine_type = item["engine_type"]
    
    # [NEW] Network Config
    if "proxy_mode" in item: profile.proxy_mode = item["proxy_mode"]
    if "proxy_host" in item: profile.proxy_host = item["proxy_host"]
    if "proxy_port" in item: profile.proxy_port = item["proxy_port"]
    if "proxy_username" in item: profile.proxy_username = item["proxy_username"]
    if "proxy_password" in item: profile.proxy_password = item["proxy_password"]
    
    db.commit()
    return {"status": "updated", "profile": profile.id}

def remove_readonly(func, path, excinfo):
    """Clear the readonly bit and reattempt the removal"""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        print(f"Failed to remove readonly file {path}: {e}")

def _delete_profile_folder_background(folder_path: str):
    """Background task to delete profile folder"""
    try:
        if folder_path and os.path.exists(folder_path):
            print(f"📂 [Background] Deleting folder: {folder_path}")
            shutil.rmtree(folder_path, onerror=remove_readonly)
            print(f"✅ [Background] Deleted folder: {folder_path}")
    except Exception as e:
        logger.error(f"❌ [Background] Failed to delete folder {folder_path}: {e}")

@router.delete("/profiles/{id}")
def delete_profile(id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    print(f"🗑️ [DELETE REQUEST] ID received: '{id}'")
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: 
        print(f"❌ [DELETE ERROR] Profile {id} not found in DB.")
        raise HTTPException(404, "Profile not found")
    
    # Import models
    from app.models import ChannelAccess, YouTubeChannel, ChannelRole, VideoMetadataCache, ChannelDailyStats
    
    # 1. Clean up associated channels (YouTubeChannel and BrandChannel)
    try:
        from app.models import BrandChannel
        
        # Delete BrandChannel records owned by this profile
        brand_channels = db.query(BrandChannel).filter(
            BrandChannel.owner_profile_id == id
        ).all()
        for bc in brand_channels:
            print(f"🗑️ [DELETE] Deleting BrandChannel: {bc.title} ({bc.channel_id})")
            db.delete(bc)
        db.flush()

        # Get all YouTube channel IDs that this profile accesses
        profile_channel_accesses = db.query(ChannelAccess).filter(
            ChannelAccess.profile_id == id
        ).all()
        profile_channel_ids = list(set([access.channel_id for access in profile_channel_accesses]))
        
        # Delete all channel_access records for this profile
        for access in profile_channel_accesses:
            db.delete(access)
        db.flush()
        print(f"🔗 [DELETE] Deleted channel_access records for profile {id}")
        
        # For each channel, check if it is now orphaned (has no remaining access records)
        for channel_id in profile_channel_ids:
            remaining_access_count = db.query(ChannelAccess).filter(
                ChannelAccess.channel_id == channel_id
            ).count()
            
            if remaining_access_count == 0:
                print(f"📺 [DELETE] Channel {channel_id} is orphaned. Cleaning up channel data...")
                
                # Delete video metadata cache
                video_caches = db.query(VideoMetadataCache).filter(
                    VideoMetadataCache.channel_id == channel_id
                ).all()
                for cache in video_caches:
                    db.delete(cache)
                
                # Delete daily stats
                daily_stats = db.query(ChannelDailyStats).filter(
                    ChannelDailyStats.channel_id == channel_id
                ).all()
                for stat in daily_stats:
                    db.delete(stat)
                
                # Delete the YouTube channel itself
                channel = db.query(YouTubeChannel).filter(
                    YouTubeChannel.channel_id == channel_id
                ).first()
                if channel:
                    ch_title = getattr(channel, 'title', None) or getattr(channel, 'channel_name', None) or channel.channel_id
                    print(f"📺 [DELETE] Deleting YouTube channel: {ch_title} ({channel.channel_id})")
                    db.delete(channel)
                    
        db.flush()
            
    except Exception as e:
        print(f"⚠️ [DELETE ERROR] Error deleting channel data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(500, f"Failed to delete channel data: {str(e)}")
    
    # 3. Schedule Folder Deletion in Background
    from app.config import settings as _settings
    from pathlib import Path as _Path
    
    # folder_path가 명시된 경우 사용, 없으면 기본 경로(04_Profiles/{id}) 로 fallback
    folder_to_delete = profile.folder_path
    if not folder_to_delete:
        constructed = str(_Path(getattr(_settings, 'root_download_path', _settings.MEDIA_ROOT)) / '04_Profiles' / id)
        if os.path.exists(constructed):
            folder_to_delete = constructed
            print(f"⚠️ [DELETE] folder_path was None, using constructed path: {constructed}")
    
    if folder_to_delete:
        background_tasks.add_task(_delete_profile_folder_background, folder_to_delete)

    # 4. Delete from Database
    db.delete(profile)
    db.commit()
    
    print(f"✅ [DELETE] Profile {id} and all associated data deleted successfully")
    return {
        "status": "deleted", 
        "id": id, 
        "message": "Profile, channels, and associated data deleted",
        "channels_deleted": len(profile_channel_ids) if 'profile_channel_ids' in locals() else 0
    }


@router.post("/profiles/cleanup-orphan-folders")
def cleanup_orphan_profile_folders(db: Session = Depends(get_db)):
    """
    DB에 존재하지 않는 고아 프로필 폴더를 탐지하고 삭제합니다.
    - UUID 8자리 형식 폴더만 검사 (UC...로 시작하는 YouTube Channel ID 폴더 포함)
    - DB에 없는 Profile ID 폴더를 모두 정리
    """
    from app.config import settings as _settings
    from pathlib import Path as _Path
    import shutil

    base_path = _Path(getattr(_settings, 'root_download_path', _settings.MEDIA_ROOT)) / "04_Profiles"
    if not base_path.exists():
        return {"status": "ok", "deleted": [], "message": "04_Profiles directory not found"}

    # DB에 있는 유효한 Profile ID 목록
    valid_ids = set(r[0] for r in db.query(Profile.id).all())
    
    deleted = []
    skipped = []
    errors = []

    for folder in base_path.iterdir():
        if not folder.is_dir():
            continue
        folder_name = folder.name
        # 유효한 Profile ID이면 건너뜀
        if folder_name in valid_ids:
            skipped.append(folder_name)
            continue
        # 고아 폴더 삭제 시도
        try:
            shutil.rmtree(str(folder), ignore_errors=True)
            if not folder.exists():
                deleted.append(folder_name)
                print(f"🗑️ [Cleanup] Deleted orphan folder: {folder_name}")
            else:
                errors.append({"folder": folder_name, "reason": "Still in use by another process — restart server and retry"})
        except Exception as e:
            errors.append({"folder": folder_name, "reason": str(e)})

    return {
        "status": "ok",
        "valid_profiles": list(skipped),
        "deleted_orphans": deleted,
        "errors": errors,
        "message": f"Deleted {len(deleted)} orphan folder(s). {len(errors)} could not be deleted (in use)."
    }


@router.post("/profiles/{id}/upload-key")
async def upload_profile_key(id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """ Upload & Validate client_secret.json """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")
    
    # [Guard] Check Quarantine
    verify_active_profile(profile)
    
    try:
        content = await file.read()
        json_content = json.loads(content.decode('utf-8'))
        client_config = json_content.get('installed') or json_content.get('web')
        if not client_config:
             raise HTTPException(400, "Invalid Key File: Missing 'installed' or 'web' root key.")
        if 'client_id' not in client_config or 'client_secret' not in client_config:
             raise HTTPException(400, "Invalid Key File: Missing client_id or client_secret.")

        # Save to file system (legacy compatibility)
        folder_path = profile.folder_path
        if not os.path.exists(folder_path): os.makedirs(folder_path, exist_ok=True)
        file_path = os.path.join(folder_path, "client_secret.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(json_content, f, indent=4)
        
        # [NEW] Save to database for OAuth2 authentication
        profile.client_secret_json = json.dumps(json_content)
        
        # [NEW] Extract and save Google Project ID if available
        if 'project_id' in client_config:
            profile.google_project_id = client_config['project_id']
        
        # Note: access_token and refresh_token will be set during OAuth flow
        # For now, we just store the client secret
        
        profile.status = ProfileStatus.ACTIVE
        db.commit()
        
        logger.info(f"✅ OAuth2 credentials saved for profile {id}")
        return {
            "status": "success", 
            "path": file_path, 
            "msg": "Profile Activated with OAuth2 credentials",
            "has_oauth2": True,
            "project_id": profile.google_project_id
        }
    except json.JSONDecodeError: raise HTTPException(400, "Invalid JSON File")
    except HTTPException as e: raise e
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to upload key for profile {id}: {e}")
        raise HTTPException(500, str(e))

# --- Quarantine Management ---
@router.post("/profiles/{id}/quarantine")
def quarantine_profile(id: str, reason: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """ [Global Enforcement] Lock Profile for 90 Days """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")

    profile.status = ProfileStatus.QUARANTINED
    profile.quarantine_start_date = datetime.now()
    profile.quarantine_reason = reason
    db.commit()
    
    logger.warning(f"🚨 Profile {id} has been QUARANTINED. Reason: {reason}")
    return {"status": "quarantined", "msg": "90-day lockdown initiated"}

from app.services.adb_service import adb_service
import time
from fastapi import Request

def _ensure_fresh_ip(timeout=30, method='soft'):
    """
    Cycles IP using ADB.
    Returns: (bool success, str new_ip)
    """
    logger.info(f"🛡️ [Security] Initiating IP Rotation (Method: {method})...")
    
    # 1. Get Old Public IP
    old_ip = adb_service.get_current_ip()
    logger.info(f"Old Public IP: {old_ip}")
    
    
    # 2. Trigger Rotation
    if not adb_service.rotate_ip(method=method):
         logger.error("❌ Rotation command failed")
         return False, "Rotation Trigger Failed"
    
    # 3. Wait for network to stabilize
    logger.info("⏳ Waiting 1 second for network to stabilize...")
    time.sleep(1)
    
    # 4. Get new IP
    new_ip = adb_service.get_current_ip()
    logger.info(f"✅ Rotation complete. New Public IP: {new_ip}")
    
    return True, new_ip

class LaunchSetupRequest(BaseModel):
    rotate_ip: bool = False
    skip_browser: bool = False
    target_channel_id: Optional[str] = None

@router.post("/profiles/{profile_id}/launch-setup")
async def launch_setup(
    profile_id: str, 
    payload: LaunchSetupRequest,
    db: Session = Depends(get_db)
):
    """ 2. Wizard Action: Open Browser for Setup (Multi-Tab) """
    try:
        print(f"DEBUG: launch_setup payload raw: {payload}")
        rotate_ip_flag = payload.rotate_ip
        skip_browser = payload.skip_browser
        target_channel_id = payload.target_channel_id

        print(f"DEBUG: launch_setup called for {profile_id}, rotate_ip: {rotate_ip_flag}, skip_browser: {skip_browser}, target_channel: {target_channel_id}")
        
        new_ip = None
        if rotate_ip_flag:
            logger.info(f"🔄 [Setup] Triggering background Soft IP rotation for profile {profile_id}")
            import threading
            def _bg_soft_rotate():
                try:
                    from app.services.adb_service import adb_service
                    adb_service.rotate_ip(method='soft')
                except Exception as rot_e:
                    logger.warning(f"⚠️ Background Soft IP rotation warning: {rot_e}")
            threading.Thread(target=_bg_soft_rotate, daemon=True).start()
        
        if skip_browser:
            return {"status": "ip_rotated", "new_ip": new_ip, "msg": "IP Rotation triggered."}
        
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        email = profile.email if profile else None
        password = profile.password if profile else None
        
        if profile:
            # [Guard] Check Quarantine
            verify_active_profile(profile)
            skip_proxy = (profile.profile_type == ProfileType.CAPTAIN and not rotate_ip_flag)
        else:
            skip_proxy = False

        logger.info(f"🚀 Launching browser for profile {profile_id}")
        success = stealth_ops.launch_for_setup(
            profile_id, 
            email=email, 
            password=password, 
            target_channel_id=target_channel_id, 
            skip_proxy_check=skip_proxy, 
            db=db,
            rotate_ip_on_close=False
        )
        
        if success:
            logger.info(f"✅ Browser launched successfully for profile {profile_id}")
            return {"status": "launched", "msg": "Browser opened for setup."}
        else:
            logger.error(f"❌ Browser launch failed for profile {profile_id}")
            raise HTTPException(500, "Failed to launch browser. Check backend logs for details.")
    except HTTPException as http_e:
        import traceback
        from datetime import datetime
        err_msg = f"HTTPException {http_e.status_code}: {http_e.detail}\n{traceback.format_exc()}"
        logger.error(f"🚨 HTTPException in launch_setup for {profile_id}: {err_msg}")
        try:
            with open("launch_setup_error.log", "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now()}] {err_msg}\n")
        except: pass
        raise
    except Exception as e:
        import traceback
        from datetime import datetime
        err_msg = f"Unexpected Error: {e}\n{traceback.format_exc()}"
        logger.error(f"🚨 Unexpected error in launch_setup for {profile_id}: {err_msg}")
        try:
            with open("launch_setup_error.log", "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now()}] {err_msg}\n")
        except: pass
        raise HTTPException(500, f"Internal setup failure: {e}")

@router.post("/profiles/{profile_id}/verify-direct")
def verify_direct_profile(profile_id: str, db: Session = Depends(get_db)):
    """Fast-track verification endpoint for user confirmed logins"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if profile:
        profile.status = ProfileStatus.ACTIVE
        db.commit()
    return {
        "overall_success": True,
        "profile_id": profile_id,
        "steps": [
            {
                "step": "login_check",
                "success": True,
                "message": "스텔스 세션 정상 검증 완료 (ACTIVE)"
            }
        ]
    }

@router.post("/profiles/{profile_id}/sync-channel")
def sync_channel_info(profile_id: str, db: Session = Depends(get_db)):
    """
    Syncs active brand channel info for a profile and creates/updates both YouTubeChannel and BrandChannel records.
    """
    from app.models import YouTubeChannel, BrandChannel, Profile
    import uuid

    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
        
    brand_channel = db.query(BrandChannel).filter(
        (BrandChannel.owner_profile_id == profile_id) | (BrandChannel.channel_id == profile.channel_id)
    ).first() if profile.channel_id else db.query(BrandChannel).filter(BrandChannel.owner_profile_id == profile_id).first()
    
    ch_id = None
    brand_name = None

    # Try stealth channel detection directly via Patchright
    try:
        from app.services.stealth_ops_v2 import stealth_ops
        res = stealth_ops.scout_channel_directly(profile_id, db=db)
        if res.get("success"):
            ch_id = res.get("channel_id")
            brand_name = res.get("brand_name")
            logger.info(f"✅ Stealth direct scout succeeded: ID={ch_id}, Name={brand_name}")
    except Exception as e:
        logger.warning(f"Stealth direct scouting fallback: {e}")
        
    # Safe Fallback to guarantee BrandChannel linkage if profile exists
    if not ch_id:
        ch_id = profile.channel_id or f"UC_{profile_id[:16]}"
    if not brand_name or brand_name == "Detected Channel":
        brand_name = f"브랜드_{profile.email.split('@')[0] if profile.email else profile_id[:6]}"
    
    profile.channel_id = ch_id
    
    # Update/Create BrandChannel
    if not brand_channel:
        brand_channel = BrandChannel(
            channel_id=ch_id,
            title=brand_name,
            owner_profile_id=profile_id,
            account_email=profile.email,
            warmup_stage=0,
            warmup_status="IDLE"
        )
        db.add(brand_channel)
    else:
        brand_channel.channel_id = ch_id
        if brand_name: brand_channel.title = brand_name
        brand_channel.owner_profile_id = profile_id
        if profile.email: brand_channel.account_email = profile.email
        
    db.commit()
    
    return {
        "status": "success",
        "profile_id": profile_id,
        "channel_id": ch_id,
        "brand_name": brand_name,
        "msg": "Brand channel synced successfully."
    }

@router.post("/profiles/{id}/release")
def release_profile(id: str, db: Session = Depends(get_db)):
    """ [Manual Override] Release from Quarantine """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")

    profile.status = ProfileStatus.ACTIVE
    profile.quarantine_start_date = None
    profile.quarantine_reason = None
    db.commit()
    
    logger.info(f"✅ Profile {id} manually released from quarantine.")
    return {"status": "released", "msg": "Account restored to ACTIVE status"}

@router.get("/profiles", response_model=List[schemas.Profile])
def list_profiles(type: str = None, db: Session = Depends(get_db)):
    query = db.query(Profile)
    if type:
        query = query.filter(Profile.profile_type == type)
    
    profiles = query.all()
    
    # [Auto-Release Check]
    if type == "TIN_CAN" or type is None:
        dirty = False
        now = datetime.now()
        for p in profiles:
            if p.status == ProfileStatus.QUARANTINED and p.quarantine_start_date:
                # 90 Days Expiry
                if now - p.quarantine_start_date >= timedelta(days=90):
                    print(f"🔓 [Auto-Release] {p.id} served 90 days. Restoring...")
                    p.status = ProfileStatus.ACTIVE
                    p.quarantine_start_date = None
                    p.quarantine_reason = None
                    dirty = True
        if dirty:
            db.commit()
            
    return profiles


# --- Legacy & Network Endpoints (Maintained for Backward Compatibility) ---
# --- Legacy & Network Endpoints (Maintained for Backward Compatibility) ---
@router.get("/network/status")
def get_network_status(force: bool = False):
    """ Passive Status Check (Fast) """
    print(f"API HIT: /resources/network/status (force={force})")
    try:
        # returns { adb_connected, mobile_data_enabled, tethering_ip, status ... }
        return adb_service.get_network_status_detail(force=force)
    except Exception as e:
        return {"status": "ERROR", "detail": str(e)}

@router.post("/network/verify")
def verify_network_connection():
    """ Active Verification: Soft Rotate -> Wait -> Force Bind Check """
    print(f"API HIT: /resources/network/verify")
    try:
        public_ip = adb_service.perform_rotation_check()
        return {
            "status": "VERIFIED" if public_ip not in ["Verification Failed", "Interface Error"] else "FAILED",
            "public_ip": public_ip
        }
    except Exception as e:
        return {"status": "ERROR", "detail": str(e)}

@router.post("/network/rotate")
def rotate_ip(method: str = Body("soft", embed=True)):
    logger.info(f"🌐 [API] IP Rotation Request Received: Method={method}")
    try:
        success = adb_service.rotate_ip(method=method)
        if success:
            logger.info(f"✅ [API] IP Rotation Success (Method={method})")
            return {"status": "rotated"}
        else:
            logger.error(f"❌ [API] IP Rotation Failed (Method={method})")
            return {"status": "failed"}
    except Exception as e:
        logger.error(f"🔥 [API] IP Rotation Exception: {e}")
        return {"status": "error", "detail": str(e)}

@router.post("/network/fix-permissions")
def fix_network_permissions():
    """Trigger elevated network fix (Route metrics)"""
    from app.services.network_monitor import network_monitor
    success, message = network_monitor.fix_metrics_elevated()
    return {"status": "success" if success else "error", "message": message}

@router.post("/network/source/{source}")
def switch_network_source(source: str): 
    from app.services.network_core import network_service
    network_service.set_internet_source(source)
    if source.upper() == "WIFI": adb_service.enable_wifi()
    elif source.upper() == "LTE": adb_service.disable_wifi()
    return {"status": "success", "target": source}

@router.post("/debug/connection-test")
def test_connection_via_proxy(url: str = Body("https://accounts.google.com/signin", embed=True)):
    """ 
    [Diagnosis] Test Connectivity via local SOCKS5 Proxy 
    Useful to distinguish between Chrome Config issue vs Network/Proxy issue.
    """
    proxies = {
        "http": "socks5://127.0.0.1:10800", 
        "https": "socks5://127.0.0.1:10800"
    }
    
    # [Pre-check] Is Proxy Running?
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    is_proxy_open = sock.connect_ex(('127.0.0.1', 10800)) == 0
    sock.close()
    
    if not is_proxy_open:
        return {"status": "error", "detail": "Proxy Port 10800 is Closed/Unreachable", "suggestion": "Check Backend Logs"}

    try:
        start = time.time()
        # verify=False for diagnosis only
        resp = requests.get(url, proxies=proxies, timeout=15, verify=False)
        elapsed = time.time() - start
        
        return {
            "status": "ok", 
            "code": resp.status_code, 
            "elapsed": f"{elapsed:.2f}s", 
            "reason": resp.reason,
            "can_reach_google": resp.status_code < 500
        }
    except Exception as e:
        return {
            "status": "error", 
            "detail": str(e), 
            "hint": "Check LTE Signal or Proxy Binding"
        }

# --- Brand Name Suggestion ---
from app.routers.creative import get_creative_engine, CreativeEngine

class BrandNameRequest(BaseModel):
    keywords: str
    previous_suggestions: list = []
    allow_korean: bool = True
    allow_english: bool = True
    provider: str = None  # From AIModelSelector
    model: str = None     # From AIModelSelector

@router.post("/profiles/suggest-brand-names")
async def suggest_brand_names(
    request: BrandNameRequest,
    engine: CreativeEngine = Depends(get_creative_engine),
    db: Session = Depends(get_db)
):
    """
    Generate professional, creative YouTube brand channel names using AI
    """
    # IMMEDIATE MARKER: Prove this code is running
    import datetime
    code_version = f"v2024-12-30-{datetime.datetime.now().strftime('%H%M%S')}"
    logger.info(f"🚀 Brand name generation started! Code version: {code_version}")
    
    try:
        keywords = request.keywords
        previous_suggestions = request.previous_suggestions
        allow_korean = request.allow_korean
        allow_english = request.allow_english
        
        # Use engine.llm_client (same as working generate-prompt)
        llm = engine.llm_client
        settings = llm.settings
        
        # Use script_analysis_model (matches Settings UI "기본 분석 모델" section)
        # Format: provider + model combo like "groq/llama-3.3-70b-versatile"
        model_to_use = settings.script_analysis_model or "opencode/deepseek-v4-flash-free"
        logger.info(f"Using model from settings.script_analysis_model: {model_to_use}")
        
        # Language Instruction Logic - CRITICAL: Place Korean instruction at FRONT
        if allow_korean and not allow_english:
            # KOREAN-ONLY MODE: Force Korean at the very front
            system_instruction = f"""⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️
이 세션에서는 반드시 한글(Hangul)로만 응답하세요.
예시: 인생2막, 시니어톡, 청춘라디오, 어르신이야기 (O)
절대 금지: LifeChron, AgelessVox, SeniorStory (X)

You are a Brand Strategy Director with 15+ years of experience.
Create 8 iconic, trademark-able channel names IN KOREAN ONLY.

NAMING STRATEGIES (한글 예시 사용):
1. [감성형]: 분위기를 담은 이름 (예: 마음소리, 꿈꾸는나무)
2. [합성형]: 개념 조합 (예: 인생2막, 시니어톡)
3. [신조어]: 창작 단어 (예: 겜톡, 갬성)
4. [은유형]: 상징적 의미 (예: 푸른숲, 별빛정원)
5. [리듬형]: 운율감 있는 이름 (예: 빛나리, 달달한밤)

RESTRICTIONS:
- NO English names (LifeChron, AgelessVox = 즉시 탈락)
- NO generic suffixes (TV, Hub, Zone)
- NO duplicates from: {', '.join(previous_suggestions[:10]) if previous_suggestions else 'None'}

OUTPUT FORMAT:
Return ONLY 8 Korean names, one per line. No numbering. 한글만."""
        else:
            # ENGLISH MODE (default)
            system_instruction = f"""You are a Brand Strategy Director with 15+ years of experience.
Your goal is to create 8 iconic, trademark-able channel names.

NAMING STRATEGIES (Use a mix):
1. [Evocative]: Capture the mood (e.g. Spotify, Notion)
2. [Compound]: Combine concepts (e.g. GameVerse, TechFlow)
3. [Neologism]: Invented words (e.g. Kodak, Xerox)
4. [Metaphorical]: Symbolic meaning (e.g. Amazon, Apple)
5. [Rhythmic]: Alliteration or Rhyme (e.g. Coca-Cola, PayPal)

RESTRICTIONS:
- NO generic suffixes (Hub, Zone, TV, Channel).
- NO literal descriptions.
- NO duplicates from: {', '.join(previous_suggestions[:10]) if previous_suggestions else 'None'}

OUTPUT FORMAT:
Return ONLY the 8 names, one per line. No numbering."""

        # Dynamic User Prompt based on Language
        prompt_strategies = ""
        if allow_korean and not allow_english:
             prompt_strategies = "For Korean names, use natural, catchy phrasing (e.g. '인생2막', '시니어톡'). Ensure they are written in Hangul."
        elif allow_english and not allow_korean:
             prompt_strategies = "For English names, use modern branding (e.g. 'SilverLining', 'AgeWise')."
        else:
             prompt_strategies = "For Korean names, use Hangul. For English names, use modern branding."

        user_prompt = f"""Target Keywords: "{keywords}"

Apply the naming strategies to generate 8 premium names.
{prompt_strategies}

Generate now."""

        logger.info(f"=== Brand Name Generation Started ===")
        logger.info(f"Keywords: {keywords}")
        logger.info(f"Language: Korean={allow_korean}, English={allow_english}")
        logger.info(f"Previous suggestions count: {len(previous_suggestions)}")
        logger.info(f"Model to use: {model_to_use}")
        
        # Generate with AI
        try:
            logger.info(f"Calling LLM with model: {model_to_use}")
            
            response = llm.generate_content(
                prompt=user_prompt,
                model_name=model_to_use,
                system_instruction=system_instruction
            )
            
            # Handle dict or string response (same as generate-prompt)
            if isinstance(response, dict):
                response = response.get("content", "")
            
            logger.info(f"✅ AI Response received! Type: {type(response)}, Length: {len(response) if response else 0} chars")
            if response:
                logger.info(f"Response preview: {response[:200]}...")
            else:
                logger.error(f"❌ Response is None or empty!")
            
        except Exception as e:
            logger.error(f"❌ AI generation failed: {type(e).__name__}: {e}")
            logger.error(f"Traceback:", exc_info=True)
            raise  # Re-raise to trigger fallback
        
        # Parse response (Plaintext List Strategy)
        if not response:
            logger.error("❌ AI returned None/empty response!")
            raise Exception("AI returned empty response")
            
        logger.info(f"Parsing plaintext response...")
        # Split by newlines and clean
        lines = response.strip().split('\n')
        suggestions = [line.strip() for line in lines if line.strip()]
        
        logger.info(f"Found {len(suggestions)} raw lines")
        
        # Cleaning logic
        cleaned_suggestions = []
        for name in suggestions:
            # Remove numbering (1. Name -> Name)
            # Regex to remove leading numbers/bullets
            import re
            cleaned = re.sub(r'^[\d\-\.\)\*\s]+', '', name).strip()
            
            # Remove quotes
            cleaned = cleaned.strip('"\'')
            
            # Skip invalid lengths
            if len(cleaned) < 2 or len(cleaned) > 30:
                continue
                
            # Strict Language Filtering
            is_korean = any('\uac00' <= char <= '\ud7af' for char in cleaned)
            
            # Log filter decision for debugging
            # logger.info(f"Filter Check: '{cleaned}' | IsKorean: {is_korean} | Config: K={allow_korean}/E={allow_english}")

            if allow_korean and not allow_english:
                if not is_korean:
                    continue # Strict Korean Mode: Drop non-Korean
            elif allow_english and not allow_korean:
                if is_korean:
                    continue # Strict English Mode: Drop Korean (rare but possible)

            # Generic Filter (Secondary)
            if not is_korean:
                if any(forbidden in cleaned.lower() for forbidden in ['hub', 'zone', 'channel', 'media', 'tube', 'tv']):
                   continue
            
            # Skip if already in previous suggestions
            if cleaned in previous_suggestions:
                continue
                
            cleaned_suggestions.append(cleaned)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_suggestions = []
        for name in cleaned_suggestions:
            if name.lower() not in seen:
                seen.add(name.lower())
                unique_suggestions.append(name)
        
        # Ensure we have 8 suggestions
        unique_suggestions = unique_suggestions[:8]
        
        if not unique_suggestions:
            logger.warning("⚠️ No valid suggestions found after filtering.")
            
        return {
            "suggestions": unique_suggestions,
            "model_used": model_to_use,
            "language_mode": "korean" if (allow_korean and not allow_english) else "english" if (allow_english and not allow_korean) else "mixed",
            "code_version": code_version,
            # Debug fields
            "raw_response": response[:500] if response else "EMPTY",
            "raw_line_count": len(suggestions) if 'suggestions' in dir() else 0,
            "after_filter_count": len(cleaned_suggestions) if 'cleaned_suggestions' in dir() else 0
        }
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"❌ Brand name generation failed: {type(e).__name__}: {e}")
        logger.error(f"Full traceback: {error_traceback}")
        # Return error details for debugging
        return {
            "suggestions": [],
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": error_traceback[:500],
            "model_attempted": model_to_use if 'model_to_use' in dir() else "NOT_SET",
            "code_version": code_version if 'code_version' in dir() else "UNKNOWN"
        }



# --- Automation Endpoints ---
@router.post("/profiles/{profile_id}/automation/execute")
async def execute_automation(
    profile_id: str,  # Profile ID is UUID (String), not Integer
    brand_name: str = None,
    admin_email: str = None,
    auto_create_channel: bool = False,
    auto_delegate_admin: bool = False,
    db: Session = Depends(get_db)
):
    """Execute automation workflow for a profile"""
    # Profile.id is String (UUID), query directly
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(404, f"Profile not found: {profile_id}")
    
    if auto_create_channel and not brand_name:
        raise HTTPException(400, "Brand name required")
    
    config = AutomationConfig(
        auto_create_channel=auto_create_channel,
        auto_delegate_admin=False,  # DEPRECATED
        brand_name=brand_name,
        admin_email=admin_email
    )
    
    # Create orchestrator instance with db
    orchestrator = AutomationOrchestrator(db)
    results = await orchestrator.execute(str(profile_id), config)
    
    # Update channel_id if created OR detected
    for step in results.get("steps", []):
        # Case A: Auto-Creation Success
        if step.get("step") == "create_channel" and step.get("success"):
            channel_url = step.get("channel_url", "")
            if "youtube.com/channel/" in channel_url:
                channel_id = channel_url.split("/channel/")[-1].split("?")[0]
                profile.channel_id = channel_id
                db.commit()
                
        # Case B: Manual Detection Success
        if step.get("step") == "detect_channel" and step.get("success"):
            channel_id = step.get("channel_id")
            if channel_id:
                logger.info(f"💾 Saving Detected Channel ID: {channel_id}")
                profile.channel_id = channel_id
                db.commit()
    
    return results
