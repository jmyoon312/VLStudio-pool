import asyncio
import json
import logging
import os
import requests
from datetime import datetime

from app.services.redis_queue import RedisTaskQueue
from app.services.remotion_renderer import RemotionRenderer
from app.services.video.ffmpeg_service import FFmpegService
from app.config import settings

logger = logging.getLogger("EliteWorker")
logging.basicConfig(level=logging.INFO)

class EliteWorker:
    def __init__(self):
        # Configuration for Remotion
        frontend_dir = os.getenv("REMOTION_FRONTEND_DIR", "/home/jmyoon/ViraLoop/apps/dashboard")
        self.remotion = RemotionRenderer(frontend_dir=frontend_dir)
        self.ffmpeg = FFmpegService(settings)
        self.broadcast_url = f"http://localhost:8000/api/swarm/broadcast"

    def broadcast(self, message: str, type: str = "task_progress", session_id: str = None, action: dict = None):
        """Broadcast progress to all connected UI clients via Swarm WebSocket."""
        try:
            requests.post(self.broadcast_url, json={
                "message": message,
                "type": type,
                "session_id": session_id,
                "action": action
            }, timeout=2)
        except Exception as e:
            logger.warning(f"[WARN] [EliteWorker] Broadcast failed: {e}")

    async def process_task(self, task: dict):
        task_id = task.get("task_id")
        task_type = task.get("type")
        video_id = task.get("video_id")
        engine = task.get("engine", "remotion")
        beats = task.get("beats", [])

        if task_type != "beats_render":
            logger.info(f"⏩ [EliteWorker] Skipping non-render task: {task_type}")
            return

        logger.info(f"[FALLBACK] [EliteWorker] Starting Render Task: {task_id} | Engine: {engine}")
        self.broadcast(f"지휘관님, [{engine.upper()}] 엔진을 가동하여 영상 렌더링을 시작합니다.", session_id=task_id)

        try:
            output_filename = f"render_{video_id}_{task_id}.mp4"
            output_path = os.path.join(settings.TEMP_DIR, output_filename)

            if engine == "remotion":
                # Remotion Logic: Use first beat or combine? 
                # For Elite Studio, we usually render the whole sequence.
                props = {
                    "videoId": video_id,
                    "beats": beats,
                    "audio_src": "",
                    "bgm_src": "",
                    "bgm_volume": 0.1,
                    "aspect_ratio": "9:16",
                    "metadata": {"generated_at": datetime.now().isoformat()}
                }
                await self.remotion.render_video(composition_id="EliteSequence", props=props, output_path=output_path)
            
            else:
                # Hyperframes Logic: Use FFmpeg for creative layering
                logger.info(f"[TURBO] [Hyperframes] Executing FFmpeg assembly for {len(beats)} beats...")
                # We run this in a thread to avoid blocking the async loop
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.ffmpeg.render_beats_hyperframes, beats, video_id)

            self.broadcast(f"[OK] 작전 완료! 렌더링이 성공적으로 끝났습니다.", type="task_complete", session_id=task_id, action={
                "type": "navigate",
                "params": {"path": f"/video-preview/{video_id}?task={task_id}"}
            })
            
            # Update status in Redis (Implicitly handled by being DONE)
            logger.info(f"[OK] [EliteWorker] Task {task_id} Completed")

        except Exception as e:
            logger.error(f"[FAIL] [EliteWorker] Render Failed: {e}")
            self.broadcast(f"[FAIL] 렌더링 중 오류가 발생했습니다: {str(e)}", type="task_failed", session_id=task_id)

    async def run(self):
        logger.info("📡 [EliteWorker] Listening for Elite Command Studio tasks...")
        while True:
            try:
                task = RedisTaskQueue.pop(timeout=5)
                if task:
                    await self.process_task(task)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"[FIRE] [EliteWorker] Loop Error: {e}")
                await asyncio.sleep(5)

if __name__ == "__main__":
    worker = EliteWorker()
    asyncio.run(worker.run())
