from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Request
from pydantic import BaseModel
import httpx
import os
import uuid
import asyncio
import shutil
from app.avatar_engine import generate_avatar_video
from app.config import settings

router = APIRouter(tags=["ai"])

# --- Configuration ---
HF_API_KEY = os.getenv("HF_API_KEY", "your_hf_key")
MUSICGEN_API_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-small"

# --- Models ---
class MusicGenRequest(BaseModel):
    prompt: str
    duration: int = 10 # Seconds

class MusicGenResponse(BaseModel):
    status: str
    job_id: str
    url: str = None
    message: str = None

class AvatarResponse(BaseModel):
    url: str

# --- Helpers ---
async def generate_music_task(job_id: str, prompt: str, duration: int):
    """
    Background task to generate music.
    In a real app, this would update a DB status.
    Here we simulate or call API and save to temp.
    """
    print(f"Starting MusicGen Job {job_id}: {prompt} ({duration}s)")
    
    if HF_API_KEY == "your_hf_key":
        print("No HF Key. Skipping real generation.")
        # Mock delay
        await asyncio.sleep(3)
        # We would save a mock file here
        return

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": prompt}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(MUSICGEN_API_URL, headers=headers, json=payload, timeout=60)
            if response.status_code == 200:
                audio_bytes = response.content
                # Save to temp
                filename = f"{job_id}.wav"
                filepath = os.path.join("F:\\download\\temp", filename)
                with open(filepath, "wb") as f:
                    f.write(audio_bytes)
                print(f"MusicGen Job {job_id} Complete: {filepath}")
            else:
                print(f"MusicGen Failed: {response.text}")
    except Exception as e:
        print(f"MusicGen Error: {e}")

# --- Endpoints ---

@router.post("/music/generate", response_model=MusicGenResponse)
async def generate_music(req: MusicGenRequest, background_tasks: BackgroundTasks, request: Request):
    job_id = str(uuid.uuid4())
    
    # In a real system, we'd return a Job ID and have the client poll.
    # For this prototype, we'll return a "Processing" status and a mock URL 
    # (or the client waits/polls).
    # Let's return a mock URL immediately for the UI to "load" (simulated).
    
    # background_tasks.add_task(generate_music_task, job_id, req.prompt, req.duration)
    from app.utils import get_web_url
    
    # Mock Response for Immediate Feedback
    return MusicGenResponse(
        status="success",
        job_id=job_id,
        url=get_web_url(request, f"music_{job_id}.wav"), # Certified dynamic path
        message="Music generation started. (Mock)"
    )

@router.post("/avatar/animate", response_model=AvatarResponse)
async def animate_avatar(
    request: Request,
    image: UploadFile = File(...),
    audio: UploadFile = File(...)
):
    """
    Animates an uploaded face image with uploaded audio.
    """
    # [FIX] Use settings for cross-platform temp directory
    temp_dir = settings.TEMP_DIR
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir, exist_ok=True)
        
    # Save inputs
    image_path = os.path.join(temp_dir, f"input_{uuid.uuid4()}_{image.filename}")
    audio_path = os.path.join(temp_dir, f"input_{uuid.uuid4()}_{audio.filename}")
    
    with open(image_path, "wb") as f:
        shutil.copyfileobj(image.file, f)
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)
        
    # Call Engine
    try:
        output_path = await generate_avatar_video(image_path, audio_path, temp_dir)
        
        # Convert path to URL
        filename = os.path.basename(output_path)
        from app.utils import get_web_url
        url = get_web_url(request, filename)
        
        return AvatarResponse(url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
