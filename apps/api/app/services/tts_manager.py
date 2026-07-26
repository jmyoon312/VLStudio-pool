import os
import requests
import uuid
from pydub import AudioSegment
from app.dependency_manager import DependencyManager

class TTSManager:
    def __init__(self):
        # Default Output Path
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "downloads", "_tts_cache")
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_speech(self, text: str, voice_id: str = "default", engine: str = "auto", config: dict = None):
        """
        Unified TTS Generation.
        engine: "auto", "kokoro", "qwen", "elevenlabs"
        config: Dictionary containing API keys and URLs (from Settings)
        """
        if not config: config = {}
        
        # Auto-Selection Logic
        if engine == "auto":
            # Priority: Kokoro (Fast/Local) -> Qwen (Quality/Local) -> ElevenLabs (High Quality/Cost)
            # Default to Kokoro if available (Since user mentioned Kokoro/Qwen)
            if config.get("kokoro_enabled") and config.get("kokoro_url"):
                engine = "kokoro"
            elif config.get("qwen_enabled") and config.get("qwen_url"):
                engine = "qwen"
            elif config.get("elevenlabs_key"):
                engine = "elevenlabs"
            else:
                return None, "No TTS engine configured."

        filename = f"tts_{uuid.uuid4()}.wav" # Standardize on WAV first
        output_path = os.path.join(self.output_dir, filename)

        try:
            if engine == "kokoro":
                return self._generate_kokoro(text, output_path, config.get("kokoro_url"))
            elif engine == "qwen":
                return self._generate_qwen(text, output_path, config.get("qwen_url"))
            elif engine == "elevenlabs":
                return self._generate_elevenlabs(text, voice_id, output_path, config.get("elevenlabs_key"))
            else:
                return None, f"Unknown engine: {engine}"
        except Exception as e:
            import traceback
            traceback.print_exc()
            return None, f"TTS Error ({engine}): {str(e)}"

    def _generate_kokoro(self, text, output_path, url):
        # Mocking Kokoro API (OpenAI compatible or specific?)
        # Assuming simple POST based on current trends or user's custom server.
        # "https://tts1.gogloo.gleeze.com"
        # Usually /v1/audio/speech
        try:
            # Language to Kokoro Voice ID Mapping
            # [Ref] v1.1 supports kf_alpha, km_alpha etc.
            KOKORO_VOICE_MAP = {
                "ko": "kf_alpha",  # 여성 표준
                "en": "af_bella",  # 여성
                "ja": "jf_alpha",
                "zh": "zf_alpha",
            }
            
            # Use specified voice or auto-detect from config/language
            target_voice = config.get("voice_id") or KOKORO_VOICE_MAP.get(config.get("language", "en"), "af_bella")
            
            payload = {
                "input": text, 
                "voice": target_voice, 
                "response_format": "wav"
            }
            logger.info(f"🎤 [TTS:KOKORO] Target Voice: {target_voice} (URL: {url})")
            
            resp = requests.post(f"{url}/v1/audio/speech", json=payload, timeout=30)
            resp.raise_for_status()
            with open(output_path, "wb") as f:
                f.write(resp.content)
            return self._finalize_audio(output_path)
        except Exception as e:
            return None, str(e)
            
    def _generate_qwen(self, text, output_path, url):
        # User's Qwen server
        try:
            # Assuming standard OpenAI format for Qwen/CosyVoice wrapper
             payload = {"input": text, "voice": "female_calm", "model": "qwen-tts", "response_format": "wav"}
             resp = requests.post(f"{url}/v1/audio/speech", json=payload, timeout=60)
             resp.raise_for_status()
             with open(output_path, "wb") as f:
                f.write(resp.content)
             return self._finalize_audio(output_path)
        except Exception as e:
            return None, str(e)

    def _generate_elevenlabs(self, text, voice_id, output_path, api_key):
        # 11Labs API
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
        payload = {"text": text, "model_id": "eleven_multilingual_v2"}
        try:
             resp = requests.post(url, json=payload, headers=headers, timeout=30)
             resp.raise_for_status()
             with open(output_path, "wb") as f:
                f.write(resp.content)
             return self._finalize_audio(output_path)
        except Exception as e:
             return None, str(e)
             

    def _finalize_audio(self, path):
        # Return Path and Duration
        try:
            audio = AudioSegment.from_file(path)
            duration_sec = len(audio) / 1000.0
            return {
                "file_path": path,
                "duration": duration_sec
            }, None
        except Exception as e:
            return None, f"Audio processing failed: {e}"

tts_manager = TTSManager()
