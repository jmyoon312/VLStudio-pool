from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models import DdalkkakDownloadJob, DdalkkakSubtitleJob, DdalkkakDubbingJob, DdalkkakClipEditJob
from app.services.ddalkkak.downloader import process_download_job
from app.services.ddalkkak.subtitle_engine import process_subtitle_job
from app.services.ddalkkak.dubbing_engine import process_dubbing_job
from app.services.ddalkkak.clipedit_engine import process_clipedit_job

router = APIRouter(prefix="/ddalkkak", tags=["ddalkkak"])

# ========================================================
# 1. URL Download
# ========================================================
@router.post("/download-urls")
def create_download_jobs(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    urls = payload.get("urls", [])
    if not urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    user_id = None
    
    jobs = []
    for url in urls:
        job = DdalkkakDownloadJob(
            url=url,
            status="pending",
            user_id=user_id
        )
        db.add(job)
        jobs.append(job)
    
    db.commit()
    for job in jobs:
        db.refresh(job)
        background_tasks.add_task(process_download_job, job.id)
        
    return {"status": "success", "jobs": [{"id": j.id, "url": j.url} for j in jobs]}

@router.get("/downloads")
def list_download_jobs(db: Session = Depends(get_db)):
    jobs = db.query(DdalkkakDownloadJob).order_by(DdalkkakDownloadJob.id.desc()).limit(50).all()
    return jobs

@router.delete("/downloads/{job_id}")
def delete_download_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(DdalkkakDownloadJob).filter(DdalkkakDownloadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"status": "success"}

# ========================================================
# 2. Subtitle Generation
# ========================================================
@router.post("/subtitle/upload")
def create_subtitle_job(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    import os
    
    filename = payload.get("filename")
    style = payload.get("style", "shorts")
    
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Assuming files are in data/ddalkkak_downloads/
    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "ddalkkak_downloads")
    video_path = os.path.join(base_dir, filename)

    user_id = None
    job = DdalkkakSubtitleJob(
        video_filename=filename,
        video_path=video_path,
        style=style,
        status="pending",
        user_id=user_id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_subtitle_job, job.id)
    return {"status": "success", "job_id": job.id}

@router.get("/subtitle/jobs")
def list_subtitle_jobs(db: Session = Depends(get_db)):
    jobs = db.query(DdalkkakSubtitleJob).order_by(DdalkkakSubtitleJob.id.desc()).limit(50).all()
    return jobs

@router.get("/subtitle/jobs/{job_id}")
def get_subtitle_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(DdalkkakSubtitleJob).filter(DdalkkakSubtitleJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

# ========================================================
# 3. TTS Dubbing
# ========================================================
@router.post("/dubbing/jobs")
def create_dubbing_job(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user_id = None
    job = DdalkkakDubbingJob(
        status="pending",
        user_id=user_id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_dubbing_job, job.id)
    return {"status": "success", "job_id": job.id}

@router.get("/dubbing/jobs")
def list_dubbing_jobs(db: Session = Depends(get_db)):
    jobs = db.query(DdalkkakDubbingJob).order_by(DdalkkakDubbingJob.id.desc()).limit(50).all()
    return jobs

# ========================================================
# 4. Clip Edit
# ========================================================
@router.post("/clip-edit/jobs")
def create_clip_edit_job(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user_id = None
    job = DdalkkakClipEditJob(
        status="pending",
        user_id=user_id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_clipedit_job, job.id)
    return {"status": "success", "job_id": job.id}

@router.get("/clip-edit/jobs")
def list_clip_edit_jobs(db: Session = Depends(get_db)):
    jobs = db.query(DdalkkakClipEditJob).order_by(DdalkkakClipEditJob.id.desc()).limit(50).all()
    return jobs
