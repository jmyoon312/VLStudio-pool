
import json
import logging
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger(__name__)

class CredentialManager:
    @staticmethod
    def get_credentials(db: Session, brand_channel_id: int) -> Credentials:
        """
        Constructs a google.oauth2.credentials.Credentials object.
        Combines:
        1. Client Config from Parent TinCanAccount (client_id, client_secret)
        2. Refresh Token from BrandChannel
        """
        brand_channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == brand_channel_id).first()
        if not brand_channel:
            raise ValueError(f"BrandChannel {brand_channel_id} not found")
            
        tin_can = brand_channel.tin_can_account
        if not tin_can or not tin_can.client_secret_json:
             raise ValueError(f"BrandChannel {brand_channel.title} has no valid TinCan Owner with JSON")

        if not brand_channel.refresh_token:
            raise ValueError(f"BrandChannel {brand_channel.title} is not authenticated (Missing Refresh Token). Please Auth via Captain's Quarters.")

        try:
             client_config = json.loads(tin_can.client_secret_json)
             # Handle both "installed" and "web" formats
             app_info = client_config.get('installed') or client_config.get('web')
             if not app_info:
                 raise ValueError("Invalid client_secret.json format")

             creds = Credentials(
                 token=brand_channel.access_token,
                 refresh_token=brand_channel.refresh_token,
                 token_uri=app_info.get('token_uri', 'https://oauth2.googleapis.com/token'),
                 client_id=app_info['client_id'],
                 client_secret=app_info['client_secret'],
                 scopes=['https://www.googleapis.com/auth/youtube.upload']
             )
             
             # Automatic Refresh check
             if not creds.valid:
                 if creds.expired and creds.refresh_token:
                     logger.info(f"Refreshing token for {brand_channel.title}...")
                     creds.refresh(Request())
                     # Save new access token
                     brand_channel.access_token = creds.token
                     db.commit()
                 else:
                     raise ValueError("Token invalid and cannot be refreshed.")
                     
             return creds

        except Exception as e:
            logger.error(f"Credential Build Failed: {e}")
            raise e

# Helpers for encryption ( placeholders if needed )
def encrypt_token(token: str) -> str:
    return token 

def decrypt_token(token: str) -> str:
    return token
