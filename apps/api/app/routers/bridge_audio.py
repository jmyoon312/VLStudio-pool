from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Settings
from app.services.tts_manager import tts_manager
from subtitle_core import SubtitleEngine
from app.dependency_manager import DependencyManager
import os

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "default"
    engine: str = "auto" # auto, kokoro, qwen, elevenlabs

class TranscribeRequest(BaseModel):
    file_path: str
    language: str = "ko"
    format: str = "json" # json (for remotion), srt (for file)

@router.post("/tts")
async def bridge_tts(request: TTSRequest, db: Session = Depends(get_db)):
    """
    Generate Speech using unified pipeline.
    """
    settings = db.query(Settings).first()
    config = {
        "kokoro_url": settings.kokoro_tts_url if settings else None,
        "kokoro_enabled": True, # Assume true if URL exists
        "qwen_url": settings.qwen_tts_url if settings else None,
        "qwen_enabled": bool(settings.qwen_tts_url) if settings else False,
        "elevenlabs_key": settings.elevenlabs_api_keys[0] if settings and settings.elevenlabs_api_keys else None
    }
    
    result, error = tts_manager.generate_speech(
        text=request.text, 
        voice_id=request.voice_id, 
        engine=request.engine, 
        config=config
    )
    
    if error:
        raise HTTPException(status_code=500, detail=error)
    
    return result

@router.post("/transcribe")
async def bridge_transcribe(request: TranscribeRequest):
    """
    Transcribe Audio/Video to JSON (Word-level) or SRT.
    """
    engine = SubtitleEngine(
        ffmpeg_path=DependencyManager.get_ffmpeg_path(),
        model_path=os.getenv("WHISPER_MODEL_PATH", "base")
    )
    
    if request.format == "json":
        data, error = engine.extract_subtitle_json(request.file_path, language=request.language)
        if error: raise HTTPException(500, error)
        return {"status": "success", "subtitles": data}
    else:
        # Legacy SRT
        srt, error = engine.extract_subtitle(request.file_path, language=request.language)
        if error: raise HTTPException(500, error)
        return {"status": "success", "srt_content": srt}
