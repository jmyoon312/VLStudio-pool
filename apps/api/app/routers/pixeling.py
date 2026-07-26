from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter()

class RenderJob(BaseModel):
    id: str
    script: str
    status: str
    progress: int
    created_at: datetime
    video_url: Optional[str] = None
    error_message: Optional[str] = None

class RenderRequest(BaseModel):
    script: str
    template_id: Optional[str] = "default"

# Mock DB
_jobs = {}

@router.post("/render", response_model=RenderJob)
async def start_render(req: RenderRequest):
    job_id = str(uuid.uuid4())
    job = RenderJob(
        id=job_id,
        script=req.script,
        status="processing",
        progress=0,
        created_at=datetime.utcnow()
    )
    _jobs[job_id] = job
    return job

@router.get("/status/{job_id}", response_model=RenderJob)
async def get_status(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Simulate progress
    job = _jobs[job_id]
    if job.status == "processing":
        job.progress += 25
        if job.progress >= 100:
            job.status = "completed"
            job.video_url = f"https://cdn.pixeling.io/mock/{job_id}.mp4"
            
    return job

@router.get("/gallery", response_model=List[RenderJob])
async def get_gallery():
    return sorted(list(_jobs.values()), key=lambda x: x.created_at, reverse=True)
