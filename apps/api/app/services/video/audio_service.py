import logging
import asyncio
from ...tts_engine import TTSEngine

logger = logging.getLogger(__name__)

class AudioService:
    def __init__(self, settings):
        self.settings = settings
        self.tts_engine = TTSEngine(settings)

    async def generate_scene_audio(self, scene_id: int, script: str, tts_config: dict) -> str:
        """
        Generates TTS audio for a scene and applies optional silence removal.
        """
        try:
            logger.info(f"🎤 Generating TTS for Scene #{scene_id}...")
            
            # 1. Generate Raw TTS
            tts_result = await self.tts_engine.generate_audio(
                text=script,
                engine=tts_config.get("engine", "edge"),
                language=tts_config.get("language", "ko"),
                voice_id=tts_config.get("voice_id"),
                rate=int(tts_config.get("rate", 0)),
                pitch=int(tts_config.get("pitch", 0))
            )
            
            # Handle result formatting
            if isinstance(tts_result, dict):
                audio_path = tts_result.get("file_path")
                if not audio_path:
                    raise ValueError("TTS Engine returned success but no file path")
            else:
                audio_path = tts_result

            # 2. Silence Removal (Optional)
            if tts_config.get('silenceEnabled', False):
                await self._remove_silence(audio_path, tts_config)

            return audio_path
        except Exception as e:
            logger.error(f"❌ Scene TTS Failed: {e}")
            raise e

    async def _remove_silence(self, audio_path: str, config: dict):
        """Internal helper for silence removal using AudioProcessor"""
        try:
            logger.info(f"Applying Silence Removal to {audio_path}...")
            
            # Dynamic imports to avoid circular/heavy startup
            from silence_core import AudioProcessor
            from pydub import AudioSegment
            
            processor = AudioProcessor()
            audio = AudioSegment.from_file(audio_path)
            
            opts = {
                "remove_silence": True,
                "threshold": int(config.get('silenceThreshold', -40)),
                "min_silence_len": int(config.get('minSilenceLen', 300)),
                "keep_silence_ms": int(config.get('keepSilenceLen', 50)),
                "use_nr": False, 
                "normalize": False
            }
            
            processed_audio = await asyncio.to_thread(processor.process, audio, opts)
            await asyncio.to_thread(processed_audio.export, audio_path, format="mp3")
            
            logger.info(f"Silence Removal Complete: {audio_path}")
        except Exception as e:
            logger.warning(f"Silence Removal Failed: {e}")
