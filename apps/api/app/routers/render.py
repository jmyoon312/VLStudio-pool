from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import subprocess
import os
import uuid
from datetime import datetime
import json
import shutil
from .. import dependency_manager

router = APIRouter(tags=["render"])

# === Models ===
class LayerData(BaseModel):
    id: str
    type: str # 'image', 'video', 'text'
    src: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    opacity: float = 1.0
    text: Optional[str] = None
    # ... other props

class TrackData(BaseModel):
    id: str
    file_path: str
    title: str
    duration: float

class RenderRequest(BaseModel):
    scene: Dict[str, Any] # Full scene data (layers, etc.)
    playlist: List[TrackData]
    duration_minutes: int # Target duration
    use_remotion: bool = True # Default to True for testing migrationfloat
    resolution: str = "1280x720"
    quality: str = "high"
    output_filename: str
    crossfade_duration: float = 1.0

class RenderTaskStatus(BaseModel):
    task_id: str
    status: str # 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    progress: int
    output_path: Optional[str] = None
    error: Optional[str] = None

# In-memory output store (replace with DB for production)
render_tasks = {}


from ..services.ffmpeg_generator import FFmpegGenerator
import asyncio

async def process_render_task(task_id: str, request: RenderRequest):
    """
    Background worker to generate long-form Lofi music video using pure FFmpeg.
    """
    try:
        render_tasks[task_id]["status"] = "PROCESSING"
        render_tasks[task_id]["progress"] = 10
        
        # 1. Setup Paths
        from ..database import SessionLocal
        from .. import crud
        from app.config import settings as settings_conf
        db = SessionLocal()
        try:
            settings = crud.get_settings(db)
            download_root = settings.root_download_path if settings and settings.root_download_path else settings_conf.root_download_path
        finally:
            db.close()
            
        if settings and settings.root_download_path:
            output_dir = os.path.join(settings.root_download_path, "05_Exports")
        else:
            output_dir = settings_conf.EXPORTS_DIR
        os.makedirs(output_dir, exist_ok=True)
        final_output = os.path.join(output_dir, f"{request.output_filename}.mp4")
        
        # 2. Extract Background Video
        bg_layer = None
        for layer in request.scene.get('layers', []):
            if layer.get('type') == 'video': 
                bg_layer = layer
                break
        
        if not bg_layer:
            raise Exception("No background video found in scene")
            
        visual_source = bg_layer.get('filePath') or bg_layer.get('src')
        if not visual_source:
             raise Exception("Background video has no path")

        # Resolve Path
        if visual_source.startswith("file:///"):
            visual_source = visual_source[8:]
        elif visual_source.startswith("/media/"):
            relative = visual_source[7:]
            visual_source = os.path.join(download_root, relative)
        elif not os.path.isabs(visual_source):
             visual_source = os.path.join(download_root, visual_source)
             
        if not os.path.exists(visual_source):
            # Try studio uploads
            alt = os.path.join(download_root, "studio_uploads", os.path.basename(visual_source))
            if os.path.exists(alt):
                visual_source = alt
            else:
                raise Exception(f"Background file not found: {visual_source}")

        # 3. Extract Audio Playlist
        audio_paths = []
        for track in request.playlist:
            path = track.file_path
            if path.startswith("file:///"):
                path = path[8:]
            elif path.startswith("/media/"):
                relative = path[7:]
                path = os.path.join(download_root, relative)
            elif not os.path.isabs(path):
                # Try common locations
                candidates = [
                    os.path.join(download_root, path),
                    os.path.join(download_root, "audio", path),
                    os.path.join(download_root, "studio_uploads", path),
                    os.path.join(download_root, "tts", path)
                ]
                found = False
                for c in candidates:
                    if os.path.exists(c):
                        path = c
                        found = True
                        break
                if not found:
                    print(f"Skipping missing audio: {path}")
                    continue
            
            if os.path.exists(path):
                audio_paths.append(path)
        
        if not audio_paths:
            raise Exception("No valid audio files found in playlist")

        render_tasks[task_id]["progress"] = 30
        
        # 4. Generate
        print(f"[VIDEO] Starting FFmpeg Render: BG={visual_source}, AudioCount={len(audio_paths)}")
        duration_sec = request.duration_minutes * 60
        
        # Get FFmpeg path
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        if not ffmpeg_path or not os.path.exists(ffmpeg_path):
             # Fallback check or error
             if shutil.which("ffmpeg"):
                 ffmpeg_path = "ffmpeg"
             else:
                 raise Exception("FFmpeg binary not found. Please check settings.")
        
        # Infer ffprobe path
        ffprobe_path = "ffprobe"
        if ffmpeg_path != "ffmpeg":
             parent = os.path.dirname(ffmpeg_path)
             if os.name == 'nt':
                 ffprobe_path = os.path.join(parent, "ffprobe.exe")
             else:
                 ffprobe_path = os.path.join(parent, "ffprobe")
                 
             if not os.path.exists(ffprobe_path):
                 print(f"[WARN] ffprobe not found at {ffprobe_path}, trying default 'ffprobe'")
                 ffprobe_path = "ffprobe"

        generator = FFmpegGenerator(ffmpeg_path=ffmpeg_path, ffprobe_path=ffprobe_path)
        await generator.generate_lofi(
            bg_path=visual_source, 
            audio_paths=audio_paths, 
            duration=duration_sec, 
            output_file=final_output,
            crossfade=request.crossfade_duration
        )
        
        render_tasks[task_id]["progress"] = 100
        render_tasks[task_id]["status"] = "COMPLETED"
        render_tasks[task_id]["output_path"] = final_output
        print(f"[OK] Render complete: {final_output}")

    except Exception as e:
        print(f"[FAIL] Render Failed: {e}")
        render_tasks[task_id]["status"] = "FAILED"
        render_tasks[task_id]["error"] = str(e)

@router.post("/generate")
async def generate_music_video(request: RenderRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    render_tasks[task_id] = {
        "task_id": task_id,
        "status": "PENDING",
        "progress": 0,
        "request": request.dict()
    }
    
    background_tasks.add_task(process_render_task, task_id, request)
    
    return {"task_id": task_id}

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    task = render_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
