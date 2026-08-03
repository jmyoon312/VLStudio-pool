import os
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

from app.dependency_manager import DependencyManager

async def run_command(*args):
    """Run an async subprocess command."""
    # Ensure ffmpeg uses the globally configured path
    cmd_args = list(args)
    if cmd_args[0] == 'ffmpeg':
        cmd_args[0] = DependencyManager.get_ffmpeg_path()
        
    process = await asyncio.create_subprocess_exec(
        *cmd_args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        logger.error(f"Command failed: {' '.join(cmd_args)}\nError: {stderr.decode()}")
        raise RuntimeError(f"FFmpeg command failed: {stderr.decode()}")
        
    return stdout.decode()

async def cut_video(input_path: str, output_path: str, start_time: float, end_time: float) -> str:
    """
    Cuts a video using ffmpeg without re-encoding (-c copy).
    Returns the output path.
    """
    duration = end_time - start_time
    if duration <= 0:
        raise ValueError("End time must be greater than start time")
        
    await run_command(
        'ffmpeg',
        '-y', # Overwrite output files
        '-ss', str(start_time),
        '-i', input_path,
        '-t', str(duration),
        '-c', 'copy',
        output_path
    )
    
    return output_path

async def extract_audio(input_path: str, output_path: str) -> str:
    """Extract audio track from video."""
    await run_command(
        'ffmpeg',
        '-y',
        '-i', input_path,
        '-q:a', '0',
        '-map', 'a',
        output_path
    )
    return output_path

async def merge_video_audio(video_path: str, audio_path: str, output_path: str) -> str:
    """Merges a video file and an audio file (replacing original audio)."""
    await run_command(
        'ffmpeg',
        '-y',
        '-i', video_path,
        '-i', audio_path,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-map', '0:v:0',
        '-map', '1:a:0',
        output_path
    )
    return output_path
