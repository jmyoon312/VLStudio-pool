import asyncio
import os
import uuid
import sys
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import DdalkkakDownloadJob

# We assume standard VLStudio data paths
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
DOWNLOAD_DIR = DATA_DIR / "ddalkkak_downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

def _get_ytdlp() -> str:
    # Try finding yt-dlp in the venv first, else use system
    cand = Path(sys.executable).parent / ("yt-dlp.exe" if sys.platform == "win32" else "yt-dlp")
    if cand.exists():
        return str(cand)
    return shutil.which("yt-dlp") or "yt-dlp"

async def process_download_job(job_id: int):
    """Background task to download a video and update job status."""
    db: Session = SessionLocal()
    job = None
    try:
        job = db.query(DdalkkakDownloadJob).filter(DdalkkakDownloadJob.id == job_id).first()
        if not job or job.status != 'pending':
            return
        
        job.status = 'downloading'
        db.commit()
        
        url = job.url
        fid = uuid.uuid4().hex[:10]
        out_tmpl = str(DOWNLOAD_DIR / f"{fid}.%(ext)s")
        ytdlp = _get_ytdlp()
        
        # Determine title
        title = url
        try:
            tproc = await asyncio.create_subprocess_exec(
                ytdlp, "--skip-download", "--print", "%(title)s", url,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            tout, _ = await asyncio.wait_for(tproc.communicate(), timeout=30)
            t = tout.decode('utf-8', errors='ignore').strip()
            if t:
                title = t
        except Exception:
            pass

        # Perform the actual download
        proc = await asyncio.create_subprocess_exec(
            ytdlp, "-f", "best[ext=mp4][vcodec*=avc1]/best[ext=mp4]/best",
            "-o", out_tmpl, url,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        
        files = list(DOWNLOAD_DIR.glob(f"{fid}.*"))
        if files:
            file_path = files[0]
            size_bytes = file_path.stat().st_size
            job.status = 'completed'
            job.filename = title
            job.file_path = str(file_path.absolute())
            job.size_bytes = size_bytes
        else:
            err = stderr.decode('utf-8', errors='ignore')[-200:] if stderr else "Unknown error downloading."
            job.status = 'failed'
            job.error = err

    except asyncio.TimeoutError:
        if job:
            job.status = 'failed'
            job.error = "Download timed out (300s)."
    except Exception as e:
        if job:
            job.status = 'failed'
            job.error = str(e)[:200]
    finally:
        if job:
            db.commit()
        db.close()
