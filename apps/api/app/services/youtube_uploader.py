
import os
import json
import logging
import asyncio
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

from app import models
from app.services.credential_manager import CredentialManager, encrypt_token, decrypt_token
from app.services.adb_service import adb_service
from app.services.upload_priority import (
    get_upload_priority_manager, 
    UploadMethod,
    UploadPriorityManager
)

logger = logging.getLogger(__name__)


class YouTubeAPIError(Exception):
    """Custom exception for YouTube API errors"""
    def __init__(self, message: str, error_code: str = None, retryable: bool = True):
        super().__init__(message)
        self.error_code = error_code
        self.retryable = retryable


class YouTubeUploader:
    
    @staticmethod
    def upload_video(db: Session, item_id: int):
        """
        Orchestrates the Stealth Upload Logic for WorkQueueItems:
        1. Config Check
        2. Auth Resolution (TinCan)
        3. Stealth Guard (IP Check)
        4. Upload
        """
        item = db.query(models.WorkQueueItem).filter(models.WorkQueueItem.id == item_id).first()
        if not item:
            logger.error(f"WorkQueueItem {item_id} not found.")
            return

        try:
            # --- 1. Validation ---
            if not item.video_file_path or not os.path.exists(item.video_file_path):
                raise Exception("File missing")
                
            # Resolve Channel ID from Platform Configs
            # WorkQueueItem stores channel_id in platform_configs['youtube']['channel_id']
            yt_config = item.platform_configs.get('youtube', {})
            channel_id = yt_config.get('channel_id')
            
            if not channel_id:
                raise Exception("No YouTube Channel ID specified in platform configs")

            # Find BrandChannel
            brand_channel = db.query(models.BrandChannel).filter(models.BrandChannel.channel_id == channel_id).first()
            if not brand_channel:
                 # If using API upload, we MUST have a BrandChannel record (Authorized)
                 raise Exception(f"Brand Channel {channel_id} not found in database")
                 
            tin_can = brand_channel.tin_can_account
            if not tin_can:
                raise Exception("No TinCan Owner assigned to this Brand Channel")
                
            if tin_can.status != "ACTIVE":
                raise Exception(f"TinCan Account is {tin_can.status}")

            # [DEATH_VALLEY Blocker] Uploads are strictly forbidden in this recovery mode
            if brand_channel.youtube_channel and brand_channel.youtube_channel.cultivation_strategy == "DEATH_VALLEY":
                raise Exception("Uploads are blocked during Death Valley recovery. The channel is in pure viewer mode.")

            # --- 2. Stealth Guard (IP Rotation) ---
            # Only if proxy_config is None (meaning using local/ADB)
            if not tin_can.proxy_config:
                current_ip = adb_service.get_current_ip()
                logger.info(f"Stealth Guard: Current IP {current_ip}, Last Used: {tin_can.last_upload_ip}")
                
                if tin_can.last_upload_ip and tin_can.last_upload_ip == current_ip:
                    logger.warning("IP Match Detected! Initiating Stealth Rotation Protocol...")
                    
                    # 1. Try Soft Rotation (Data Toggle)
                    logger.info("Attempting Soft Rotation (Data Toggle)...")
                    adb_service.rotate_ip(method='soft')
                    import time
                    time.sleep(5) 
                    current_ip = adb_service.get_current_ip()
                    
                    if current_ip == tin_can.last_upload_ip:
                        logger.warning("Soft Rotation Failed. Retrying Soft Rotation...")
                        # 2. Try Soft Rotation again instead of Hard
                        adb_service.rotate_ip(method='soft')
                        time.sleep(5)
                        current_ip = adb_service.get_current_ip()
                    
                    # 3. Final Verification
                    if current_ip == tin_can.last_upload_ip:
                         logger.error("Stealth Failure: IP Rotation unsuccessful. Aborting.")
                         raise Exception("Stealth Guard: IP Rotation Failed")
                    
                    logger.info(f"IP Rotated Successfully: {current_ip}")
                
                # Update IP record
                tin_can.last_upload_ip = current_ip
                db.commit()

            # --- 3. Auth Headers & Network Binding ---
            creds = CredentialManager.get_credentials(db, brand_channel.id)
            
            # [Stealth] Bind to specific network interface if tethering is active
            interface_ip = adb_service.get_tethering_interface_ip()
            if interface_ip:
                logger.info(f"Stealth Fortress: Binding traffic to Mobile Interface ({interface_ip})")
                try:
                    import httplib2
                    import google_auth_httplib2
                    
                    bound_http = httplib2.Http(source_address=(interface_ip, 0), timeout=600)
                    authorized_http = google_auth_httplib2.AuthorizedHttp(creds, http=bound_http)
                    service = build("youtube", "v3", http=authorized_http, cache_discovery=False)
                except Exception as e:
                    logger.warning(f"Stealth Binding Failed ({e}). Falling back to default route.")
                    service = build("youtube", "v3", credentials=creds, cache_discovery=False)
            else:
                service = build("youtube", "v3", credentials=creds, cache_discovery=False)

            # --- 4. Metadata Preparation (NEW LOGIC) ---
            privacy = yt_config.get('privacy', 'private')
            
            # Construct Description
            # Append Hashtags to Description
            description = item.description or ""
            if item.hashtags:
                # item.hashtags should be a list of strings ["#Shorts", "#Viral"]
                # Ensure they are joined by space
                joined_hashtags = " ".join(item.hashtags) if isinstance(item.hashtags, list) else str(item.hashtags)
                description += f"\n\n{joined_hashtags}"
            
            description += "\n\nUploaded via ViraLoop Stealth"

            # Prepare Tags
            # item.tags is a list (JSON column)
            final_tags = item.tags if isinstance(item.tags, list) else []
            # Merge with channel defaults if any
            if brand_channel.default_tags:
                try:
                    defaults = json.loads(brand_channel.default_tags)
                    final_tags = list(set(final_tags + defaults))
                except: pass

            body = {
                'snippet': {
                    'title': item.title[:100], 
                    'description': description,
                    'tags': final_tags,
                    'categoryId': yt_config.get('category', '22')
                },
                'status': {
                    'privacyStatus': privacy,
                    'selfDeclaredMadeForKids': yt_config.get('made_for_kids', False)
                }
            }

            # --- 5. Upload Execution ---
            logger.info(f"Starting Upload for {item.title}...")
            item.status = "UPLOADING"
            item.upload_progress = 0
            db.commit()

            media_body = MediaFileUpload(item.video_file_path, chunksize=-1, resumable=True)
            request = service.videos().insert(part='snippet,status', body=body, media_body=media_body)
            
            # Execute upload
            response = request.execute()

            # --- 6. Success Handling ---
            item.status = "COMPLETED"
            item.upload_progress = 100
            item.upload_completed_at = datetime.utcnow()
            
            # Save Uploaded URL
            vid_id = response.get("id")
            if vid_id:
                urls = item.uploaded_urls or {}
                urls['youtube'] = f"https://youtu.be/{vid_id}"
                item.uploaded_urls = urls
            
            # Record successful upload
            priority_manager = get_upload_priority_manager()
            channel_id = yt_config.get('channel_id')
            if channel_id:
                priority_manager.record_attempt(
                    channel_id=channel_id,
                    method=UploadMethod.API,
                    success=True
                )
            
            db.commit()
            logger.info(f"Upload Success! ID: {vid_id}")

        except HttpError as e:
            logger.error(f"Google API Error: {e}")
            
            # Parse error details
            error_details = e.error_details() if hasattr(e, 'error_details') else {}
            error_reason = error_details.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')
            
            # Determine if retryable
            retryable_errors = ['quotaExceeded', 'rateLimitExceeded', 'serviceUnavailable', 'backendError']
            is_retryable = error_reason in retryable_errors
            
            # Record attempt
            priority_manager = get_upload_priority_manager()
            channel_id = yt_config.get('channel_id')
            if channel_id:
                priority_manager.record_attempt(
                    channel_id=channel_id,
                    method=UploadMethod.API,
                    success=False,
                    error=f"{error_reason}: {str(e)}"
                )
                
                # Check if should fall back to browser
                if is_retryable:
                    fallback = priority_manager.get_fallback_method(UploadMethod.API, e)
                    if fallback == UploadMethod.BROWSER_AUTO:
                        logger.warning(f"📤 API failed with {error_reason}, recommending browser fallback")
            
            item.status = "FAILED"
            item.failure_reason = f"API Error ({error_reason}): {str(e)}"
            db.commit()
            
            raise YouTubeAPIError(str(e), error_code=error_reason, retryable=is_retryable)
            
        except Exception as e:
            logger.error(f"Upload Logic Error: {e}")
            item.status = "FAILED"
            item.failure_reason = str(e)
            db.commit()
            
            # Record non-retryable error
            priority_manager = get_upload_priority_manager()
            channel_id = yt_config.get('channel_id')
            if channel_id:
                priority_manager.record_attempt(
                    channel_id=channel_id,
                    method=UploadMethod.API,
                    success=False,
                    error=str(e)
                )
            
            raise

youtube_uploader = YouTubeUploader()
