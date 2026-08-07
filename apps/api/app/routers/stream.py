from fastapi import APIRouter, Request, HTTPException
import subprocess
import os
import logging
import mimetypes
from fastapi.responses import FileResponse
from .. import dependency_manager

router = APIRouter(tags=["stream"])
logger = logging.getLogger(__name__)

# Global state for the streaming processes
# Key: channel_id (str), Value: subprocess.Popen
active_streams = {}

@router.post("/start")
async def start_stream(request: Request):
    """
    Starts an FFmpeg streaming process for a specific channel.
    Expects JSON: { "channel_id": "...", "rtmp_url": "..." }
    """
    global active_streams
    
    data = await request.json()
    logger.info(f"Start Stream Request Data: {data}")
    channel_id = data.get("channel_id")
    rtmp_url = data.get("rtmp_url")
    
    if not channel_id or not rtmp_url:
        raise HTTPException(status_code=400, detail="Missing channel_id or rtmp_url")
        
    if channel_id in active_streams:
        proc = active_streams[channel_id]
        if proc.poll() is None:
            return {"status": "already_running", "channel_id": channel_id}
        else:
            # Cleanup dead process
            del active_streams[channel_id]

    ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
    
    cmd = [
        ffmpeg_exe,
        '-re', # Read input at native frame rate
        '-i', '-', # Read from stdin
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k', '-maxrate', '3000k', '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p', '-g', '60', # Keyframe interval 2s for 30fps
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-f', 'flv',
        rtmp_url
    ]
    
    logger.info(f"Starting Stream for {channel_id}: {' '.join(cmd)}")
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE # Log stderr if needed
        )
        active_streams[channel_id] = proc
        return {"status": "started", "channel_id": channel_id}
    except Exception as e:
        logger.error(f"Failed to start stream for {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
async def ingest_stream(request: Request):
    """
    Receives binary video chunks and writes them to ALL active FFmpeg processes (Fan-out).
    """
    global active_streams
    
    if not active_streams:
        return {"status": "ignored_no_active_streams"}
        
    try:
        chunk = await request.body()
        if not chunk:
            return {"status": "empty_chunk"}
            
        # Fan-out to all active streams
        dead_channels = []
        for channel_id, proc in active_streams.items():
            if proc.poll() is None:
                try:
                    proc.stdin.write(chunk)
                    proc.stdin.flush()
                except Exception as e:
                    logger.error(f"Write failed to channel {channel_id}: {e}")
                    dead_channels.append(channel_id)
            else:
                dead_channels.append(channel_id)
        
        # Cleanup dead streams
        for cid in dead_channels:
            if cid in active_streams:
                del active_streams[cid]
                
        return {"status": "ok", "active_targets": len(active_streams)}
    except Exception as e:
        logger.error(f"Ingest fan-out failed: {e}")
        return {"status": "error", "detail": str(e)}

import tempfile

@router.post("/lofi/start")
async def start_lofi_stream(request: Request):
    """
    Starts a Headless Lofi Station (Server-side FFmpeg).
    Inputs:
    - channel_id: Target Channel
    - rtmp_url: Full RTMP URL
    - background_path: Path to looping video/image
    - playlist: List of audio file paths
    - playback_order: 'sequential' | 'shuffle' (default sequential for now)
    """
    global active_streams
    
    data = await request.json()
    channel_id = data.get("channel_id")
    rtmp_url = data.get("rtmp_url")
    bg_path = data.get("background_path")
    playlist = data.get("playlist", [])
    
    if not channel_id or not rtmp_url or not bg_path:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    if not os.path.exists(bg_path):
        raise HTTPException(status_code=400, detail=f"Background file not found: {bg_path}")
        
    if not playlist:
        raise HTTPException(status_code=400, detail="Playlist is empty")
        
    # Check if already running
    if channel_id in active_streams:
        proc = active_streams[channel_id]
        if proc.poll() is None:
            return {"status": "already_running", "channel_id": channel_id, "type": "headless"}
        else:
            del active_streams[channel_id]

    # 1. Generate Audio Playlist File for Concat Demuxer
    # Format: file 'path/to/file.mp3'
    try:
        # Create a named temp file that persists so FFmpeg can read it.
        # We use delete=False
        tf = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8')
        for audio_path in playlist:
            if not os.path.exists(audio_path):
                 logger.warning(f"Audio file not found: {audio_path}")
                 continue
            # Escape paths for FFmpeg concat: single quotes and backslashes
            safe_path = audio_path.replace('\\', '/').replace("'", r"'\''")
            tf.write(f"file '{safe_path}'\n")
        tf.close()
        
        playlist_txt_path = tf.name
    except Exception as e:
        logger.error(f"Failed to create playlist file: {e}")
        raise HTTPException(status_code=500, detail="Failed to prepare playlist")

    ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
    
    # 2. Construct FFmpeg Command
    # -stream_loop -1 -i bg.mp4 (Loop Video Infinite)
    # -stream_loop -1 -f concat -safe 0 -i list.txt (Read Audio List Infinite)
    cmd = [
        ffmpeg_exe,
        '-re',
        '-stream_loop', '-1', '-i', bg_path,           # Input 0: Video (Looped)
        '-stream_loop', '-1', '-f', 'concat', '-safe', '0', '-i', playlist_txt_path, # Input 1: Audio Playlist (Looped)
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k', '-maxrate', '3000k', '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p', '-g', '60',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-f', 'flv',
        rtmp_url
    ]
    
    logger.info(f"Starting Headless Lofi for {channel_id}")
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )
        active_streams[channel_id] = proc
        return {"status": "started", "channel_id": channel_id, "mode": "headless"}
    except Exception as e:
        logger.error(f"Failed to start headless stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active")
async def get_active_streams():
    """Returns list of active channel IDs"""
    # Clean up dead ones first
    dead = []
    for cid, proc in active_streams.items():
        if proc.poll() is not None:
            dead.append(cid)
    for d in dead:
        del active_streams[d]
        
    return {"active_channels": list(active_streams.keys())}

@router.post("/stop")
async def stop_stream(request: Request):
    """
    Stops the stream for a specific channel.
    Expects JSON: { "channel_id": "..." }
    """
    global active_streams
    
    data = await request.json()
    channel_id = data.get("channel_id")
    
    if not channel_id:
        raise HTTPException(status_code=400, detail="Missing channel_id")

    if channel_id in active_streams:
        proc = active_streams[channel_id]
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        del active_streams[channel_id]
        
    return {"status": "stopped", "channel_id": channel_id}

# [NEW] File Stream Endpoint for Playback
@router.get("")
async def stream_video(path: str):
    """
    Stream video/media file with smart path resolution.
    Supports:
    - Windows absolute paths (C:\\Users\\...)
    - Docker /app/media/... paths → mapped to MEDIA_ROOT
    - C:/app/media/... garbled paths → mapped to MEDIA_ROOT  
    - C:/ViraLoopMedia/downloads/... legacy paths → mapped to MEDIA_ROOT/downloads
    - Relative paths → resolved against MEDIA_ROOT
    """
    from app.config import settings as app_settings
    MEDIA_ROOT = app_settings.MEDIA_ROOT

    target_path = path

    # Step 1: Try the path as-is (covers valid Windows absolute paths)
    if os.path.exists(target_path):
        pass  # Already resolved

    # Step 2: /app/media/... → MEDIA_ROOT/...
    elif path.startswith("/app/media/"):
        rel = path[len("/app/media/"):]
        target_path = os.path.join(MEDIA_ROOT, rel)

    # Step 3: C:/app/media/... (garbled Docker path on Windows) → MEDIA_ROOT/...
    elif "app/media/" in path or "app\\media\\" in path:
        for marker in ["app/media/", "app\\media\\"]:
            if marker in path:
                rel = path.split(marker, 1)[-1]
                target_path = os.path.join(MEDIA_ROOT, rel)
                break

    # Step 4: C:/ViraLoopMedia/07_Downloads/... or C:/ViraLoopMedia\\07_Downloads\\ → MEDIA_ROOT/07_Downloads/...
    elif "ViraLoopMedia" in path and ("07_Downloads" in path):
        for marker in ["ViraLoopMedia/07_Downloads/", "ViraLoopMedia\\07_Downloads\\"]:
            if marker in path:
                rel = path.split(marker, 1)[-1]
                target_path = os.path.join(MEDIA_ROOT, "07_Downloads", rel)
                break

    # Step 5: Relative path → MEDIA_ROOT
    elif not os.path.isabs(path):
        target_path = os.path.join(MEDIA_ROOT, path.lstrip("/\\"))

    # Final check
    if not os.path.exists(target_path):
        logger.error(f"[Stream 404] Requested: {path!r} | Resolved: {target_path!r}")
        raise HTTPException(status_code=404, detail="File not found")

    media_type, _ = mimetypes.guess_type(target_path)
    return FileResponse(target_path, media_type=media_type or "application/octet-stream")
