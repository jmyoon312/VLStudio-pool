from fastapi import APIRouter, UploadFile, File, HTTPException, Request, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from app import schemas, crud, database
from app.services.remover_engine import RemoverEngine
import os
import uuid
import shutil
import logging
from datetime import datetime
from app.utils import get_web_url  # [FIX] Import get_web_url

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["remover"])

# In-Memory Task Store (Simple for now)
tasks = {}

# [NEW] Lightweight Response Schema
class RemoverUploadResponse(BaseModel):
    id: int
    title: str
    file_path: str
    web_url: str

@router.post("/upload", response_model=RemoverUploadResponse)
def upload_remover_video(request: Request, file: UploadFile = File(...)):
    """Uploads a video to the temp directory for editing."""
    try:
        # Create temp dir if not exists
        # [FIX] Safe Temp Dir
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        temp_dir = os.path.join(os.path.dirname(base_dir), "temp_storage")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Generate safe filename
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(temp_dir, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Generate Web URL
        web_url = get_web_url(request, file_path)
        
        return {
            "id": 0, # Temp ID indicating it's not in DB yet
            "title": file.filename,
            "file_path": file_path,
            "web_url": web_url
        }
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProcessRequest(BaseModel):
    video_id: int
    file_path: Optional[str] = None # For temp files
    rois: Optional[List[Dict[str, int]]] = None # Changed from single roi to list
    audio_mode: Optional[str] = None # 'remove_vocal', 'remove_bgm'
    base_url: Optional[str] = None # [NEW] To pass base URL to background task

def background_process_video(task_id: str, req: ProcessRequest):
    """
    Background worker function for video processing.
    Updates the 'tasks' dictionary with progress and result.
    """
    try:
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 0
        tasks[task_id]["message"] = "파일 확인 중..."

        # 1. Determine Input Path
        input_path = req.file_path
        
        # If not provided, try to look up from DB (for library videos)
        if not input_path and req.video_id > 0:
            db = database.SessionLocal()
            video = crud.get_video(db, req.video_id)
            db.close()
            if video:
                input_path = video.file_path

        if not input_path or not os.path.exists(input_path):
            raise Exception(f"Input file not found: {input_path}")

        # Use original input for both sources initially
        video_source = input_path
        audio_source = input_path
        
        processed_video = None
        processed_audio = None

        # A. Visual Processing (Independent)
        if req.rois and len(req.rois) > 0:
            tasks[task_id]["message"] = f"객체 {len(req.rois)}개 제거 중..."
            logger.info(f"Task {task_id}: Removing objects...")
            processed_video = RemoverEngine.remove_visual_object(video_source, req.rois)
        else:
            processed_video = video_source # Keep original video
        
        tasks[task_id]["progress"] = 50

        # B. Audio Processing (Independent from Original)
        if req.audio_mode in ['remove_vocal', 'remove_bgm']:
            tasks[task_id]["message"] = f"오디오 분리 중 ({req.audio_mode})..."
            logger.info(f"Task {task_id}: Separating audio...")
            processed_audio = RemoverEngine.separate_audio(audio_source, req.audio_mode)
        else:
            # If visual was processed but audio not, we need the audio from original
            processed_audio = audio_source
            
        tasks[task_id]["progress"] = 80

        # C. Final Merge
        # We always merge if we did *any* processing to ensure consistency
        if (req.rois and len(req.rois) > 0) or req.audio_mode:
            tasks[task_id]["message"] = "결과물 병합 중..."
            logger.info(f"Task {task_id}: Merging streams...")
            final_output = RemoverEngine.merge_media(processed_video, processed_audio)
        else:
            final_output = input_path
            
        # Use passed base_url (captured from request) for environment-aware links
        web_url = get_web_url(req.base_url, final_output)

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["message"] = "완료됨"
        tasks[task_id]["result"] = {
            "result_url": web_url,
            "file_path": final_output
        }
        logger.info(f"Task {task_id} Completed: {web_url}")

    except Exception as e:
        logger.error(f"Task {task_id} Failed: {e}")
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)


@router.post("/process")
def start_process(request: Request, req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Starts an async video processing task.
    Returns a task_id immediately.
    """
    # Capture Base URL
    req.base_url = str(request.base_url).rstrip("/")
    
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "queued", 
        "progress": 0, 
        "message": "작업 큐에 등록됨",
        "created_at": datetime.now()
    }
    
    background_tasks.add_task(background_process_video, task_id, req)
    
    return {"task_id": task_id}

@router.get("/status/{task_id}")
def get_status(task_id: str):
    """
    Poll this endpoint to check task status.
    """
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
