from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.services.channel_monitor import run_channel_scan
from app.services.scheduler import update_video_stats
from app.database import SessionLocal
import os
import asyncio

router = APIRouter(tags=["Logs"])

import logging

# [FIX] Define LOG_FILE - must match where channel_monitor.py writes
# channel_monitor.py: 3x dirname from .../app/services/ => apps/api/
# logs.py:            2x dirname from .../app/routers/ => apps/api/app/  (WRONG, needs one more)
# Correct: dirname x3 from this file => apps/api/
API_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_FILE = os.path.join(API_DIR, "scan_debug.log")

@router.get("/scheduler")
async def get_scheduler_logs(lines: int = 100):
    """
    Reads the last N lines of the scheduler log file.
    Returns them in reverse order (newest first).
    """
    if not os.path.exists(LOG_FILE):
        # Create empty file if not exists to avoid empty list issues
        try:
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.write("INFO: [System] Scan log initialized.\n")
        except:
            return {"logs": ["No logs generated yet."]}
        
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            # Tail default 100
            last_lines = all_lines[-lines:]
            # Reverse for display
            last_lines.reverse()
            return {"logs": [line.strip() for line in last_lines]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")

@router.delete("/scheduler")
async def clear_scheduler_logs():
    """
    Clears the content of the scheduler log file.
    """
    try:
        # Open in write mode to truncate
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write("")
        return {"status": "success", "message": "Logs cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}")

async def full_scan_sequence():
    """
    Runs channel scan followed by stats update.
    """
    # 1. Run Scan
    await run_channel_scan()
    
    # 2. Run Stats Update
    print("⏳ Starting Post-Scan Stats Update...")
    try:
        # We need to run this in a thread because it might be sync? 
        # update_video_stats is sync (uses blocking DB calls).
        # Wrapper to maintain DB session
        def run_stats_sync():
            db = SessionLocal()
            try:
                update_video_stats(db)
            finally:
                db.close()
                
        await asyncio.to_thread(run_stats_sync)
        print("✅ Post-Scan Stats Update Completed.")
    except Exception as e:
        print(f"❌ Post-Scan Stats Update Failed: {e}")

@router.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    """
    Manually triggers the channel scan AND stats update in the background.
    """
    background_tasks.add_task(full_scan_sequence)
    return {"status": "success", "message": "Full scan (Download + Stats) started in background"}
