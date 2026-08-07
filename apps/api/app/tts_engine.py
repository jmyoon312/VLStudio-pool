import os
import time
import logging
import uuid
import shutil
import subprocess
import requests
import random
import asyncio
import sys
import urllib.parse
import json
from . import schemas
from . import dependency_manager

logger = logging.getLogger("uvicorn")

class TTSEngine:
    def __init__(self, settings: schemas.Settings):
        self.settings = settings
        
        # [FIX] Use User Settings for Temp Directory
        if settings.root_download_path and os.path.exists(settings.root_download_path):
             self.temp_dir = os.path.join(settings.root_download_path, "temp", "tts")
        else:
             base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
             self.temp_dir = os.path.join(os.path.dirname(base_dir), "temp_storage", "tts")
             
        os.makedirs(self.temp_dir, exist_ok=True)
        self.kokoro = None

    def _get_key(self, keys: list) -> str:
        if not keys: return None
        return random.choice(keys)

    async def generate_audio(self, text: str, engine: str, language: str, voice_id: str = None, rate: int = 0, pitch: int = 0, emotion: str = "normal", voice_settings: dict = None, silence_enabled: bool = False, silence_params: dict = None, noise_scale: float = 0.0, mix_voice_id: str = None, mix_ratio: float = 0.0, base_url: str = None, rvc_model: str = None) -> dict:
        filename = f"tts_{engine}_{language}_{int(time.time())}_{uuid.uuid4().hex[:4]}.mp3"
        output_path = os.path.join(self.temp_dir, filename)
        abs_path = os.path.abspath(output_path)

        # [VIRTUAL VOICE LOGIC] for Google
        # If engine is Google, map specific 'voice_id' to rate/pitch presets if not manually set
        if engine == "google" and voice_id:
            # Only apply virtual presets if user hasn't heavily customized rate/pitch
            if rate == 0 and pitch == 0:
                # Female Variations
                if voice_id == "google_female_calm":
                    pitch = -1
                    rate = -5
                elif voice_id == "google_female_energetic":
                    pitch = 2
                    rate = 5
                elif voice_id == "google_female":
                    # Fix: User reported default female sounds male.
                    # Shift pitch up slightly (approx +0.4 semitones) to verify gender.
                    pitch = 2
                
                # Male Variations
                elif voice_id == "google_male":
                    pitch = -3 # Standard Male
                elif voice_id == "google_male_deep":
                    pitch = -5 # Deep Male
                elif voice_id == "google_male_calm":
                    pitch = -4
                    rate = -5
                
                # Legacy Support
                elif voice_id == "google_shorts":
                    rate = 15
                    pitch = 2
                elif voice_id == "google_news":
                    rate = -5

        try:
            # 1. Generate Audio
            if engine == "google":
                await self._generate_google(text, language, abs_path)
            
            elif engine == "elevenlabs":
                await self._generate_elevenlabs(text, voice_id, abs_path, voice_settings)
            
            elif engine == "typecast":
                # Typecast needs async polling usually, but let's implement the standard sync-wait logic if possible or fire-and-forget
                await self._generate_typecast(text, voice_id, emotion, rate, pitch, abs_path)
            
            elif engine == "kokoro":
                await self._generate_kokoro(text, language, voice_id, abs_path)
            
            elif engine == "supertone-local":
                # [EMOTION ENGINE]
                # Map 'emotion' to presets for Speed, Pitch (FFmpeg), and Noise (Latent)
                
                # Base values (User provided or 0)
                final_speed = 1.0 + (rate / 100.0)
                final_pitch = pitch
                # Use passed noise_scale if provided (e.g. from UI slider), else default based on emotion
                final_noise = noise_scale if noise_scale > 0 else 0.667 
                
                if emotion == "happy":
                     final_speed *= 1.2
                     final_pitch += 2
                     if noise_scale == 0: final_noise = 0.8 # Only override if user didn't set custom noise
                elif emotion == "sad":
                     final_speed *= 0.85
                     final_pitch -= 2
                     if noise_scale == 0: final_noise = 0.3
                elif emotion == "angry":
                     final_speed *= 1.25
                     final_pitch += 1
                     if noise_scale == 0: final_noise = 0.9

                # Expose override for FFmpeg block
                supertone_pitch_override = final_pitch 
                
                await asyncio.to_thread(
                    self._generate_supertone_local, 
                    text, voice_id, abs_path, 
                    language=language, 
                    speed=final_speed, 
                    emotion=emotion,
                    noise_scale=final_noise,
                    mix_voice_id=mix_voice_id,
                    mix_ratio=mix_ratio
                ) 
                
            elif engine == "edge":
                await self._generate_edge(text, voice_id, abs_path, rate, pitch)
            
            elif engine == "qwen":
                # Extract specialized params from voice_settings or assume passed via kwargs if we refactor,
                # but for now we look at the function signature of generate_audio which needs updating or we extract from 'voice_settings' dict if flexible.
                # Actually, I will explicitly add the params to generate_audio signature in the next step, 
                # but for now let's grab them from `voice_settings` if passed, or defaults.
                # However, the user wants me to update schemas/routers to pass these explicitly.
                # Let's assume standard args are passed mapped.
                
                # We need to map 'rate'/'pitch' to Qwen's specific types if needed, but Qwen uses 'speed' enum string and 'seed'.
                # We'll expect these in a specialized dictionary 'qwen_params' or similar. 
                # Wait, I should update the generate_audio signature to support **kwargs or specific params.
                # For now, I'll extract from 'voice_settings' which is a flexible dict I can reuse.
                
                qwen_params = voice_settings or {}
                await self._generate_qwen(
                    text, 
                    voice=voice_id, 
                    path=abs_path,
                    age=qwen_params.get("age", "default"),
                    dialect=qwen_params.get("dialect", "standard"),
                    emotion=emotion,
                    speed=qwen_params.get("speed", "normal"),
                    seed=qwen_params.get("seed", -1),
                    manual_instruction=qwen_params.get("manual_instruction", "")
                )

            elif engine == "gemini":
                await self._generate_gemini(text, voice_id, abs_path)

            else:
                await self._generate_google(text, language, abs_path)

            # 2. Post-Processing (FFmpeg)
            # Edge, Google, Kokoro need manual ffmpeg for effects.
            # Typecast handles rate/pitch API side, but MIGHT need silence removal if enabled.
            # ElevenLabs handles rate/pitch, but MIGHT need silence removal.
            
            needs_ffmpeg_effects = True
            
            # Rate/Pitch Handling Check
            if engine == "typecast": needs_ffmpeg_effects = False 
            if engine == "elevenlabs": needs_ffmpeg_effects = False 
            if engine == "supertone-local": needs_ffmpeg_effects = True # Needed for Pitch (Emotion) 
            
            # Silence Removal Check (applies to ALL engines if enabled)
            needs_silence_removal = silence_enabled

            # Determine if we need to run FFmpeg
            should_run_ffmpeg = False
            
            if needs_ffmpeg_effects and (rate != 0 or pitch != 0):
                should_run_ffmpeg = True
            
            if needs_silence_removal:
                should_run_ffmpeg = True

            if should_run_ffmpeg and os.path.exists(abs_path):
                # Pass effective rate/pitch only if engine relies on FFmpeg for it (Google, Edge, Kokoro)
                # [FIX for Supertone] Supertone handles Rate natively, but needs FFmpeg for Pitch.
                eff_rate = rate if (needs_ffmpeg_effects and engine != "supertone-local") else 0
                
                # If engine is supertone-local, use the emotionally adjusted pitch if available
                if engine == "supertone-local" and 'supertone_pitch_override' in locals():
                     eff_pitch = locals()['supertone_pitch_override']
                else: 
                     eff_pitch = pitch if needs_ffmpeg_effects else 0
                
                self._apply_audio_effects(abs_path, eff_rate, eff_pitch, silence_enabled, silence_params)

            # 2.5 RVC Processing
            if rvc_model and os.path.exists(abs_path):
                from app.services.tts.rvc_engine import RVCEngine
                rvc = RVCEngine()
                abs_path = await rvc.convert_audio(abs_path, rvc_model, pitch)

            # 3. Web URL
            from .utils import get_web_url
            web_url = get_web_url(base_url or "http://api:8000", abs_path)
            
            return {
                "status": "success",
                "file_path": abs_path,
                "url": web_url
            }

        except Exception as e:
            logger.error(f"TTS Generation Failed ({engine}): {e}")
            
            # [FIX] Relaxed Fallback Logic
            # Only fallback if it's a transient system error or explicitly requested,
            # NOT if it's a configuration error (like missing keys) which the user needs to see.
            
            is_config_error = "missing" in str(e).lower() or "unauthorized" in str(e).lower() or "401" in str(e)
            
            if engine != "google" and not is_config_error:
                pass
            
            raise e

    # --- Engines ---

    async def _generate_qwen(self, text, voice, path, age="default", dialect="standard", emotion="neutral", speed="normal", seed=-1, manual_instruction=""):
        url = self.settings.qwen_tts_url
        if not url:
            raise ValueError("Qwen TTS URL is not configured.")
        
        # Strategy: Try clean endpoint first, then trailing slash
        # Requests might drop body on 307 redirects if not handled carefully, or if server is strict about slash.
        endpoints_to_try = [
            f"{url.rstrip('/')}/generate/tts",
            f"{url.rstrip('/')}/generate/tts/"
        ]
        
        payload = {
            "text": text,
            "voice": voice or "sohee",
            "age": age,
            "dialect": dialect,
            "emotion": emotion,
            "speed": speed,
            "language": "auto",
            "seed": seed,
            "manual_instruction": manual_instruction
        }
        
        # Server expects Form Data (application/x-www-form-urlencoded), NOT JSON.
        # Verified from server source code: `text: str = Form(...)`
        
        headers = {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "Viraloop-Client/1.0"
            # Content-Type is auto-set by requests for data=...
        }
        
        logger.info(f"Qwen TTS Payload (Form): {payload}")
        
        try:
           def run_req():
               last_error = None
               for endpoint in endpoints_to_try:
                   try:
                       logger.info(f"Qwen Attempt: {endpoint}")
                       # Use data=payload for Form encoding
                       response = requests.post(endpoint, data=payload, headers=headers, timeout=120)
                       
                       if response.status_code == 200:
                           with open(path, "wb") as f:
                               f.write(response.content)
                           return # Success
                       elif response.status_code == 307 or response.status_code == 308:
                           # Redirect explicitly
                           logger.warning(f"Qwen Redirect detected: {response.status_code} -> {response.headers.get('Location')}")
                           
                       last_error = f"Status {response.status_code}: {response.text}"
                   except Exception as e:
                       last_error = str(e)
               
               raise RuntimeError(f"Qwen TTS Failed after retries. Last Error: {last_error}")

           await asyncio.to_thread(run_req)
           
        except Exception as e:
            logger.error(f"Qwen TTS Error: {e}")
            raise e

    async def _generate_edge(self, text, voice, path, rate=0, pitch=0):
        voice = voice or "ko-KR-SunHiNeural"
        
        # NOTE: We use FFmpeg for rate/pitch effects in _apply_audio_effects, 
        # so we don't pass rate/pitch to Edge TTS here (defaults used).
        
        def run_in_thread():
            import asyncio
            import edge_tts
            
            async def _main():
                # Direct library usage avoids CLI encoding issues
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(path)

            # Create a new event loop for this thread to avoid conflict with Uvicorn's loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(_main())
            finally:
                loop.close()

        await asyncio.to_thread(run_in_thread)

    async def _generate_google(self, text, language, path):
        from gtts import gTTS
        def run():
            lang = language.split('-')[0]
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.save(path)
        await asyncio.to_thread(run)

    async def _generate_elevenlabs(self, text, voice_id, path, voice_settings=None):
        # Shuffled keys for unpredictable account rotation
        keys = self.settings.elevenlabs_api_keys.copy()
        random.shuffle(keys)
        
        if not keys: raise ValueError("ElevenLabs API Keys missing in Settings!")
        
        voice = voice_id or "21m00Tcm4TlvDq8ikWAM"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
        data = {
            "text": text, 
            "model_id": "eleven_multilingual_v2"
        }
        if voice_settings:
            data["voice_settings"] = voice_settings
        
        def run_req():
            success_res = None
            best_error = None
            
            # Key Rotation Loop (Shuffled)
            for raw_key in keys:
                clean_key = raw_key.replace("Bearer ", "").strip()
                if not clean_key: continue
                
                try:
                    logger.info(f"📡 [ElevenLabs] Generating (Key: {clean_key[:8]}...)...")
                    headers = {
                        "xi-api-key": clean_key, 
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                    
                    # ElevenLabs standard generation
                    res = requests.post(url, json=data, headers=headers, timeout=30)
                    
                    if res.status_code == 200:
                        logger.info(f"[OK] [ElevenLabs] Success with key {clean_key[:8]}...")
                        success_res = res
                        break
                    
                    # Transparent Error Extraction
                    err_msg = res.text
                    try:
                        ejson = res.json()
                        if "detail" in ejson:
                             err_msg = ejson["detail"].get("message") or str(ejson["detail"])
                    except: pass
                    
                    best_error = f"{res.status_code}: {err_msg}"
                    logger.warning(f"[WARN] [ElevenLabs] {best_error}")
                    
                except Exception as e:
                    best_error = str(e)
                    logger.debug(f"ElevenLabs key attempt failed: {e}")
            
            if not success_res:
                raise RuntimeError(f"ElevenLabs Failed after trying {len(keys)} keys. Details: {best_error}")
            
            with open(path, "wb") as f:
                f.write(success_res.content)
                
        await asyncio.to_thread(run_req)

    async def _generate_typecast(self, text, voice_id, emotion, rate, pitch, path):
        # Shuffled keys to avoid sequential pattern detection
        keys = self.settings.typecast_api_keys.copy()
        import random
        random.shuffle(keys)
        
        if not keys: 
            logger.error("[FAIL] [Typecast] API Keys are missing in settings.")
            raise ValueError("Typecast API Keys missing in Settings!")

        tempo = 1.0 + (rate / 100.0)
        valid_emotions = ["normal", "happy", "sad", "angry"]
        preset = emotion if emotion in valid_emotions else "normal"

        # Robust Payload for multiple API versions
        data = {
            "text": text,
            "voice_id": voice_id,
            "actor_id": voice_id, # Some versions use actor_id
            "model": "ssfm-v21",
            "emotion_tone_preset": preset,
            "prompt": {"emotion_tone_preset": preset}, # V1 nested structure
            "tempo": tempo,
            "pitch": pitch,
            "xapi_hd": True,
            "lang": "ko",
            "model_version": "latest"
        }

        urls_to_try = [
            "https://api.typecast.ai/v1/speak",
            "https://api.typecast.ai/v1/text-to-speech",
            "https://typecast.ai/api/speak"
        ]
        
        def run_req():
            success_res = None
            best_error = None
            
            # Key Rotation Loop (Shuffled)
            for raw_key in keys:
                clean_key = raw_key.replace("Bearer ", "").strip()
                if not clean_key: continue
                
                # Connection settings: try Direct then Proxy (prioritize stability)
                internal_proxy = {'http': 'socks5://127.0.0.1:10800', 'https': 'socks5://127.0.0.1:10800'}
                connection_configs = [
                    {"proxies": None, "label": "Direct"},
                    {"proxies": internal_proxy, "label": "Proxy"}
                ]

                # Connection/Proxy Loop
                for conn in connection_configs:
                    try:
                        logger.info(f"📡 [Typecast] Attempting generation (Key: {clean_key[:8]}... | {conn['label']})")
                        
                        endpoint_success = None
                        for url in urls_to_try:
                            # Enhanced auth strategies based on various Typecast versions
                            auth_strategies = [
                                {"x-api-key": clean_key, "label": "x-api-key"},
                                {"Authorization": f"Bearer {clean_key}", "label": "Bearer"},
                                {"Authorization": clean_key, "label": "Direct Auth"}
                            ]
                            
                            for auth_config in auth_strategies:
                                try:
                                    strategy_label = auth_config.pop("label")
                                    headers = auth_config.copy()
                                    headers["Content-Type"] = "application/json"
                                    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                    
                                    logger.info(f"🧪 [Typecast] Trying {url} with {strategy_label}...")
                                    res = requests.post(url, json=data, headers=headers, timeout=20, proxies=conn['proxies'])
                                    
                                    if res.status_code == 200:
                                        logger.info(f"[OK] [Typecast] Success! (Url: {url}, Auth: {strategy_label})")
                                        endpoint_success = res
                                        break
                                    
                                    # Log failure detail for each attempt to catch 401/403 specifically
                                    err_detail = res.text[:100]
                                    try:
                                        ejson = res.json()
                                        err_detail = ejson.get("message") or ejson.get("error_code") or err_detail
                                    except: pass
                                    
                                    logger.warning(f"[WARN] [Typecast] Attempt failed: {url} | {strategy_label} | Status: {res.status_code} | Error: {err_detail}")
                                    best_error = f"{res.status_code}: {err_detail}"
                                        
                                except Exception as e:
                                    logger.error(f"[FAIL] [Typecast] Request Error: {e}")
                                    if not best_error: best_error = str(e)
                            
                            if endpoint_success: break
                        
                        if endpoint_success:
                            success_res = endpoint_success
                            break 
                            
                    except Exception as e:
                        logger.debug(f"Connection config {conn['label']} failed: {e}")
                        if not best_error: best_error = str(e)

                if success_res:
                    break 

            if not success_res:
                raise RuntimeError(f"Typecast Generation Failed after trying {len(keys)} keys. Last Error: {best_error}")
            
            # Process Success Response (Handle JSON or Binary)
            try:
                # 1. Try to parse as JSON for polling/metadata
                try:
                    rjson = success_res.json()
                    dl_url = None
                    
                    # Handle Polling URL (speak_url)
                    result = rjson.get("result", {}) if isinstance(rjson, dict) else {}
                    speak_url = result.get("speak_url")
                    
                    if speak_url:
                        logger.info(f"[WAIT] [Typecast] Polling for completion...")
                        for i in range(20): # Max 40s
                            time.sleep(2)
                            poll_res = requests.get(speak_url, headers={"x-api-key": clean_key}, timeout=15)
                            if poll_res.status_code == 200:
                                p_data = poll_res.json()
                                p_res = p_data.get("result", {})
                                if p_res.get("status") == "done":
                                    dl_url = p_res.get("audio_url")
                                    break
                                elif p_res.get("status") == "failed":
                                    raise RuntimeError("Typecast polling failed: Remote status is 'failed'")
                        else:
                            raise RuntimeError("Typecast polling timed out")
                    
                    # Handle Direct Audio URL
                    if not dl_url:
                        if 'audio_url' in result: dl_url = result['audio_url']
                        elif 'audio_url' in rjson: dl_url = rjson['audio_url']

                    if dl_url:
                        audio_res = requests.get(dl_url, timeout=30)
                        with open(path, "wb") as f: f.write(audio_res.content)
                    else:
                        # If JSON has no URL, maybe raw content?
                        with open(path, "wb") as f: f.write(success_res.content)
                        
                except Exception:
                    # 2. Binary Fallback (RIFF WAVE / MP3)
                    logger.info("[BOX] [Typecast] Saving raw binary response...")
                    with open(path, "wb") as f: f.write(success_res.content)
                    
            except Exception as e:
                 logger.error(f"[FAIL] [Typecast] Response processing error: {e}")
                 with open(path, "wb") as f: f.write(success_res.content)
                 
        await asyncio.to_thread(run_req)


    async def _generate_kokoro(self, text, language, voice_id, path):
        # 1. Try Remote Kokoro Server first if configured
        if self.settings.kokoro_tts_url and "http" in self.settings.kokoro_tts_url:
            try:
                target_url = self.settings.kokoro_tts_url.rstrip('/')
                # Assume OpenAI-compatible endpoint if not specified
                if not target_url.endswith("speech") and not target_url.endswith("generate"):
                     target_url += "/v1/audio/speech"
                
                voice = voice_id or "af_sarah"
                payload = {
                    "model": "kokoro",
                    "input": text,
                    "voice": voice,
                    "response_format": "mp3",
                    "speed": 1.0
                }
                
                def run_remote():
                    resp = requests.post(target_url, json=payload, timeout=30)
                    if resp.status_code != 200:
                        raise RuntimeError(f"Remote Kokoro Error {resp.status_code}: {resp.text}")
                    with open(path, "wb") as f:
                        f.write(resp.content)
                        
                await asyncio.to_thread(run_remote)
                return # Success
                
            except Exception as e:
                logger.warning(f"Remote Kokoro failed ({e}). Falling back to local.")
                # Fallthrough to local

        # 2. Local Kokoro (Fallback or Default)
        try:
            import soundfile as sf
            from kokoro_onnx import Kokoro
            
            # Check model files
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(base_dir, "models", "kokoro-v0_19.onnx")
            voices_path = os.path.join(base_dir, "models", "voices.json")
            
            if not os.path.exists(model_path):
                # Only raise if remote also failed/missing
                raise RuntimeError("Kokoro Model not found locally (backend/models). and Remote server failed/unset.")

            if not self.kokoro:
                self.kokoro = Kokoro(model_path, voices_path)
            
            def run_local():
                voice = voice_id if voice_id else "af_sarah"
                # Default to American English mapping 'a'
                # Improvements: Map language to 'a' (US), 'b' (UK) based on voice_id prefix
                lang_code = "a"
                if voice.startswith("bf_") or voice.startswith("bm_"): lang_code = "b" # British
                
                samples, sample_rate = self.kokoro.create(text, voice=voice, speed=1.0, lang=lang_code)
                sf.write(path, samples, sample_rate)
            
            await asyncio.to_thread(run_local)
            
        except Exception as e:
            logger.error(f"Kokoro Error: {e}")
            raise e

    async def _generate_gemini(self, text, voice_id, path):
        def run_remote():
            url = "http://localhost:20128/v1/audio/speech"
            headers = {
                "Content-Type": "application/json",
                # The user's example has a specific key, we can hardcode it or use a default if it's a local router
                "Authorization": "Bearer sk-e07acd31ef38b7d4-0p15at-b27d2bab"
            }
            # Fallback voice if empty
            v_id = voice_id if voice_id else "Zephyr"
            data = {
                "model": f"gemini/gemini-3.1-flash-tts-preview/{v_id}",
                "input": text
            }
            try:
                res = requests.post(url, json=data, headers=headers, timeout=30)
                if res.status_code != 200:
                    raise RuntimeError(f"Gemini TTS Error {res.status_code}: {res.text}")
                with open(path, "wb") as f:
                    f.write(res.content)
            except Exception as e:
                logger.error(f"[FAIL] [Gemini TTS] Request Error: {e}")
                raise e
                
        await asyncio.to_thread(run_remote)

    def _generate_supertone_local(self, text, voice_id, path, language="ko", speed=1.0, emotion="normal", noise_scale=1.0, mix_voice_id=None, mix_ratio=0.0):
        try:
            from .services.tts.supertonic import SupertonicService
            import soundfile as sf
            
            # Use user-configured model path or default
            model_dir = "backend/models/supertonic" # Default
            if self.settings.supertone_model_path:
                 model_dir = self.settings.supertone_model_path
            
            # Initialize Service (Singleton pattern handles repeated calls)
            service = SupertonicService.get_instance(model_dir)
            
            # Generate Audio
            # voice_id and emotion can be mapped to styles if we implement multiple styles
            wav, sr = service.generate(
                text, 
                lang=language, 
                voice_id=voice_id, 
                speed=speed, 
                noise_scale=noise_scale,
                mix_voice_id=mix_voice_id,
                mix_ratio=mix_ratio
            )
            
            # Save to file
            sf.write(path, wav, sr)
            
        except Exception as e:
            logger.error(f"Supertonic Local Error: {e}")
            raise e

    def _generate_supertone(self, text, voice_id, path, language="ko", style=None):
        if not self.settings.supertone_project_key:
             # Fallback to local if key missing? Or just error?
             # User requested "Add", implies co-existence.
            raise ValueError("Supertone API Key not set.")

        url = f"https://supertoneapi.com/v1/text-to-speech/{voice_id}"
        headers = {
            "accept": "audio/wav", # Or application/json if we want URL, usually audio/wav for direct
            "content-type": "application/json",
            "x-sup-api-key": self.settings.supertone_project_key
        }
        
        payload = {
            "text": text,
            "language": language,
            "model": "sona_speech_2" # Default to newest, or configurable
        }
        if style and style != "normal":
            payload["style"] = style
            
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.status_code == 200:
                with open(path, "wb") as f:
                    f.write(response.content)
            else:
                logger.error(f"Supertone TTS Failed: {response.text}")
                raise RuntimeError(f"Supertone API Error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Supertone Generation Error: {e}")
            raise e

    def _apply_audio_effects(self, file_path, rate, pitch, silence_enabled=False, silence_params=None):
        try:
            ffmpeg = dependency_manager.DependencyManager.get_ffmpeg_path()
            
            filter_chains = []
            
            # 1. Rate change (Speed) logic
            speed_factor = 1.0 + (rate / 100.0)
            
            # 2. Pitch change logic
            # Semitones approx.
            semitones = pitch * 0.2 
            pitch_ratio = 2 ** (semitones / 12.0)
            
            # Only apply pitch/rate filters if they are non-zero/neutral
            if rate != 0 or pitch != 0:
                # Change sample rate to shift pitch
                from pydub import AudioSegment
                seg = AudioSegment.from_file(file_path)
                orig_sr = seg.frame_rate
                new_sr = int(orig_sr * pitch_ratio)
                
                # Compensation tempo
                tempo = speed_factor / pitch_ratio
                tempo = max(0.5, min(2.0, tempo))
                
                filter_chains.append(f"asetrate={new_sr}")
                filter_chains.append(f"atempo={tempo}")

            # 3. Silence Removal Logic
            if silence_enabled:
                # Default params
                params = silence_params or {}
                # silence_threshold: -40dB default
                db_thresh = params.get("threshold", -40)
                # min_silence_len: 300ms -> duration=0.3
                min_silence_duration = params.get("min_silence_len", 300) / 1000.0
                
                # Construct silenceremove filter
                # start_periods=1: Remove initial silence
                # stop_periods=-1: Remove all internal silence
                # window=0: default
                filter_str = f"silenceremove=start_periods=1:start_duration={min_silence_duration}:start_threshold={db_thresh}dB:stop_periods=-1:stop_duration={min_silence_duration}:stop_threshold={db_thresh}dB"
                filter_chains.append(filter_str)

            if not filter_chains:
                return # Nothing to do

            # Join filters with comma
            af_string = ",".join(filter_chains)

            cmd = [ffmpeg, '-y', '-i', file_path, '-af', af_string, file_path.replace(".mp3", "_out.mp3")]
            
            logger.info(f"Applying FFmpeg Effects: {cmd}")
            subprocess.run(cmd, check=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            shutil.move(file_path.replace(".mp3", "_out.mp3"), file_path)
        except Exception as e:
            logger.error(f"Effects failed: {e}")
