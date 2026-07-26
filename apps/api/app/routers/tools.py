from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
# from starlette.background import BackgroundTask # Removed/Unused or implicitly used via FastAPI
from .. import crud, database
import os
import json
import tempfile
import shutil
import sys
import time
import requests
import logging
import pydantic
import re # 정규식 모듈 추가
import uuid
import asyncio
from typing import List, Optional

from app import dependency_manager
from ..utils import get_web_url, font_parser

# Setup logger
logger = logging.getLogger("uvicorn")


# Add backend root to sys.path to import silence_core
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_root not in sys.path:
    sys.path.append(backend_root)

# Lazy imports for heavy modules
# from silence_core import AudioProcessor
from ..subtitle_core import SubtitleEngine
# from pydub import AudioSegment
# import edge_tts

router = APIRouter(tags=["tools"])

@router.delete("/cleanup")
async def cleanup_temp_file(file_path: str = Form(...), db: Session = Depends(database.get_db)):
    """
    Deletes a specific temporary file.
    Security: Ensures the file is within 'temp_storage' or 'downloads' or user configured root.
    """
    try:
        # Normalize paths
        target_path = os.path.abspath(file_path)
        
        # Define allowed roots
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend
        temp_storage = os.path.abspath(os.path.join(os.path.dirname(base_dir), "temp_storage"))
        
        # [FIX] Check user settings for custom root
        allowed_roots = [temp_storage]
        settings = crud.get_settings(db)
        from app.config import settings as settings_conf
        root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
        if root_path and os.path.exists(root_path):
             allowed_roots.append(os.path.abspath(root_path))
        
        # Check if path starts with allowed root
        allowed = False
        for root in allowed_roots:
            if target_path.startswith(root):
                allowed = True
                break
            
        if not allowed:
            logger.warning(f"Cleanup rejected: {target_path} is not in allowed temp dirs.")
            raise HTTPException(status_code=403, detail="File path not allowed for deletion")
            
        if os.path.exists(target_path) and os.path.isfile(target_path):
            os.remove(target_path)
            logger.info(f"Cleanup: Deleted {target_path}")
            return {"status": "success", "message": "File deleted"}
        else:
            return {"status": "ignored", "message": "File not found"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def cleanup_files(*paths):
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception as e:
                print(f"Error cleaning up file {p}: {e}")

@router.post("/silence/process")
async def process_silence(
    request: Request,
    files: List[UploadFile] = File(None),
    input_path: str = Form(None),
    options: str = Form(...),
    db: Session = Depends(database.get_db)
):
    # Log received request
    if files:
        logger.info(f"Received silence process request with {len(files)} files.")
        for f in files:
            logger.info(f" - File: {f.filename} ({f.content_type})")
    else:
        logger.info("Received silence process request with NO files.")

    # 1. Load Settings
    settings = crud.get_settings(db)
    from app.config import settings as settings_conf
    
    # Use managed FFmpeg
    try:
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")

    root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
    
    # Parse options
    try:
        opts = json.loads(options)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid options JSON")

    # 2. Determine Input Paths
    input_paths = []
    temp_files_to_cleanup = []
    
    # Use a dedicated temp storage inside the project or system temp
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    TEMP_DIR = os.path.join(BASE_DIR, "temp_storage")
    os.makedirs(TEMP_DIR, exist_ok=True)

    try:
        # Handle multiple files upload
        upload_list = files if files else []
        
        if upload_list:
            for f in upload_list:
                # Generate unique filename
                ext = os.path.splitext(f.filename)[1] or ".mp3"
                safe_filename = f"{uuid.uuid4().hex}_{f.filename}"
                safe_filename = "".join(c for c in safe_filename if c.isalnum() or c in "._-")
                
                temp_input_path = os.path.join(TEMP_DIR, safe_filename)
                
                with open(temp_input_path, "wb") as buffer:
                    shutil.copyfileobj(f.file, buffer)
                
                input_paths.append(temp_input_path)
                temp_files_to_cleanup.append(temp_input_path)
                print(f"INFO: Processing uploaded file: {f.filename} -> saved to {temp_input_path}")
                logger.info(f"Processing uploaded file: {f.filename} -> saved to {temp_input_path}")
        elif input_path and os.path.exists(input_path):
             input_paths.append(input_path)
        else:
            raise HTTPException(status_code=400, detail="No input file or path provided")

        # 3. Process Logic
        try:
            from silence_core import AudioProcessor
            from pydub import AudioSegment
        except ImportError:
            import silence_core
            from silence_core import AudioProcessor
            from pydub import AudioSegment

        processor = AudioProcessor()
        
        # Check for Merge Mode (Threshold == 0 OR Multiple Files)
        if opts.get("threshold", 0) == 0 or len(input_paths) > 1:
            # --- MERGE MODE ---
            web_temp_dir = os.path.join(root_path, "temp")
            os.makedirs(web_temp_dir, exist_ok=True)
            
            output_filename = f"merged_{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(web_temp_dir, output_filename)
            
            processor.merge_files(input_paths, output_path, opts)
            
            web_url = get_web_url(request, output_path)
            
            return {
                "status": "success",
                "web_url": web_url,
                "server_path": output_path,
                "message": "Files merged successfully"
            }
            
        else:
            # --- PROCESS MODE (Individual) ---
            current_input_path = input_paths[0]
            
            try:
                audio = AudioSegment.from_file(current_input_path)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to load audio file: {e}")

            processed_audio = processor.process(audio, opts, path=current_input_path)
            
            # [FIX] Use User Settings Temp Directory
            # This ensures we write to the same path that main.py serves as /temp
            # We already have root_path = settings.root_download_path from line 89
            
            if root_path and os.path.exists(root_path):
                 safe_temp_dir = os.path.join(root_path, "temp")
                 # Ensure it exists
                 os.makedirs(safe_temp_dir, exist_ok=True)
            else:
                 # Fallback to local
                 base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                 project_root = os.path.dirname(base_dir)
                 safe_temp_dir = os.path.join(project_root, "temp_storage")
                 os.makedirs(safe_temp_dir, exist_ok=True)
            
            output_filename = f"processed_{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(safe_temp_dir, output_filename)
            
            # Force MP3 export
            processed_audio.export(output_path, format="mp3", bitrate="192k")
            
            if os.path.exists(output_path):
                 print(f"DEBUG: Silence Process - File created successfully at: {output_path}")
                 logger.info(f"File created: {output_path}")
            else:
                 print(f"ERROR: Silence Process - FAILED to create file at: {output_path}")
                 logger.error(f"Failed to create file: {output_path}")
            
            web_url = get_web_url(request, output_path)
            
            return {
                "status": "success",
                "web_url": web_url,
                "server_path": output_path,
                "message": "Silence removal successful"
            }

    except HTTPException:
        cleanup_files(*temp_files_to_cleanup)
        raise
    except Exception as e:
        cleanup_files(*temp_files_to_cleanup)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        cleanup_files(*temp_files_to_cleanup)
        if files:
            for f in files: f.file.close()

# --- TTS ---
class TTSGenerateRequest(pydantic.BaseModel):
    text: str
    engine: str
    language: str
    voice: Optional[str] = None
    rate: int = 0
    pitch: int = 0

@router.post("/tts/generate")
async def generate_tts(
    request: Request,
    text: str = Form(...),
    engine: str = Form(...),
    language: str = Form(...),
    voice_id: str = Form(None),
    rate: int = Form(0),
    pitch: int = Form(0),
    silence_enabled: bool = Form(False),
    silence_threshold: int = Form(-40),
    min_silence_len: int = Form(300),
    keep_silence_len: int = Form(50),
    emotion: str = Form("normal"), # [NEW] Emotion param
    xi_stability: float = Form(0.5), # [NEW] ElevenLabs Stability
    xi_similarity_boost: float = Form(0.75), # [NEW] ElevenLabs Similarity
    xi_style: float = Form(0.0), # [NEW] ElevenLabs Style
    # [NEW] Supertonic Emotion Engine
    noise_scale: float = Form(0.0), 
    mix_voice_id: str = Form(None),
    mix_ratio: float = Form(0.0),
    # [NEW] Qwen3 Remote TTS
    qwen_age: str = Form("default"),
    qwen_dialect: str = Form("standard"),
    qwen_speed: str = Form("normal"),
    qwen_seed: int = Form(-1),
    qwen_instruction: str = Form(""),
    db: Session = Depends(database.get_db)
):
    logger.info(f"TTS Request: Engine={engine}, Language={language}, Voice={voice_id}, Rate={rate}, Pitch={pitch}, Silence={silence_enabled}")
    if engine == 'typecast':
        logger.info(f"Typecast Emotion: {emotion}")
    if engine == 'elevenlabs':
        logger.info(f"ElevenLabs Settings: Stability={xi_stability}, Sim={xi_similarity_boost}, Style={xi_style}")
    if engine == 'supertone-local':
        logger.info(f"Supertonic Emotion: {emotion}, Noise: {noise_scale}, Mix: {mix_voice_id} ({mix_ratio})")
    if engine == 'qwen':
        logger.info(f"Qwen TTS: Voice={voice_id}, Age={qwen_age}, Dialect={qwen_dialect}, Emotion={emotion}, Speed={qwen_speed}, Seed={qwen_seed}")

    settings = crud.get_settings(db)
    
    try:
        from ..tts_engine import TTSEngine
        tts_engine = TTSEngine(settings)
        
        # Voice Settings Packaging
        voice_settings = None
        if engine == 'elevenlabs':
            voice_settings = {
                "stability": xi_stability,
                "similarity_boost": xi_similarity_boost,
                "style": xi_style,
                "use_speaker_boost": True
            }
        elif engine == 'qwen':
             voice_settings = {
                 "age": qwen_age,
                 "dialect": qwen_dialect,
                 "speed": qwen_speed,
                 "seed": qwen_seed,
                 "manual_instruction": qwen_instruction
             }

        # Prepare Silence Params
        silence_params = {
            "threshold": silence_threshold,
            "min_silence_len": min_silence_len,
            "keep_silence_len": keep_silence_len
        }

        # Call Engine (returns dict)
        # Passed silence_enabled and params so tts_engine handles it natively via FFmpeg
        tts_result = await tts_engine.generate_audio(
            text=text,
            engine=engine,
            language=language,
            voice_id=voice_id,
            rate=rate,
            pitch=pitch,
            emotion=emotion, # Pass emotion
            voice_settings=voice_settings, # Pass XI settings
            silence_enabled=silence_enabled,
            silence_params=silence_params,
            noise_scale=noise_scale, # [NEW]
            mix_voice_id=mix_voice_id, # [NEW]
            mix_ratio=mix_ratio # [NEW]
        )
        
        output_path = tts_result["file_path"]
        
        # [FIX] Use robust get_web_url (now uses /files/stream)
        web_url = get_web_url(request, output_path)

        # Calculate duration
        duration = 0
        try:
            duration = dependency_manager.DependencyManager.get_media_duration(output_path)
        except: pass

        return {
            "status": "success",
            "web_url": web_url,
            "server_path": output_path,
            "duration": duration,
            "message": "Generated successfully"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tts/voices")
async def get_voices(engine: str, language: str = None, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    
    # Helper to deduplicate
    def dedup(v_list):
        seen = set()
        unique = []
        for v in v_list:
            if v["id"] not in seen:
                seen.add(v["id"])
                unique.append(v)
        return unique

    if engine == "edge":
        # Hardcoded popular Edge voices
        voices = [
            {"id": "ko-KR-SunHiNeural", "name": "SunHi (Korean Female)", "lang": "ko"},
            {"id": "ko-KR-InJoonNeural", "name": "InJoon (Korean Male)", "lang": "ko"},
            {"id": "ko-KR-HyunsuNeural", "name": "Hyunsu (Korean Male)", "lang": "ko"},
            {"id": "ko-KR-BongJinNeural", "name": "BongJin (Korean Male)", "lang": "ko"},
            {"id": "ko-KR-GookMinNeural", "name": "GookMin (Korean Male)", "lang": "ko"},
            {"id": "ko-KR-JiMinNeural", "name": "JiMin (Korean Female)", "lang": "ko"},
            {"id": "ko-KR-SeoHyeonNeural", "name": "SeoHyeon (Korean Female)", "lang": "ko"},
            {"id": "en-US-AriaNeural", "name": "Aria (English Female)", "lang": "en"},
            {"id": "en-US-JennyNeural", "name": "Jenny (English Female)", "lang": "en"},
            {"id": "en-US-GuyNeural", "name": "Guy (English Male)", "lang": "en"},
            {"id": "en-US-ChristopherNeural", "name": "Christopher (English Male)", "lang": "en"},
            {"id": "en-US-EricNeural", "name": "Eric (English Male)", "lang": "en"},
            {"id": "en-US-MichelleNeural", "name": "Michelle (English Female)", "lang": "en"},
            {"id": "en-US-RogerNeural", "name": "Roger (English Male)", "lang": "en"},
            {"id": "ja-JP-NanamiNeural", "name": "Nanami (Japanese Female)", "lang": "ja"},
            {"id": "ja-JP-KeitaNeural", "name": "Keita (Japanese Male)", "lang": "ja"},
        ]
        if language:
            voices = [v for v in voices if v.get("lang") == language]
        return dedup(voices)
        
    elif engine == "google":
        # Google Virtual Voices via FFmpeg Post-processing
        # Base voices are single per language, variations created by pitch/speed shifting
        return [
            {"id": "google_female", "name": "Google 여성 (기본)", "gender": "female", "age_group": "adult"},
            {"id": "google_female_calm", "name": "Google 여성 (차분함)", "gender": "female", "age_group": "adult"},
            {"id": "google_female_energetic", "name": "Google 여성 (활기참)", "gender": "female", "age_group": "youth"},
            {"id": "google_male", "name": "Google 남성 (기본 변조)", "gender": "male", "age_group": "adult"},
            {"id": "google_male_deep", "name": "Google 남성 (이선균 톤)", "gender": "male", "age_group": "adult"},
            {"id": "google_male_calm", "name": "Google 남성 (차분함)", "gender": "male", "age_group": "adult"},
        ]

    elif engine == "elevenlabs":
        # Check list instead of singular
        if not settings.elevenlabs_api_keys:
            # Return empty or error? Empty list lets UI handle it gracefully
            return []
        
        # Use first key to fetch voices
        api_key = settings.elevenlabs_api_keys[0]
        url = "https://api.elevenlabs.io/v1/voices"
        headers = {"xi-api-key": api_key}
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                raw_voices = data.get("voices", [])
                clean_voices = []
                for v in raw_voices:
                    labels = v.get("labels", {})
                    age = labels.get("age", "adult") # young, middle_aged, old
                    gender = labels.get("gender", "unknown")
                    
                    # Map Age
                    age_group = "adult"
                    if age == "young": age_group = "youth"
                    elif age == "old": age_group = "senior"
                    
                    clean_voices.append({
                        "id": v["voice_id"], 
                        "name": v["name"],
                        "gender": gender,
                        "age_group": age_group
                    })
                return dedup(clean_voices)
            return []
        except:
            return []

    elif engine == "supertone-local":
        # Dynamic Style Loading
        model_path = settings.supertone_model_path if settings.supertone_model_path else "backend/models/supertonic"
        
        # Handle Path Resolution (Robust logic matching service.py)
        abs_path = os.path.abspath(model_path)
        if "backend" + os.sep + "backend" in abs_path:
            fixed_path = abs_path.replace("backend" + os.sep + "backend", "backend")
            if os.path.exists(fixed_path):
                 abs_path = fixed_path
        
        # PyInstaller packaged environment fallback support: check real workspace root if missing in bundle temp dir
        if not os.path.exists(abs_path):
             # Try workspace root using VIRALOOP_PROJECT_ROOT env if available
             proj_root = os.getenv("VIRALOOP_PROJECT_ROOT")
             if proj_root:
                 # Check packaged installation folder resources first
                 proj_resources_candidate = os.path.abspath(os.path.join(proj_root, "resources", "apps", "api", "backend", "models", "supertonic"))
                 if os.path.exists(proj_resources_candidate):
                     abs_path = proj_resources_candidate
                 else:
                     proj_candidate = os.path.abspath(os.path.join(proj_root, "apps", "api", "backend", "models", "supertonic"))
                     if os.path.exists(proj_candidate):
                         abs_path = proj_candidate
                     else:
                         proj_candidate2 = os.path.abspath(os.path.join(proj_root, "backend", "models", "supertonic"))
                         if os.path.exists(proj_candidate2):
                             abs_path = proj_candidate2
        
        if not os.path.exists(abs_path):
             parent_relative = os.path.abspath(os.path.join("..", model_path))
             if os.path.exists(parent_relative):
                  abs_path = parent_relative
             else:
                  apps_api_relative = os.path.abspath(os.path.join("apps", "api", model_path))
                  if os.path.exists(apps_api_relative):
                       abs_path = apps_api_relative
        model_path = abs_path
            
        styles_dir = os.path.join(model_path, "voice_styles")
        if not os.path.exists(styles_dir):
             styles_dir = os.path.join(model_path, "styles")
        
        if not os.path.exists(styles_dir):
             # Let's print for debugging
             print(f"[Supertonic GET VOICES] Path not found: {styles_dir}")
             return [{"id": "default", "name": "Default (Styles Missing)"}]
             
        voices = []
        try:
            for f in os.listdir(styles_dir):
                if f.endswith(".json"):
                    # Use filename as ID/Name (e.g. M1.json -> M1)
                    sid = f.replace(".json", "")
                    gender = "male" if sid.lower().startswith("m") else "female"
                    voices.append({
                        "id": sid, 
                        "name": f"Supertonic {sid}",
                        "gender": gender,
                        "lang": "ko" # Assuming Korean for now
                    })
        except Exception:
            pass
            
        if not voices:
             return [{"id": "default", "name": "Default (No Styles Found)"}]
             
        return sorted(voices, key=lambda x: x["id"])

    elif engine == "typecast":
        # Check list
        if not settings.typecast_api_keys:
             return []
        
        # 1. Try Dynamic Fetch from API with Adaptive Connection + Key Rotation
        async def fetch_typecast_voices():
            url = "https://api.typecast.ai/v1/voices"
            import random
            keys = settings.typecast_api_keys.copy()
            random.shuffle(keys)
            
            combined_data = None
            last_status = 0
            
            for raw_key in keys:
                clean_key = raw_key.replace("Bearer ", "").strip()
                if not clean_key: continue
                
                # Auth strategies: prioritize x-api-key as proven by diagnosis
                strategies = [
                    {"x-api-key": clean_key},
                    {"Authorization": clean_key},
                    {"Authorization": f"Bearer {clean_key}"}
                ]
                
                # Proxy configurations: try internal proxy then direct
                connection_configs = [
                    {"proxies": {'http': 'socks5://127.0.0.1:10800', 'https': 'socks5://127.0.0.1:10800'}, "label": "Proxy"},
                    {"proxies": None, "label": "Direct"}
                ]
                
                for conn in connection_configs:
                    for headers in strategies:
                        try:
                            # Add decoy User-Agent
                            full_headers = headers.copy()
                            full_headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                            
                            logger.info(f"📡 [Typecast] Fetching voices (Key: {clean_key[:8]}... | {conn['label']} | {list(headers.keys())[0]})...")
                            def run_req():
                                return requests.get(url, headers=full_headers, timeout=5, proxies=conn['proxies'])
                            
                            response = await asyncio.to_thread(run_req)
                            
                            if response.status_code == 200:
                                logger.info(f"✅ [Typecast] Success with key {clean_key[:8]}...")
                                return response.json(), 200
                            
                            last_status = response.status_code
                        except Exception as e:
                            logger.debug(f"⚠️ [Typecast] Attempt failed: {e}")
            
            return None, last_status or 500

        try:
            data, status = await fetch_typecast_voices()
            
            if data and status == 200:
                actors = []
                if isinstance(data, dict):
                    if "result" in data: actors = data["result"]
                    elif "voices" in data: actors = data["voices"]
                if isinstance(data, list):
                    actors = data
                
                voice_list = []
                for actor in actors:
                    aid = actor.get("voice_id") or actor.get("actor_id")
                    name = actor.get("voice_name") or actor.get("name") or "Unknown"
                    if isinstance(name, dict):
                        name = name.get("en") or name.get("ko") or "Unknown"
                        
                    alang = actor.get("language") or actor.get("lang")
                    sl = str(alang).lower() if alang else ""
                    sys_lang = "ko" # Default
                    
                    # Manual Heuristics for language based on names
                    first_word = name.split(" ")[0]
                    english_names = {"Tom", "Angela", "James", "Watson", "Morgan", "Matthew", "Kate", "Neo", "Liz", "Earth", "Emily", "Michael"} # Truncated for logic
                    japanese_names = {"Kanno", "Hana", "Yuri", "Miso", "Romi"} 
                    
                    if first_word in japanese_names: sys_lang = "ja"
                    elif first_word in english_names: sys_lang = "en"
                    
                    if alang:
                        if "ko" in sl or "korean" in sl: sys_lang = "ko"
                        elif "en" in sl or "english" in sl: sys_lang = "en"
                        elif "ja" in sl or "japanese" in sl: sys_lang = "ja"
                    
                    if aid:
                        voice_list.append({"id": aid, "name": name, "lang": sys_lang})
                
                if language:
                    voice_list = [v for v in voice_list if v["lang"] == language]
                
                return dedup(voice_list)
            
            else:
                # If we got here, all attempts failed. 
                # Provide descriptive error placeholder based on status
                error_msg = "❌ API Connection Failed"
                if status in [401, 403]:
                    error_msg = "❌ Invalid API Key (Auth Failed)"
                
                return [{"id": "error", "name": error_msg, "lang": "ko"}]

        except Exception as e:
            logger.error(f"Typecast Final Error: {e}")

        return [{"id": "error", "name": "❌ Unexpected Typecast Error", "lang": "ko"}]

    elif engine == "kokoro":
        # Local Kokoro Voices
        return [
            {"id": "af_bella", "name": "Bella (American Female)", "gender": "female", "age_group": "adult"},
            {"id": "af_sarah", "name": "Sarah (American Female)", "gender": "female", "age_group": "adult"},
            {"id": "am_adam", "name": "Adam (American Male)", "gender": "male", "age_group": "adult"},
            {"id": "am_michael", "name": "Michael (American Male)", "gender": "male", "age_group": "adult"},
            {"id": "bf_emma", "name": "Emma (British Female)", "gender": "female", "age_group": "adult"},
            {"id": "bf_isabella", "name": "Isabella (British Female)", "gender": "female", "age_group": "adult"},
            {"id": "bm_george", "name": "George (British Male)", "gender": "male", "age_group": "adult"},
            {"id": "bm_lewis", "name": "Lewis (British Male)", "gender": "male", "age_group": "adult"},
            {"id": "jf_alpha", "name": "Alpha (Japanese Female)", "gender": "female", "age_group": "adult"},
            {"id": "jf_gongitsune", "name": "Gongitsune (Japanese Female)", "gender": "female", "age_group": "youth"},
            {"id": "zm_yuxiao", "name": "Yuxiao (Chinese Male)", "gender": "male", "age_group": "adult"},
        ]
    
    return []

@router.get("/fonts")
def get_system_fonts(db: Session = Depends(database.get_db)):
    """
    Scans for fonts in the assets/fonts directory (and optionally user configured paths).
    Returns grouped list by language.
    """
    settings = crud.get_settings(db)
    
    # Define Font Path
    # Priority 1: User Configured Download Root / assets / fonts
    # Priority 2: Project Root / assets / fonts
    
    scan_dirs = []
    
    # Backend Root (c:\build\new\ViraLoop\backend)
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Project Root (c:\build\new\ViraLoop)
    project_root = os.path.dirname(backend_root)
    
    # 1. Project Asset Font Dir (Default deployment)
    project_font_dir = os.path.join(project_root, "frontend", "public", "assets", "fonts") 
    # Or "assets/fonts" if mapped? Let's assume standard static folder structure check.
    # Actually, user mentioned "fonts stored in a folder".
    # Often in 'assets/fonts' relative to execution or 'fonts' in root.
    
    # Let's check a few standard places
    candidates = [
        # Frontend Public Assets (Accessible via web)
        os.path.join(project_root, "frontend", "public", "fonts"),
        os.path.join(project_root, "assets", "fonts"),
        
        # Backend Assets
        os.path.join(backend_root, "assets", "fonts"),
    ]
    
    from app.config import settings as settings_conf
    root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
    if root_path:
        candidates.insert(0, os.path.join(root_path, "fonts"))
        
    final_fonts = {}
    
    for d in candidates:
        if os.path.exists(d):
            logger.info(f"Scanning fonts in: {d}")
            result = font_parser.scan_fonts(d)
            
            # Merge results
            for lang, families in result.items():
                if lang not in final_fonts:
                    final_fonts[lang] = set()
                final_fonts[lang].update(families)
                
    # Format for JSON
    response = {}
    for lang, families in final_fonts.items():
        response[lang] = sorted(list(families))
        
    return response

@router.post("/subtitle/extract")
async def extract_subtitle(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    model: str = Form("base"),
    request: Request = None,
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    
    # Use managed FFmpeg
    try:
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")
        
    # 1. Use User Settings Temp Directory
    from app.config import settings as settings_conf
    root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
    if root_path and os.path.exists(root_path):
         save_dir = os.path.join(root_path, "temp")
    else:
         base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
         root_path = os.path.join(base_dir, "temp_storage")
         save_dir = root_path
    
    os.makedirs(save_dir, exist_ok=True)
    
    # 2. Save Uploaded File
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
    input_path = os.path.join(save_dir, safe_filename)
    
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Processing subtitle extraction for: {file.filename} -> {input_path}")
        
        # Initialize Engine

        engine = SubtitleEngine(
            ffmpeg_path=ffmpeg_path,
            model_path=settings.whisper_model_path
        )
        
        # Extract SRT
        srt_content, error = engine.extract_subtitle(
            file_path=input_path,
            model_name=model,
            language=language
        )
        
        if error:
            raise Exception(error)
            
        # Save SRT to file
        srt_filename = f"extracted_{uuid.uuid4().hex}.srt"
        srt_output_path = os.path.join(save_dir, srt_filename)
        
        with open(srt_output_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
            
        # [FIX] Use robust get_web_url
        web_url = get_web_url(request, srt_output_path)

        # Parse SRT content into structured format for frontend (MATCHING extract_subtitle_from_path)
        subtitles = []
        blocks = srt_content.strip().split('\n\n')
        for block in blocks:
            lines = block.split('\n')
            if len(lines) >= 3:
                # Parse time: 00:00:00,000 --> 00:00:02,000
                times = lines[1].split(' --> ')
                if len(times) == 2:
                    start_str, end_str = times
                    
                    def parse_time(t_str):
                        h, m, s = t_str.split(':')
                        s, ms = s.split(',')
                        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
                        
                    start = parse_time(start_str)
                    end = parse_time(end_str)
                    text = " ".join(lines[2:])
                    
                    subtitles.append({
                        "start": start,
                        "end": end,
                        "text": text
                    })
            
        return {
            "status": "success",
            "srt_content": srt_content,
            "subtitles": subtitles,
            "web_url": web_url,
            "server_path": srt_output_path
        }
        
    except Exception as e:
        logger.error(f"Subtitle Extraction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cleanup_files(input_path)
        file.file.close()

class SubtitleExtractRequest(pydantic.BaseModel):
    audio_path: str
    language: str = "auto"
    model: str = "base"

@router.post("/subtitle/extract-from-path")
async def extract_subtitle_from_path(
    req: SubtitleExtractRequest,
    request: Request,
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    
    # Use managed FFmpeg
    try:
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")
        
    # Create temp dir (if needed for intermediate processing)
    from app.config import settings as settings_conf
    root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
    if root_path and os.path.exists(root_path):
         TEMP_DIR = os.path.join(root_path, "temp")
    else:
         BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
         TEMP_DIR = os.path.join(BASE_DIR, "temp_storage")
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    input_path = req.audio_path
    if not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at path: {input_path}")
    
    try:
        logger.info(f"Processing subtitle extraction for path: {input_path}")
        logger.info(f"Parameters: Language={req.language}, Model={req.model}")
        
        # Initialize Engine
        logger.info("Initializing SubtitleEngine...")

        # Use managed FFmpeg
        try:
            ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")

        # Initialize Engine

        engine = SubtitleEngine(
            ffmpeg_path=ffmpeg_path,
            model_path=settings.whisper_model_path
        )
        
        # Extract SRT
        logger.info("Starting engine.extract_subtitle...")
        srt_content, error = engine.extract_subtitle(
            file_path=input_path,
            model_name=req.model,
            language=req.language
        )
        logger.info(f"Extraction finished. Error: {error}")
        
        if error:
            raise Exception(error)
            
        # Parse SRT content into structured format for frontend
        logger.info("Parsing SRT content...")
        subtitles = []
        blocks = srt_content.strip().split('\n\n')
        for block in blocks:
            lines = block.split('\n')
            if len(lines) >= 3:
                # Parse time: 00:00:00,000 --> 00:00:02,000
                times = lines[1].split(' --> ')
                if len(times) == 2:
                    start_str, end_str = times
                    
                    def parse_time(t_str):
                        h, m, s = t_str.split(':')
                        s, ms = s.split(',')
                        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
                        
                    start = parse_time(start_str)
                    end = parse_time(end_str)
                    text = " ".join(lines[2:])
                    
                    subtitles.append({
                        "start": start,
                        "end": end,
                        "text": text
                    })

        return {
            "status": "success",
            "subtitles": subtitles,
            "srt_content": srt_content
        }
        
    except Exception as e:
        logger.error(f"Subtitle Extraction Error: {e}")
        import traceback
        error_trace = traceback.format_exc()
        try:
            with open("debug_subtitle_error.txt", "w", encoding="utf-8") as f:
                f.write(f"Error: {str(e)}\n\nTraceback:\n{error_trace}")
        except:
            pass
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
class SubtitleAlignRequest(pydantic.BaseModel):
    original_text: str
    srt_text: str
    limit: int = 10
    use_alignment: bool = True
    use_marker_segmentation: bool = False
    language: str = "auto"

@router.post("/subtitle/align")
async def align_subtitle(
    req: SubtitleAlignRequest,
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    
    try:
        # Use managed FFmpeg
        try:
            ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")
            
        # Initialize Engine

        engine = SubtitleEngine(
            ffmpeg_path=ffmpeg_path,
            model_path=settings.whisper_model_path
        )
        
        if req.use_alignment:
            step1, step2, error = engine.align_and_refine(
                original_text=req.original_text,
                srt_text=req.srt_text,
                limit=req.limit,
                use_marker_segmentation=req.use_marker_segmentation,
                language=req.language
            )
        else:
            step1 = ""
            step2, error = engine.refine_only(
                srt_text=req.srt_text,
                limit=req.limit,
                language=req.language
            )
            
        if error:
            raise Exception(error)
            
        return {
            "step1": step1,
            "step2": step2
        }
        
    except Exception as e:
        logger.error(f"Subtitle Alignment Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ScriptMarkerRequest(pydantic.BaseModel):
    text: str
    provider: str = "google"
    model: str = "gemini-2.0-flash-exp"

@router.post("/script/add-markers")
async def add_script_markers(
    req: ScriptMarkerRequest,
    db: Session = Depends(database.get_db)
):
    if not req.text.strip():
        return {"text": ""}
        
    try:
        from ..llm_manager import LLMClient
        settings = crud.get_settings(db)
        client = LLMClient(settings)
        
        system_prompt = (
            "You are a subtitle segmenter. "
            "Analyze the following text and insert the separator `//` at natural semantic pauses "
            "suitable for subtitles (approx 10-15 chars per segment). "
            "Do NOT change any words or punctuation. "
            "Output ONLY the marked text."
        )
        
        user_prompt = f"Input: {req.text}"
        
        # Use full prompt if model doesn't support system instructions well (though most do)
        # LLMClient handles system_instruction for all major providers.
        
        # Ensure model string is correct (frontend sends full string like 'groq/llama-3.3')
        target_model = req.model
        
        response = client.generate_content(
            prompt=user_prompt, 
            model_name=target_model,
            system_instruction=system_prompt
        )
        
        # client.generate_content returns a string (the content itself)
        return {"text": response}
        


    except Exception as e:
        logger.error(f"Marker Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fonts")
async def list_fonts():
    """
    Lists available fonts from the backend/fonts directory, grouped by language.
    Returns: { "Korean": [...], "English": [...], ... }
    """
    try:
        from ..utils.font_parser import scan_fonts
        
        # Define font directory
        # Define font directory (project root/fonts)
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        fonts_dir = os.path.join(backend_root, "..", "fonts")
        
        # Get grouped fonts
        fonts_by_lang = scan_fonts(fonts_dir)
        
        # Add default system fonts
        defaults = {
            "English": ["Arial", "Times New Roman", "Courier New", "Impact", "Roboto", "Open Sans", "Montserrat", "Inter"],
            "Korean": ["Do Hyeon", "Nanum Gothic", "Nanum Myeongjo", "Jua", "Sunflower", "Gmarket Sans TTF", "HYSupB"],
            "Japanese": ["Meiryo", "Yu Gothic", "MS Gothic"]
        }
        
        # Merge defaults into scanned fonts
        for lang, font_list in defaults.items():
            if lang not in fonts_by_lang:
                fonts_by_lang[lang] = []
            
            # Add if not present
            for font in font_list:
                if font not in fonts_by_lang[lang]:
                    fonts_by_lang[lang].append(font)
            
            fonts_by_lang[lang].sort()
            
        return fonts_by_lang
        
    except Exception as e:
        logger.error(f"Font Listing Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/stats")
def get_system_stats():
    """
    Returns CPU, RAM, and GPU usage stats.
    """
    stats = {
        "cpu": 0,
        "ram": 0,
        "gpu": 0,
        "disk": 0
    }
    
    try:
        import psutil
        import platform
        stats["cpu"] = psutil.cpu_percent(interval=None)
        stats["ram"] = psutil.virtual_memory().percent
        # [FIX] Cross-platform disk usage check
        system = platform.system()
        if system == "Windows" and os.path.exists("F:\\"):
            stats["disk"] = psutil.disk_usage("F:\\").percent
        else:
            stats["disk"] = psutil.disk_usage("/").percent
    except ImportError:
        pass
    except Exception as e:
        print(f"Stats Error: {e}")
        
    return stats

@router.get("/tts/supertonic/status")
def get_supertonic_status(db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    model_dir = settings.supertone_model_path if settings.supertone_model_path else "backend/models/supertonic"
    
    # Check for critical files
    required_files = [
        "config.json", 
        "tokenizer.json", 
        "onnx/duration_predictor.onnx", 
        "onnx/text_encoder.onnx", 
        "onnx/vector_estimator.onnx", 
        "onnx/vocoder.onnx",
        "voice_styles/M1.json"
    ]
    
    missing = []
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend
    
    # Handle relative or absolute paths
    if os.path.isabs(model_dir):
        target_dir = model_dir
    else:
        target_dir = os.path.join(base_dir, model_dir)

    # PyInstaller packaged environment fallback support: check real workspace root if files missing in bundle temp dir
    if not os.path.exists(target_dir) or not os.path.exists(os.path.join(target_dir, "config.json")):
        proj_root = os.getenv("VIRALOOP_PROJECT_ROOT")
        if proj_root:
            proj_candidate = os.path.abspath(os.path.join(proj_root, "apps", "api", "backend", "models", "supertonic"))
            if os.path.exists(os.path.join(proj_candidate, "config.json")):
                target_dir = proj_candidate
            else:
                proj_candidate2 = os.path.abspath(os.path.join(proj_root, "backend", "models", "supertonic"))
                if os.path.exists(os.path.join(proj_candidate2, "config.json")):
                    target_dir = proj_candidate2
        
    for f in required_files:
        if not os.path.exists(os.path.join(target_dir, f)):
            missing.append(f)
            
    return {
        "installed": len(missing) == 0,
        "missing_files": missing,
        "model_dir": target_dir
    }

@router.post("/tts/supertonic/download")
async def download_supertonic_models(background_tasks: BackgroundTasks):
    """
    Triggers the download script in background.
    """
    import subprocess
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend
    script_path = os.path.join(base_dir, "scripts", "download_supertonic.py")
    
    def run_download():
        try:
            logger.info("Starting Supertonic Model Download...")
            subprocess.run(["python", script_path], check=True, cwd=base_dir)
            logger.info("Supertonic Model Download Completed.")
        except Exception as e:
            logger.error(f"Supertonic Download Failed: {e}")

    background_tasks.add_task(run_download)
    return {"status": "started", "message": "Model download started in background. Check logs for progress."}
