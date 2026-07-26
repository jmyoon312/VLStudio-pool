from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from .. import crud, schemas, database, models
from fastapi.responses import RedirectResponse, JSONResponse
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
import os
import json
from cryptography.fernet import Fernet
from datetime import datetime
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# [CONFIGURATION & DECOUPLING]
# Zero source-code pollution: all dynamic keys, secrets, database are stored outside source tree
storage_dir = os.environ.get("VIRALOOP_STORAGE_DIR", os.path.join(os.getcwd(), "..", ".."))
if not os.path.isabs(storage_dir):
    storage_dir = os.path.abspath(storage_dir)

# Ensure credentials directory exists outside the code
credentials_dir = os.path.join(storage_dir, "credentials")
os.makedirs(credentials_dir, exist_ok=True)

CLIENT_SECRETS_FILE = os.path.join(credentials_dir, "client_secret.json")
KEY_FILE = os.path.join(credentials_dir, "fernet_key.key")

# Migration Support: If legacy credentials exist in local workspace directories,
# safely copy/migrate them to the decoupled path to prevent active session logs/tokens decryption loss!
legacy_paths = [
    os.path.join(os.getcwd(), "backend", "credentials", "fernet_key.key"),
    os.path.join(os.getcwd(), "backend", "client_secret.json"),
    os.path.join(os.getcwd(), "..", "..", "backend", "credentials", "fernet_key.key"),
    os.path.join(os.getcwd(), "..", "..", "backend", "client_secret.json")
]

import shutil

# Migrate Fernet key if missing in decoupled directory
if not os.path.exists(KEY_FILE):
    for lp in legacy_paths:
        if "fernet_key.key" in lp and os.path.exists(lp):
            try:
                shutil.copy2(lp, KEY_FILE)
                logger.info(f"[Migration] Successfully migrated legacy Fernet key from {lp}")
                break
            except Exception as e:
                logger.warn(f"[Migration] Failed to migrate key from {lp}: {e}")

# Migrate Client secrets if missing in decoupled directory
if not os.path.exists(CLIENT_SECRETS_FILE):
    for lp in legacy_paths:
        if "client_secret.json" in lp and os.path.exists(lp):
            try:
                shutil.copy2(lp, CLIENT_SECRETS_FILE)
                logger.info(f"[Migration] Successfully migrated client_secret.json from {lp}")
                break
            except Exception as e:
                logger.warn(f"[Migration] Failed to migrate secrets from {lp}: {e}")

SCOPES = [
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.upload', # Ensure we ask for upload
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

# [PERSISTENT ENCRYPTION KEY]
if os.path.exists(KEY_FILE):
    with open(KEY_FILE, "rb") as kf:
        ENCRYPTION_KEY = kf.read().decode()
else:
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    with open(KEY_FILE, "wb") as kf:
        kf.write(ENCRYPTION_KEY.encode())

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_token(token: str) -> str:
    if not token: return None
    return cipher_suite.encrypt(token.encode()).decode()

def decrypt_token(token: str) -> str:
    if not token: return None
    try:
        return cipher_suite.decrypt(token.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return None

@router.get("/login_url")
def login(request: Request, action: str = "worker", login_hint: str = None):
    """
    Generate Google OAuth URL.
    action: 'worker' (add new worker) or 'channel' (add channel to worker)
    """
    if not os.path.exists(CLIENT_SECRETS_FILE):
        return JSONResponse(status_code=400, content={"error": "client_secret.json not found. Please upload it."})

    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, scopes=SCOPES)
        
        # Redirect to generic callback
        # Use request.base_url to verify correct scheme/host
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}/auth/callback"
        
        # [FIX] Force HTTPS if Behind Proxy (e.g., ngrok/Nginx)
        if "localhost" not in redirect_uri and "127.0.0.1" not in redirect_uri:
            if redirect_uri.startswith("http://"):
                redirect_uri = redirect_uri.replace("http://", "https://", 1)

        flow.redirect_uri = redirect_uri
        
        auth_url_kwargs = {
            'access_type': 'offline',
            'include_granted_scopes': 'true',
            'prompt': 'consent', # Force refresh token
            'state': action
        }
        
        if login_hint and login_hint != "prompt": # "prompt" is not a login hint, it's UI behavior
            auth_url_kwargs['login_hint'] = login_hint
            
        authorization_url, state = flow.authorization_url(**auth_url_kwargs)
        
        return {"url": authorization_url}
    except Exception as e:
        logger.error(f"Login URL Error: {e}")
        return JSONResponse(status_code=500, content={"error": f"Failed to generate login URL: {str(e)}"})

@router.get("/callback")
def callback(request: Request, state: str = None, code: str = None, db: Session = Depends(database.get_db)):
    """
    Handle OAuth callback.
    state: passed back from login_url (indicates action)
    """
    if not code:
        return {"error": "No code provided"}

    # Reconstruct the same redirect_uri
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/auth/callback"
    
    if "localhost" not in redirect_uri and "127.0.0.1" not in redirect_uri:
        if redirect_uri.startswith("http://"):
            redirect_uri = redirect_uri.replace("http://", "https://", 1)
    
    try:
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, scopes=SCOPES, state=state)
        flow.redirect_uri = redirect_uri
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # 1. Get User Info (Worker Identity)
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        email = user_info.get('email')
        name = user_info.get('name')
        picture = user_info.get('picture')
        
        if not email:
            return {"error": "Could not retrieve email"}
            
        # Encrypt Token
        refresh_token = credentials.refresh_token
        encrypted_token = encrypt_token(refresh_token) if refresh_token else None
            
        # 2. Upsert Worker Account
        worker = db.query(models.WorkerAccount).filter(models.WorkerAccount.email == email).first()
        if not worker:
            worker = models.WorkerAccount(
                email=email,
                name=name,
                picture=picture,
                is_active=True,
                refresh_token=encrypted_token # Save token!
            )
            db.add(worker)
            db.commit()
            db.refresh(worker)
        else:
            # Update info & Token if provided
            worker.name = name
            worker.picture = picture
            if encrypted_token:
                worker.refresh_token = encrypted_token
            db.commit()

        # 3. Action Specific Logic
        action_result = {"worker": {"id": worker.id, "email": worker.email, "name": worker.name}}
        
        # If action is channel, we strictly try to find channels and link them
        # BUT with new Sync Logic, we don't necessarily have to.
        # We can just redirect back and let the user click "Sync".
        # However, for backward compat and "Add Channel" flow, we keep it.
        
        if state == "channel": # 브랜드 채널 등록 요청
            youtube = build('youtube', 'v3', credentials=credentials)
            channels_response = youtube.channels().list(
                part='snippet,contentDetails',
                mine=True
            ).execute()
            
            if channels_response.get('items'):
                # Iterate all? Or just first? Original logic was first.
                yt_channel = channels_response['items'][0]
                channel_id = yt_channel['id']
                channel_title = yt_channel['snippet']['title']
                thumbnail = yt_channel['snippet']['thumbnails'].get('default', {}).get('url')
                
                # [수정됨] BrandChannel 테이블 조회 및 저장
                existing = db.query(models.BrandChannel).filter(models.BrandChannel.channel_id == channel_id).first()
                
                access_token = credentials.token
                
                if existing:
                    existing.worker_id = worker.id
                    if encrypted_token:
                        existing.refresh_token = encrypted_token
                    existing.access_token = access_token 
                    existing.thumbnail_url = thumbnail
                    existing.title = channel_title
                    existing.is_active = True
                    db.commit()
                    action_result['channel'] = {"id": existing.id, "title": existing.title, "status": "updated"}
                else:
                    new_channel = models.BrandChannel(
                        title=channel_title,
                        channel_id=channel_id,
                        worker_id=worker.id,
                        refresh_token=encrypted_token,
                        access_token=access_token,
                        thumbnail_url=thumbnail,
                        is_active=True
                    )
                    db.add(new_channel)
                    db.commit()
                    action_result['channel'] = {"title": new_channel.title, "status": "created"}
            else:
                action_result['warning'] = "No YouTube channel found for this account."
        
        # Redirect back to frontend
        # Assuming frontend is on same host port 5173 for dev
        # Production should use env var
        frontend_url = "http://localhost:5183/distribution-manager" 
        # Better: use a query param or default
        
        return RedirectResponse(f"{frontend_url}?status=success")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/workers")
def get_workers(db: Session = Depends(database.get_db)):
    workers = db.query(models.WorkerAccount).all()
    return workers

@router.delete("/workers/{worker_id}")
def delete_worker(worker_id: int, db: Session = Depends(database.get_db)):
    worker = db.query(models.WorkerAccount).filter(models.WorkerAccount.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    # [Security] Clear tokens from associated channels before deleting worker
    # Since BrandChannel has a backref 'brand_channels' from WorkerAccount (defined in models.py)
    # We can access them directly.
    for channel in worker.brand_channels:
        channel.worker_id = None
        channel.refresh_token = None
        channel.access_token = None
        channel.is_active = False # Deactivate channel as it has no valid token
        
    db.delete(worker)
    db.commit()
    return {"message": "Worker deleted successfully and associated tokens cleared."}

@router.get("/config/status")
def get_config_status(db: Session = Depends(database.get_db)):
    """
    Check if client_secret.json is configured and return worker count.
    """
    is_configured = os.path.exists(CLIENT_SECRETS_FILE)
    worker_count = db.query(models.WorkerAccount).count()
    return {
        "configured": is_configured, 
        "path": CLIENT_SECRETS_FILE if is_configured else None,
        "worker_count": worker_count
    }

@router.post("/config/secrets")
async def upload_secrets(file: UploadFile = File(...)):
    """
    Upload client_secret.json for Google OAuth.
    """
    try:
        content = await file.read()
        # Verify JSON
        json.loads(content)
        
        # Save to backend folder
        with open(CLIENT_SECRETS_FILE, "wb") as f:
            f.write(content)
            
        return {"message": "Secrets updated successfully"}
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON file")
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/config/secrets")
def delete_secrets():
    """
    Delete client_secret.json to reset configuration.
    """
    if os.path.exists(CLIENT_SECRETS_FILE):
        try:
            os.remove(CLIENT_SECRETS_FILE)
            return {"message": "Secrets deleted successfully"}
        except Exception as e:
             raise HTTPException(500, f"Failed to delete secrets: {str(e)}")
    return {"message": "No secrets file found"}
