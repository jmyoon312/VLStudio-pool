"""
OAuth2 Credential Manager for YouTube API
Handles Google OAuth2 credentials loading, validation, and token refresh
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from app.models import Profile

logger = logging.getLogger(__name__)


class OAuth2Manager:
    """
    Google OAuth2 인증 관리자
    """
    
    SCOPES = [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
        'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
    ]
    
    @staticmethod
    def load_credentials(profile: Profile) -> Optional[Credentials]:
        """
        Profile의 OAuth2 정보로 Credentials 객체 생성
        
        Args:
            profile: Profile object with OAuth2 data
            
        Returns:
            Credentials object or None if not configured
        """
        if not profile.client_secret_json:
            logger.warning(f"No client_secret_json for profile {profile.id}")
            return None
        
        if not profile.refresh_token:
            logger.warning(f"No refresh_token for profile {profile.id}")
            return None
        
        try:
            # Parse client secret JSON
            client_config = json.loads(profile.client_secret_json)
            
            # Extract OAuth2 config (supports both 'installed' and 'web' app types)
            if 'installed' in client_config:
                oauth_config = client_config['installed']
            elif 'web' in client_config:
                oauth_config = client_config['web']
            else:
                logger.error(f"Invalid client_secret.json format for profile {profile.id}")
                return None
            
            # Create Credentials object
            credentials = Credentials(
                token=profile.access_token,
                refresh_token=profile.refresh_token,
                token_uri=oauth_config['token_uri'],
                client_id=oauth_config['client_id'],
                client_secret=oauth_config['client_secret'],
                scopes=OAuth2Manager.SCOPES
            )
            
            # Set expiry if available
            if profile.token_expiry:
                credentials.expiry = profile.token_expiry
            
            logger.info(f"Loaded credentials for profile {profile.id}")
            return credentials
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse client_secret_json for profile {profile.id}: {e}")
            return None
        except KeyError as e:
            logger.error(f"Missing key in client_secret_json for profile {profile.id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error loading credentials for profile {profile.id}: {e}")
            return None
    
    @staticmethod
    def refresh_token_if_needed(profile: Profile, db: Session) -> Optional[Credentials]:
        """
        토큰 만료 확인 및 자동 갱신
        
        Args:
            profile: Profile object
            db: Database session
            
        Returns:
            Refreshed Credentials or None if failed
        """
        credentials = OAuth2Manager.load_credentials(profile)
        
        if not credentials:
            return None
        
        try:
            # Check if token is expired or will expire soon (within 5 minutes)
            if credentials.expired or (
                credentials.expiry and 
                credentials.expiry < datetime.utcnow() + timedelta(minutes=5)
            ):
                logger.info(f"Token expired or expiring soon for profile {profile.id}, refreshing...")
                
                # Refresh the token
                credentials.refresh(Request())
                
                # Update database
                profile.access_token = credentials.token
                profile.token_expiry = credentials.expiry
                db.commit()
                
                logger.info(f"Token refreshed successfully for profile {profile.id}")
            else:
                logger.debug(f"Token still valid for profile {profile.id}")
            
            return credentials
            
        except Exception as e:
            logger.error(f"Failed to refresh token for profile {profile.id}: {e}")
            return None
    
    @staticmethod
    def build_youtube_service(credentials: Credentials, service_name: str = 'youtube', version: str = 'v3'):
        """
        Build YouTube API service
        
        Args:
            credentials: OAuth2 Credentials
            service_name: 'youtube' or 'youtubeAnalytics'
            version: API version
            
        Returns:
            YouTube API service object
        """
        try:
            service = build(service_name, version, credentials=credentials)
            logger.info(f"Built {service_name} {version} service successfully")
            return service
        except Exception as e:
            logger.error(f"Failed to build {service_name} service: {e}")
            raise
    
    @staticmethod
    def validate_credentials(profile: Profile) -> bool:
        """
        Validate that profile has all required OAuth2 credentials
        
        Args:
            profile: Profile object
            
        Returns:
            True if credentials are valid, False otherwise
        """
        if not profile.client_secret_json:
            logger.warning(f"Profile {profile.id} missing client_secret_json")
            return False
        
        if not profile.refresh_token:
            logger.warning(f"Profile {profile.id} missing refresh_token")
            return False
        
        # Try to parse client_secret_json
        try:
            client_config = json.loads(profile.client_secret_json)
            if 'installed' not in client_config and 'web' not in client_config:
                logger.warning(f"Profile {profile.id} has invalid client_secret_json format")
                return False
        except json.JSONDecodeError:
            logger.warning(f"Profile {profile.id} has malformed client_secret_json")
            return False
        
        logger.info(f"Profile {profile.id} has valid OAuth2 credentials")
        return True
