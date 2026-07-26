print("!!! [DEBUG] WORKER FILE LOADED (WINDOWS NATIVE) !!!")
import threading
import queue
import logging
import time
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

print(f"!!! [DEBUG] Python: {sys.executable}")
print(f"!!! [DEBUG] CWD: {os.getcwd()}")

from app.services.upload_orchestrator import upload_orchestrator
from app.services.workflow_runner import workflow_runner_singleton
from app.database import SessionLocal
from app.services.verification_worker import verification_worker

logger = logging.getLogger(__name__)

class NativeQueueWorker:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        self.task_queue = queue.Queue()
        self.running = True
        self.profile_busy = {}
        self.profile_lock = threading.Lock()
        self.executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="UploadWorker")
        self.scheduler_thread = threading.Thread(target=self._process_scheduler, daemon=True, name="NativeUploadScheduler")
        self.scheduler_thread.start()
        logger.info("✅ Native Queue Worker Started (Concurrent Mode - one per isolated profile)")

    def add_task(self, item_id: int):
        logger.info(f"📥 [NativeQueue] Adding item {item_id} to queue")
        self.task_queue.put(item_id)

    def _resolve_profile_id(self, item_id: int) -> str:
        """WorkQueueItem이 어느 프로필(IP)에 속하는지 확인"""
        from app import models
        db = SessionLocal()
        try:
            item = db.query(models.WorkQueueItem).filter(models.WorkQueueItem.id == item_id).first()
            if not item:
                return None
            yt_config = (item.platform_configs or {}).get('youtube', {})
            channel_id = yt_config.get('channel_id')
            if not channel_id:
                return None
            channel = db.query(models.YouTubeChannel).filter(models.YouTubeChannel.channel_id == channel_id).first()
            if channel and getattr(channel, 'owner_profile_id', None):
                return channel.owner_profile_id
            return channel_id
        finally:
            db.close()

    def _process_scheduler(self):
        """메인 스케줄러: 큐에서 항목을 꺼내 워커 쓰레드에 할당"""
        while self.running:
            try:
                item_id = self.task_queue.get(timeout=1.0)
                profile_id = self._resolve_profile_id(item_id)
                
                if profile_id and self._try_claim_profile(profile_id):
                    self.executor.submit(self._process_item, item_id, profile_id)
                else:
                    logger.info(f"⏸ [NativeQueue] Item {item_id} (profile={profile_id}) - busy or unknown, re-queuing")
                    self.task_queue.put(item_id)
                    self.task_queue.task_done()
                    
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"❌ [NativeQueue] Scheduler Error: {e}")
                time.sleep(1)

    def _process_item(self, item_id: int, profile_id: str):
        """개별 워커 쓰레드에서 실행 - 각 프로필이 독립적으 실행"""
        from app import models
        db = SessionLocal()
        try:
            item = db.query(models.WorkQueueItem).filter(models.WorkQueueItem.id == item_id).first()
            
            # 해당 프로필이 이전에 사용된 적 없으면 IP 로테褂
            should_rotate = True
            if hasattr(self, '_profile_first_use'):
                if profile_id in self._profile_first_use:
                    should_rotate = False
            if not hasattr(self, '_profile_first_use'):
                self._profile_first_use = set()
            self._profile_first_use.add(profile_id)
            
            if item and item.source_type == "SOVEREIGN_AI":
                logger.info(f"🚀 [NativeQueue] SOVEREIGN_AI mission for {item_id}")
                try:
                    import asyncio as aio
                    production_result = aio.run(workflow_runner_singleton.execute_workflow_for_mission(db, item_id))
                    logger.info(f"🎨 Production Success: {production_result.get('video_path')}")
                except Exception as prod_err:
                    logger.error(f"❌ Production Failed: {prod_err}")
                    item.status = "FAILED"
                    item.failure_reason = f"Production Error: {str(prod_err)}"
                    db.commit()
                    return

            result = upload_orchestrator.process_item(db, item_id, task_instance=None, force_ip_rotation=should_rotate)
            logger.info(f"✅ [NativeQueue] Finished item {item_id}: {result}")
        except Exception as e:
            logger.error(f"❌ [NativeQueue] Error processing {item_id}: {e}")
        finally:
            db.close()
            with self.profile_lock:
                if profile_id:
                    self.profile_busy.pop(profile_id, None)

    def _try_claim_profile(self, profile_id: str) -> bool:
        with self.profile_lock:
            if profile_id in self.profile_busy:
                return False
            self.profile_busy[profile_id] = True
            return True

native_worker = NativeQueueWorker()

if __name__ == "__main__":
    print(">>> [DEBUG] ENTERING KEEP-ALIVE LOOP <<<")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("🛑 Stopping worker...")
        native_worker.running = False