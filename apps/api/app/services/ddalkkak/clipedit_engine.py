import asyncio
import os
import json
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import DdalkkakClipEditJob

async def process_clipedit_job(job_id: int):
    """Background task to process a clip edit job (mock implementation)."""
    db: Session = SessionLocal()
    job = None
    try:
        job = db.query(DdalkkakClipEditJob).filter(DdalkkakClipEditJob.id == job_id).first()
        if not job or job.status != 'pending':
            return
        
        job.status = 'processing'
        job.progress = 10
        db.commit()
        
        await asyncio.sleep(2)
        job.progress = 50
        job.progress_message = "Extracting clips..."
        db.commit()
        
        await asyncio.sleep(3)
        job.status = 'completed'
        job.progress = 100
        job.progress_message = "Done"
        job.result_clips = json.dumps(["clip1.mp4", "clip2.mp4"])

    except Exception as e:
        if job:
            job.status = 'failed'
            job.error = str(e)[:200]
    finally:
        if job:
            db.commit()
        db.close()
