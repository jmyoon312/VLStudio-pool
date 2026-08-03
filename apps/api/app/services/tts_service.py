import os
import aiohttp
import logging
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

# TTS Provider endpoints
LOCAL_TTS_URL = "http://localhost:20128/v1/audio/speech"
LOCAL_TTS_TOKEN = "sk-e07acd31ef38b7d4-0pl5at-b27d2bab"

# Fallback presets if no dynamic mapping is available
DEFAULT_MALE_VOICE = "google-tts/ko-KR-Wavenet-C"
DEFAULT_FEMALE_VOICE = "google-tts/ko-KR-Wavenet-B"
DEFAULT_NARRATOR_VOICE = "google-tts/ko-KR-Wavenet-D"

class TTSService:
    """
    Handles TTS generation using the local router or external providers (Typecast/ElevenLabs).
    Includes a dynamic mapping engine to select voices based on AI-extracted personas.
    """
    
    def __init__(self):
        self.provider = "local" # Default to local router as requested

    def _map_persona_to_voice(self, speaker: str, persona_meta: Dict[str, Any]) -> str:
        """
        Maps a persona (gender, age, emotion) to a specific TTS model/voice ID.
        In production, this could query a database of user-defined 'Presets'.
        """
        if "나레이션" in speaker or "해설" in speaker:
            return DEFAULT_NARRATOR_VOICE
            
        gender = persona_meta.get("gender", "unknown").lower()
        emotion = persona_meta.get("emotion", "neutral").lower()
        
        # Extremely basic mapping logic. 
        # This will be expanded to match the detailed character traits from Vision AI.
        if gender == "male":
            if emotion in ["angry", "shouting"]:
                return "google-tts/ko-KR-Wavenet-C" # Assume C is energetic
            return DEFAULT_MALE_VOICE
        elif gender == "female":
            if emotion in ["sad", "crying"]:
                return "google-tts/ko-KR-Wavenet-A" # Assume A is soft
            return DEFAULT_FEMALE_VOICE
            
        return DEFAULT_NARRATOR_VOICE # Fallback

    async def generate_speech(self, text: str, output_path: str, speaker: str = "Unknown", persona_meta: Dict[str, Any] = None, voice_model_override: str = None, speed: int = 0, pitch: int = 0, emotion: str = "normal", noise_scale: float = 0.667) -> str:
        """
        Generates TTS and saves to output_path.
        Supports Gemini (local proxy), Typecast, ElevenLabs, and Supertonic Local via TTSEngine.
        """
        if voice_model_override:
            voice_model = voice_model_override
        else:
            persona_meta = persona_meta or {}
            voice_model = self._map_persona_to_voice(speaker, persona_meta)
        
        logger.info(f"Generating TTS for [{speaker}] using voice [{voice_model}]")
        
        # Parse provider and voice_id (e.g. typecast/haeun -> provider=typecast, voice_id=haeun)
        parts = voice_model.split("/", 1)
        provider = parts[0]
        voice_id = parts[1] if len(parts) > 1 else voice_model

        if provider == "gemini":
            # Native Gemini routing to proxy
            payload = {
                "model": voice_model,
                "input": text
            }
            headers = {
                "Authorization": f"Bearer {LOCAL_TTS_TOKEN}",
                "Content-Type": "application/json"
            }
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(LOCAL_TTS_URL, headers=headers, json=payload) as response:
                        if response.status == 200:
                            audio_data = await response.read()
                            with open(output_path, "wb") as f:
                                f.write(audio_data)
                            return output_path
                        else:
                            error_text = await response.text()
                            logger.error(f"Gemini TTS Generation failed: {response.status} - {error_text}")
                            raise Exception(f"TTS API Error: {response.status}")
            except Exception as e:
                logger.error(f"TTS failed: {e}")
                raise e
        else:
            # Route to powerful TTSEngine for typecast, supertone-local, elevenlabs, kokoro
            from app.tts_engine import TTSEngine
            from app.config import settings
            import shutil
            
            engine_instance = TTSEngine(settings)
            
            try:
                result = await engine_instance.generate_audio(
                    text=text,
                    engine=provider,
                    language="ko",
                    voice_id=voice_id,
                    rate=speed,
                    pitch=pitch,
                    emotion=emotion,
                    noise_scale=noise_scale
                )
                
                if result and result.get("status") == "success" and result.get("file_path"):
                    # TTSEngine outputs to a temp folder, copy it to the requested output_path
                    shutil.copy2(result["file_path"], output_path)
                    return output_path
                else:
                    raise Exception("TTSEngine returned failure")
                    
            except Exception as e:
                logger.error(f"TTSEngine [{provider}] generation failed: {e}")
                raise e
