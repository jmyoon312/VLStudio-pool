import asyncio
import threading
import time
from typing import List, Dict
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from .editor_engine import build_complex_filter
from .bulk_engine import generate_batch_jobs
from .config import settings
import subprocess
import os

router = APIRouter(prefix="/queue", tags=["queue"])

class BulkRequest(BaseModel):
    template: Dict
    csv_data: List[Dict]
    mapping: Dict

# --- Job Model ---
class JobStatus(BaseModel):
    id: str
    status: str # pending, processing, completed, failed
    progress: int
    output_path: str = None
    error: str = None

# --- In-Memory Queue ---
JOB_QUEUE: List[Dict] = []
ACTIVE_JOBS: Dict[str, Dict] = {}
HISTORY: List[Dict] = []

# --- Worker ---
def process_job(job: Dict):
    """
    Worker function to process a single job.
    """
    job_id = job['id']
    print(f"Starting Job {job_id}")
    
    ACTIVE_JOBS[job_id] = job
    job['status'] = 'processing'
    job['progress'] = 0
    
    try:
        # 1. Extract Project State
        project = job['project_state']
        clips = []
        for track in project.get('tracks', []):
            clips.extend(track.get('clips', []))
            
        # 2. Build Filter Graph
        # [FIX] Use settings for cross-platform directory
        output_dir = os.path.join(settings.MEDIA_ROOT, "output") # Ensure this exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, job['output_filename'])
        
        # We need to call editor_engine.build_complex_filter
        # But wait, build_complex_filter returns (inputs, filter_complex).
        # We need to run the actual ffmpeg command here.
        
        inputs, filter_complex = build_complex_filter(clips, settings.TEMP_DIR)
        
        # 3. Run FFmpeg
        cmd = ["ffmpeg", "-y"]
        cmd.extend(inputs)
        cmd.extend(["-filter_complex", filter_complex])
        cmd.extend(["-map", "[outv]", "-map", "[outa]"])
        cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "23"])
        cmd.extend(["-c:a", "aac", "-b:a", "192k"])
        cmd.append(output_path)
        
        print(f"Rendering Job {job_id}...")
        # Run blocking for simplicity in thread
        subprocess.run(cmd, check=True, capture_output=True)
        
        job['status'] = 'completed'
        job['progress'] = 100
        job['output_path'] = output_path
        
    except Exception as e:
        print(f"Job {job_id} Failed: {e}")
        job['status'] = 'failed'
        job['error'] = str(e)
    finally:
        if job_id in ACTIVE_JOBS:
            del ACTIVE_JOBS[job_id]
        HISTORY.append(job)

def worker_loop():
    """
    Continuous loop to check for jobs.
    """
    while True:
        if JOB_QUEUE:
            # Simple FIFO
            # Check concurrency limit (e.g. 1)
            if len(ACTIVE_JOBS) < 1:
                job = JOB_QUEUE.pop(0)
                # Run in separate thread to not block this loop? 
                # Actually this loop is already in a thread.
                process_job(job)
            else:
                time.sleep(1)
        else:
            time.sleep(1)

# Start Worker Thread
worker_thread = threading.Thread(target=worker_loop, daemon=True)
worker_thread.start()

# --- Endpoints ---

@router.get("/status", response_model=List[JobStatus])
def get_queue_status():
    # Combine Active, Queue, and recent History
    status_list = []
    
    for j in ACTIVE_JOBS.values():
        status_list.append(JobStatus(id=j['id'], status=j['status'], progress=j['progress']))
        
    for j in JOB_QUEUE:
        status_list.append(JobStatus(id=j['id'], status='pending', progress=0))
        
    for j in reversed(HISTORY[-10:]): # Last 10
        status_list.append(JobStatus(id=j['id'], status=j['status'], progress=j['progress'], output_path=j.get('output_path'), error=j.get('error')))
        
    return status_list

@router.post("/add")
def add_jobs(jobs: List[Dict]):
    """
    Internal endpoint or called by bulk_engine to add jobs.
    """
    for job in jobs:
        job['status'] = 'pending'
        JOB_QUEUE.append(job)
    return {"message": f"Added {len(jobs)} jobs to queue"}

@router.post("/bulk")
def create_bulk_jobs(req: BulkRequest):
    jobs = generate_batch_jobs(req.template, req.csv_data, req.mapping)
    for job in jobs:
        job['status'] = 'pending'
        JOB_QUEUE.append(job)
    return {"message": f"Generated and queued {len(jobs)} jobs"}
