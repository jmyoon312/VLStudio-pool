"""
OAuth2 Authentication Endpoints
Handles Google OAuth2 authentication flow for YouTube API access
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import json
import logging
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from app.database import get_db
from app.models import Profile
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

router = APIRouter()

# OAuth2 configuration
SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
]

def _get_redirect_uri(request_url: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(request_url)
    scheme = parsed.scheme or "https"
    host = parsed.netloc or "127.0.0.1:8000"
    return f"{scheme}://{host}/api/oauth2/callback"


@router.get("/oauth2/authorize/{profile_id}")
async def start_oauth2_flow(profile_id: str, db: Session = Depends(get_db)):
    """
    Start OAuth2 authentication flow
    
    Args:
        profile_id: Profile ID to authenticate
        
    Returns:
        Redirect to Google OAuth2 consent screen
    """
    # Get profile
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if not profile.client_secret_json:
        raise HTTPException(400, "No client_secret.json uploaded for this profile")
    
    try:
        # Parse client secret
        client_config = json.loads(profile.client_secret_json)
        
        # Create OAuth2 flow
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        # [PRO] Use state to track profile_id through the flow
        state_data = json.dumps({"profile_id": profile_id})
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',  # Request refresh token
            include_granted_scopes='true',
            prompt='consent',  # Force consent screen to get refresh token
            state=state_data   # Pass profile_id in state
        )
        
        logger.info(f"Starting OAuth2 flow for profile {profile_id}")
        return RedirectResponse(url=authorization_url)
        
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid client_secret.json format")
    except Exception as e:
        logger.error(f"Failed to start OAuth2 flow: {e}")
        raise HTTPException(500, f"Failed to start OAuth2 flow: {str(e)}")


@router.get("/oauth2/callback")
async def oauth2_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    """
    OAuth2 callback endpoint
    
    Args:
        code: Authorization code from Google
        state: State parameter (optional)
        
    Returns:
        Success message with profile info
    """
    try:
        # [PRO] Identify profile from state parameter
        profile_id = None
        if state:
            try:
                state_json = json.loads(state)
                profile_id = state_json.get("profile_id")
            except:
                pass
        
        if profile_id:
            profile = db.query(Profile).filter(Profile.id == profile_id).first()
        else:
            # Fallback (Legacy)
            profile = db.query(Profile).filter(
                Profile.client_secret_json.isnot(None),
                Profile.refresh_token.is_(None)
            ).first()
        
        if not profile:
            raise HTTPException(400, "Waiting profile not found. Please try again.")
        
        # Parse client secret
        client_config = json.loads(profile.client_secret_json)
        
        # Create flow
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        # Exchange authorization code for tokens
        flow.fetch_token(code=code)
        
        # Get credentials
        credentials = flow.credentials
        
        # Save tokens to database
        profile.access_token = credentials.token
        profile.refresh_token = credentials.refresh_token
        profile.token_expiry = credentials.expiry
        
        db.commit()
        
        logger.info(f"OAuth2 authentication successful for profile {profile.id}")
        
        return {
            "status": "success",
            "message": "OAuth2 authentication completed",
            "profile_id": profile.id,
            "email": profile.email,
            "has_access_token": bool(profile.access_token),
            "has_refresh_token": bool(profile.refresh_token)
        }
        
    except Exception as e:
        logger.error(f"OAuth2 callback error: {e}")
        raise HTTPException(500, f"Authentication failed: {str(e)}")


@router.post("/oauth2/authenticate/{profile_id}")
async def start_oauth2_with_profile(profile_id: str, db: Session = Depends(get_db)):
    """
    Start OAuth2 authentication using profile's isolated Chrome profile
    
    Args:
        profile_id: Profile ID to authenticate
        
    Returns:
        Status message
    """
    # Get profile
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if not profile.client_secret_json:
        raise HTTPException(400, "No client_secret.json uploaded for this profile")
    
    if not profile.folder_path:
        raise HTTPException(400, "No Chrome profile path configured")
    
    try:
        # Parse client secret
        client_config = json.loads(profile.client_secret_json)
        
        # Extract OAuth2 config
        if 'installed' in client_config:
            oauth_config = client_config['installed']
        elif 'web' in client_config:
            oauth_config = client_config['web']
        else:
            raise HTTPException(400, "Invalid client_secret.json format")
        
        client_id = oauth_config['client_id']
        
        # [PRO] Use state to track profile_id through the flow
        state_data = json.dumps({"profile_id": profile_id})
        
        auth_params = {
            'client_id': client_id,
            'redirect_uri': REDIRECT_URI,
            'response_type': 'code',
            'scope': ' '.join(SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state_data
        }
        
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(auth_params)}"
        
        # Launch Chrome with profile's isolated profile
        import subprocess
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        chrome_args = [
            chrome_path,
            f"--user-data-dir={profile.folder_path}",
            "--no-first-run",
            "--no-default-browser-check",
            "--new-window",
            # [FIX] Chrome uses commas for bypass list separation. 
            # 127.0.0.1 is more reliable than 'localhost' for proxy bypass literals.
            "--proxy-bypass-list=127.0.0.1,localhost,<-loopback>,<local>",
            auth_url
        ]
        
        subprocess.Popen(chrome_args)
        
        logger.info(f"Started OAuth2 flow for profile {profile_id} with isolated Chrome profile")
        
        return {
            "status": "started",
            "message": "OAuth2 authentication started in isolated Chrome profile",
            "profile_id": profile_id
        }
        
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid client_secret.json format")
    except Exception as e:
        logger.error(f"Failed to start OAuth2 flow: {e}")
        raise HTTPException(500, f"Failed to start OAuth2 flow: {str(e)}")


@router.get("/oauth2/status/{profile_id}")
async def check_oauth2_status(profile_id: str, db: Session = Depends(get_db)):
    """
    Check OAuth2 authentication status
    
    Args:
        profile_id: Profile ID to check
        
    Returns:
        Authentication status
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    has_tokens = bool(profile.access_token and profile.refresh_token)
    
    return {
        "authenticated": has_tokens,
        "has_access_token": bool(profile.access_token),
        "has_refresh_token": bool(profile.refresh_token),
        "token_expiry": profile.token_expiry.isoformat() if profile.token_expiry else None
    }
