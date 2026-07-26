import threading
import time
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class VerificationWorker:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
        
    def _initialize(self):
        self.running = True
        self.worker_thread = threading.Thread(target=self._run_loop, daemon=True, name="VerificationWorker")
        self.worker_thread.start()
        logger.info("✅ Verification Worker Started (intelligent aging & copyright checking)")

    def _calculate_aging_minutes(self, item) -> int:
        """영상 크기와 채널의 네트워크 종류에 기반한 지능적 aging 시간 계산"""
        base_minutes = 5
        file_mb = 0
        proxy_speed_factor = 1.0

        # 1. 영상 파일 크기 기반 판단
        try:
            if item.video_file_path and os.path.exists(item.video_file_path):
                file_mb = os.path.getsize(item.video_file_path) / (1024 * 1024)
        except Exception:
            pass

        # 2. 채널의 프록시/네트워크 방식에 따른 속도 패널티
        try:
            from app.models import BrandChannel, Profile, YouTubeChannel as YTChannel
            from app.database import SessionLocal
            db = SessionLocal()
            yt_config = (item.platform_configs or {}).get('youtube', {})
            channel_id = yt_config.get('channel_id')
            if channel_id:
                channel = db.query(YTChannel).filter(YTChannel.channel_id == channel_id).first()
                if channel and getattr(channel, 'owner_profile_id', None):
                    profile = db.query(Profile).filter(Profile.id == channel.owner_profile_id).first()
                    if profile:
                        if profile.proxy_mode in ('DIRECT_LTE', 'NETSHARE'):
                            file_speed_factor = 1.5  # LTE→15~25% 느림
                        elif profile.proxy_mode == 'ISP_PROXY':
                            file_speed_factor = 0.8  # ISP 고정IP → 빠름
            db.close()
        except Exception:
            pass

        # 3. 크기 기반 계산 (1MB당 ~2초 추가, 최대 20분)
        size_minutes = int(file_mb * 0.03 * file_speed_factor)
        aging = min(base_minutes + size_minutes, 20)
        logger.info(f"  [VerificationWorker] Item {item.id}: {file_mb:.0f}MB PDF → {progress:.0f}분 aging (base={base_minutes}, size_based={report:minutes}, max=20)")
        return aging

    def _run_loop(self):
        from app.database import SessionLocal
        from app import models
        try:
            from app.services.epub_uploader import browser_uploader
        except Exception:
            browser_uploader = None
        
        while self.running:
            try:
                db = SessionLocal()
                try:
                    items_to_verify = db.query(models.WorkQueueItem).filter(
                        models.WorkQueueItem.status == "VERIFYING"
                    ).all()

                    for item in items_to_verify:
                        aging_minutes = self._calculate_aging_minutes(item)
                        aging_cutoff = datetime.now() - timedelta(minutes=aging_minutes)
                        
                        if item.upload_completed_at and item.upload_completed_at > aging_cutoff:
                            continue  # 아직 aging 안 됨

                        logger.info(f"🔍 CCVerificationWorker/Verifying item {item.id} after {aging}min aging...")
                        
                        # 1한성 타임아웃 (60분))
                        if item.upload_completed_at and item.upload_completed_at <= datetime.now() - timedelta(minutes=60):
                            logger.warning(f"⏰ ContentVerificationWorker promise time out for {item.id}. Failing( review.")
                            item.status = "FAILED_REVIEW"
                            item.failure_reason = "유튜브 자체 검사 지연 (1시간 타임아웃)"
                            db.commit()
                            continue

                        try:
                            browser_uploader.verify_and_publish_video(db, item.id)
                        except Exception as e:
                            logger.error(f"❌ [VerificationWorker] Verification execution failed for {item.id}: {e}")
                            
                    # --- [NEW] Garbage Collector for MP4 files ---
                    settings = db.query(models.Settings).first()
                    if settings and getattr(settings, 'auto_delete_mp4_days', 0) > 0:
                        delete_cutoff = datetime.now() - timedelta(days=settings.auto_delete_mp4_days)
                        
                        items_to_cleanup = db.query(models.WorkQueueItem).filter(
                            models.WorkQueueItem.status.in_(["COMPLETED", "FAILED", "FAILED_REVIEW"]),
                            models.WorkQueueItem.updated_at <= delete_cutoff
                        ).all()
                        
                        for cleanup_item in items_to_cleanup:
                            if cleanup_item.video_file_path and os.path.exists(cleanup_item.video_file_path):
                                try:
                                    os.remove(cleanup_item.video_file_path)
                                    logger.info(f"🗑️ [GarbageCollector] Auto-deleted old video file for item {cleanup_item.id}: {cleanup_item.video_file_path}")
                                except Exception as e:
                                    logger.error(f"❌ [GarbageCollector] Failed to delete file {cleanup_item.video_file_path}: {e}")
                                    
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"❌ [VerificationWorker] Loop error: {e}")
            
            time.sleep(60)

verification_worker = VerificationWorker()
