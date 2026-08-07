
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app import models, crud
from app.config import settings as app_settings
from app.routers.browser_profiles import launch_browser_profile

router = APIRouter(tags=["notebooklm"])

class NotebookLMAccountCreate(BaseModel):
    id: str
    browser_profile_id: Optional[str] = None

class NotebookLMAccountResponse(BaseModel):
    id: str
    browser_profile_id: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    notebook_count: Optional[int] = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotebookLMAccountResponse])
def get_notebooklm_accounts(db: Session = Depends(get_db)):
    return db.query(models.NotebookLMAccount).all()

@router.post("/", response_model=NotebookLMAccountResponse)
def create_notebooklm_account(account_in: NotebookLMAccountCreate, db: Session = Depends(get_db)):
    account = models.NotebookLMAccount(
        id=account_in.id,
        browser_profile_id=account_in.browser_profile_id
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account

@router.post("/quick-register")
def quick_register_notebooklm_account(data: dict = Body(...), db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    if not email:
        raise HTTPException(400, "Email is required")
    
    import uuid
    import os
    profile_id = str(uuid.uuid4())
    db_settings = crud.get_settings(db)
    media_base = db_settings.root_download_path if db_settings and db_settings.root_download_path else app_settings.MEDIA_ROOT
    base_path = os.path.join(media_base, "04_Profiles")
    user_data_dir = os.path.join(base_path, profile_id)
    
    profile = db.query(models.Profile).filter(models.Profile.email == email).first()
    if not profile:
        profile = models.Profile(
            id=profile_id,
            email=email,
            password=password,
            usage_type="DEEP_RESEARCH",
            status="ACTIVE",
            folder_path=user_data_dir
        )
        db.add(profile)
        db.flush()
    else:
        if password:
            profile.password = password
        
    b_profile = db.query(models.BrowserProfile).filter(models.BrowserProfile.id == profile.id).first()
    if not b_profile:
        b_profile = models.BrowserProfile(
            id=profile.id,
            name=f"Research_{email.split('@')[0]}",
            user_data_dir=profile.folder_path
        )
        db.add(b_profile)
        db.flush()

    account = db.query(models.NotebookLMAccount).filter(models.NotebookLMAccount.id == email).first()
    if not account:
        account = models.NotebookLMAccount(
            id=email,
            browser_profile_id=profile.id,
            status="ACTIVE"
        )
        db.add(account)
    
    db.commit()
    return {"status": "SUCCESS", "email": email, "profile_id": profile.id}

@router.post("/{account_id}/launch")
def launch_notebooklm_browser(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.NotebookLMAccount).filter(models.NotebookLMAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "Account not found")
        
    profile = db.query(models.Profile).filter(models.Profile.id == account.browser_profile_id).first()
    if not profile:
        raise HTTPException(404, "Browser profile not found")

    try:
        from app.services.stealth_ops_v2 import DrissionStealth
        stealth = DrissionStealth(db=db)
        
        success = stealth.launch_for_setup(
            profile_id=account.browser_profile_id, 
            db=db,
            email=profile.email,
            password=profile.password
        )
        
        if not success:
            raise HTTPException(500, "Failed to launch browser")
            
        return {
            "status": "SUCCESS",
            "url": "", # [HYBRID] No URL needed, browser opens on Windows desktop
            "profile_id": account.browser_profile_id,
            "message": "[FALLBACK] Browser launched on Windows Desktop! Please check your taskbar."
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import logging
        logging.error(f"Launch failed for {account_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(500, f"Launch failed: {str(e)}")

@router.delete("/{account_id}")
def delete_notebooklm_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(models.NotebookLMAccount).filter(models.NotebookLMAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "Account not found")
    db.delete(account)
    db.commit()
    return {"message": "Account deleted"}
