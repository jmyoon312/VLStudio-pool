import asyncio
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import DdalkkakDubbingJob

async def process_dubbing_job(job_id: int):
    """Background task to process a dubbing job (mock implementation)."""
    db: Session = SessionLocal()
    job = None
    try:
        job = db.query(DdalkkakDubbingJob).filter(DdalkkakDubbingJob.id == job_id).first()
        if not job or job.status != 'pending':
            return
        
        job.status = 'processing'
        job.progress = 10
        db.commit()
        
        await asyncio.sleep(2)
        job.progress = 50
        job.progress_message = "Generating TTS..."
        db.commit()
        
        await asyncio.sleep(3)
        job.status = 'completed'
        job.progress = 100
        job.progress_message = "Done"

    except Exception as e:
        if job:
            job.status = 'failed'
            job.progress_message = str(e)[:200]
    finally:
        if job:
            db.commit()
        db.close()
