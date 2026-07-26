"""
Instagram Reels 업로더
기존 ADB 서비스 및 IP 로테이션 통합
"""

import os
import json
import logging
import time
import random
from pathlib import Path
from typing import Optional, Dict, Any
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ChallengeRequired, PleaseWaitFewMinutes

logger = logging.getLogger(__name__)


class InstagramUploader:
    """
    Instagram Reels 업로더 (instagrapi 사용)
    기존 ADB 서비스와 통합하여 안전한 업로드
    """
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.client = Client()
        self.session_file = f"sessions/instagram_{username}.json"
        
        # 세션 디렉토리 생성
        os.makedirs("sessions", exist_ok=True)
    
    def login(self) -> bool:
        """
        로그인 (세션 재사용)
        기존 ADB 서비스로 IP 확인
        """
        
        # IP 확인 (기존 ADB 서비스 활용)
        try:
            from app.services.adb_service import adb_service
            current_ip = adb_service.get_current_ip()
            logger.info(f"[Instagram] Current IP: {current_ip}")
        except Exception as e:
            logger.warning(f"[Instagram] IP check failed: {e}")
        
        # 기존 세션 로드 시도
        if os.path.exists(self.session_file):
            try:
                self.client.load_settings(self.session_file)
                self.client.login(self.username, self.password)
                
                # 세션 유효성 확인
                self.client.get_timeline_feed()
                logger.info(f"✅ [Instagram] Logged in with existing session: {self.username}")
                return True
            
            except Exception as e:
                logger.warning(f"⚠️ [Instagram] Existing session invalid: {e}")
        
        # 새로 로그인
        try:
            logger.info(f"[Instagram] Attempting new login for {self.username}")
            
            self.client.login(self.username, self.password)
            
            # 세션 저장
            self.client.dump_settings(self.session_file)
            logger.info(f"✅ [Instagram] New session created: {self.username}")
            return True
        
        except ChallengeRequired as e:
            logger.error(f"❌ [Instagram] 2FA required: {e}")
            return False
        
        except PleaseWaitFewMinutes as e:
            logger.error(f"❌ [Instagram] Rate limited: {e}")
            return False
        
        except Exception as e:
            logger.error(f"❌ [Instagram] Login failed: {e}")
            return False
    
    def upload_reel(
        self,
        video_path: str,
        caption: str,
        thumbnail_path: Optional[str] = None,
        hashtags: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Reels 업로드
        """
        
        # 캡션에 해시태그 추가
        full_caption = caption
        if hashtags:
            hashtag_str = ' '.join([f'#{tag}' for tag in hashtags])
            full_caption = f"{caption}\n\n{hashtag_str}"
        
        try:
            logger.info(f"[Instagram] Uploading reel: {video_path}")
            
            # Reels 업로드
            media = self.client.clip_upload(
                path=Path(video_path),
                caption=full_caption,
                thumbnail=Path(thumbnail_path) if thumbnail_path else None
            )
            
            logger.info(f"✅ [Instagram] Upload successful: {media.code}")
            
            return {
                "status": "success",
                "media_id": media.pk,
                "code": media.code,
                "url": f"https://www.instagram.com/reel/{media.code}/"
            }
        
        except Exception as e:
            logger.error(f"❌ [Instagram] Upload failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def logout(self):
        """로그아웃"""
        try:
            self.client.logout()
            logger.info(f"[Instagram] Logged out: {self.username}")
        except Exception as e:
            logger.warning(f"[Instagram] Logout error: {e}")


class SafeInstagramUploader(InstagramUploader):
    """
    안전한 Instagram 업로더 (Rate Limiting 적용)
    """
    
    def __init__(self, username: str, password: str):
        super().__init__(username, password)
        self.last_upload_time = 0
        self.min_delay = 300  # 5분 최소 간격
    
    def upload_reel_safe(self, *args, **kwargs) -> Dict[str, Any]:
        """
        Rate Limiting이 적용된 안전한 업로드
        """
        
        # 최소 대기 시간 확인
        elapsed = time.time() - self.last_upload_time
        if elapsed < self.min_delay:
            wait_time = self.min_delay - elapsed
            logger.info(f"⏳ [Instagram] Waiting {wait_time:.0f}s for rate limit...")
            time.sleep(wait_time)
        
        # 랜덤 지연 (30초~60초)
        random_delay = random.randint(30, 60)
        logger.info(f"⏳ [Instagram] Random delay: {random_delay}s")
        time.sleep(random_delay)
        
        # 업로드
        result = self.upload_reel(*args, **kwargs)
        
        self.last_upload_time = time.time()
        return result
