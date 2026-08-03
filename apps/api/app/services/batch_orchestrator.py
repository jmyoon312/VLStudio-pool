import asyncio
import logging
from typing import List, Dict, Any

from app.services.ai_editor import analyze_video
from app.services.video_cutter import cut_video, extract_audio
from app.services.tts_service import TTSService
from app.services.tts_preset_manager import TTSPresetManager
from app.services.capcut_generator import CapCutGenerator

logger = logging.getLogger(__name__)

class BatchJobOrchestrator:
    """
    Manages concurrent batch processing of multiple videos for Douyin Studio Pro.
    """
    def __init__(self, max_concurrent: int = 5):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.tts_service = TTSService()
        self.preset_manager = TTSPresetManager()
        self.active_jobs = {} # Tracking status

    async def _process_single_video(self, job_id: str, video_path: str, output_dir: str, script_data: Optional[Dict[str, Any]] = None):
        try:
            # 1. AI Vision Analysis (Mocked in ai_editor.py)
            if script_data:
                self.active_jobs[job_id] = "Bypassing Vision Analysis (Using Saved Script)"
                # Construct a mock ai_result object that behaves like VideoAnalysisResult
                class MockAIResult:
                    def __init__(self, data):
                        self.scenes = data.get("scenes", [])
                ai_result = MockAIResult(script_data)
                await asyncio.sleep(0.5)
            else:
                self.active_jobs[job_id] = "Vision Analysis"
                ai_result = await analyze_video(video_path)
                await asyncio.sleep(2) # Simulate processing time
            
            # 2. TTS Generation & SRT Setup
            self.active_jobs[job_id] = "TTS Generation"
            capcut_gen = CapCutGenerator(project_name=f"StudioPro_{job_id}")
            
            # Using either dict or object based on whether it's from bypass or fresh analysis
            scenes = ai_result.scenes if hasattr(ai_result, 'scenes') else getattr(ai_result, 'scenes', [])
            
            for i, scene in enumerate(scenes):
                # Generate TTS audio for each scene if it has speech
                scene_dict = scene if isinstance(scene, dict) else (scene.dict() if hasattr(scene, 'dict') else vars(scene))
                
                speaker = scene_dict.get('speaker', 'Unknown')
                preset = scene_dict.get('tts_preset')
                if preset:
                    logger.info(f"[{job_id}] Scene {i+1}: 사용자가 지정한 TTS 설정({preset}) 적용 중... (Speaker: {speaker})")
                else:
                    logger.info(f"[{job_id}] Scene {i+1}: 기본 분석 기반 TTS 적용 중... (Speaker: {speaker})")
                
                # For demo purposes, we just simulate this with sleep
                await asyncio.sleep(1)
                
            # 3. Video Slicing / Editing
            self.active_jobs[job_id] = "Cut Editing"
            # Simulate video cutting
            await asyncio.sleep(2)
            
            # 4. Save CapCut Draft
            self.active_jobs[job_id] = "CapCut Rendering"
            import os
            os.makedirs(output_dir, exist_ok=True)
            draft_path = f"{output_dir}/draft_content.json"
            capcut_gen.save_project(draft_path)
            
            await asyncio.sleep(1)
            self.active_jobs[job_id] = "Complete"
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            self.active_jobs[job_id] = f"Error: {str(e)}"

    async def process_batch(self, video_paths: List[str], output_dir: str, scripts_data: Optional[List[Dict[str, Any]]] = None):
        """Processes multiple videos concurrently with a semaphore limit."""
        async def bounded_process(job_id, path, script):
            async with self.semaphore:
                await self._process_single_video(job_id, path, output_dir, script)
                
        tasks = []
        for i, path in enumerate(video_paths):
            job_id = f"batch_{i}"
            script = scripts_data[i] if scripts_data and i < len(scripts_data) else None
            tasks.append(bounded_process(job_id, path, script))
            
        await asyncio.gather(*tasks)
        
    def get_status(self) -> Dict[str, str]:
        return self.active_jobs

# Global instance
batch_orchestrator = BatchJobOrchestrator()
