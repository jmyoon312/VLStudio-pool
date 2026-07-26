from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from ..utils import get_web_url
from sqlalchemy.orm import Session
from .. import crud, schemas, database
from ..video_engine import VideoGenClient
from ..config import settings
from pydantic import BaseModel
import shutil
import os
import uuid

router = APIRouter(tags=["video"])

# Dependency
def get_video_engine(db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    return VideoGenClient(settings)

class VideoGenerationRequest(BaseModel):
    prompt: str
    model: str = "kling-v1"
    aspect_ratio: str = "9:16"
    is_continuous_motion: bool = False
    scene_id: int | None = None

class VideoTaskResponse(BaseModel):
    task_id: str

class VideoStatusResponse(BaseModel):
    status: str
    url: str | None
    progress: int | None

@router.post("/generate", response_model=VideoTaskResponse)
async def generate_video(
    request: VideoGenerationRequest,
    engine: VideoGenClient = Depends(get_video_engine)
):
    try:
        task_id = await engine.generate_video(
            request.prompt, 
            request.model, 
            request.aspect_ratio,
            is_continuous_motion=request.is_continuous_motion,
            scene_id=request.scene_id
        )
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}", response_model=VideoStatusResponse)
def check_video_status(
    task_id: str,
    engine: VideoGenClient = Depends(get_video_engine)
):
    try:
        result = engine.check_status(task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_video(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    try:
        # [FIX] Use settings for cross-platform media directory
        base_media_dir = settings.MEDIA_ROOT
        temp_dir = settings.TEMP_DIR
        os.makedirs(temp_dir, exist_ok=True)
        
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(temp_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return URL (assuming /files mount points to temp)
        web_url = get_web_url(request, file_path)
        
        return {
            "url": web_url,
            "web_url": web_url,
            "server_path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
