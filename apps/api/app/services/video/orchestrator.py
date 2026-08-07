import logging
from .image_service import ImageService
from .audio_service import AudioService
from .ffmpeg_service import FFmpegService
from .subtitle_service import SubtitleService
from .higgsfield_service import HiggsfieldService

logger = logging.getLogger(__name__)

class VideoOrchestrator:
    """
    Orchestrates the modular video generation process.
    Replaces the legacy VideoGenClient with a service-oriented architecture.
    """
    def __init__(self, settings):
        self.settings = settings
        self.image = ImageService(settings)
        self.audio = AudioService(settings)
        self.ffmpeg = FFmpegService(settings)
        self.subtitle = SubtitleService(settings)
        self.higgsfield = HiggsfieldService(settings)

    async def produce_scene_assets(self, scene_id: int, script: str, prompt: str, tts_config: dict, sub_config: dict, aspect_ratio: str = "9:16", manual_asset_path: str = None, frozen_effect: str = "static"):
        """
        Coordinates the generation of image, audio, and subtitles for a scene.
        [UPDATED] Supports manual asset overrides and freeze effects.
        """
        logger.info(f"[FALLBACK] Producing assets for Scene #{scene_id} (Manual: {bool(manual_asset_path)})")
        
        # 1. Image/Video Acquisition
        image_path = None
        if manual_asset_path:
            # Use provided path if it exists locally
            if os.path.exists(manual_asset_path):
                image_path = manual_asset_path
                logger.info(f"[OK] Using manual asset for Scene #{scene_id}: {image_path}")
            else:
                 logger.warning(f"[WARN] Manual asset path not found: {manual_asset_path}. Falling back to AI Gen.")
        
        if not image_path:
            # AI Generation (Default)
            image_path = self.image.generate_scene_image(scene_id, prompt)
        
        # 2. Audio Generation (Async)
        audio_path = await self.audio.generate_scene_audio(scene_id, script, tts_config)
        
        # 3. Get Audio Duration
        from app.video_engine import get_audio_metadata
        duration = get_audio_metadata(audio_path)
        
        # 4. Timeline Adjustment for Manual Videos
        # If the manual asset is a video and shorter than audio, we apply the freeze effect
        if image_path.lower().endswith(('.mp4', '.mov', '.avi', '.mkv')):
             # Apply freeze logic
             image_path = self.ffmpeg.freeze_and_animate_last_frame(
                 video_path=image_path,
                 target_duration=duration,
                 effect=frozen_effect,
                 aspect_ratio=aspect_ratio
             )

        # 5. Subtitle Generation (Async)
        subtitle_path = await self.subtitle.generate_ass_file(
            scene_id=scene_id,
            script=script,
            duration=duration,
            config=sub_config,
            audio_path=audio_path,
            aspect_ratio=aspect_ratio
        )
        
        return {
            "image_path": image_path,
            "audio_path": audio_path,
            "subtitle_path": subtitle_path,
            "duration": duration
        }
