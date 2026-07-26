import os
import subprocess
import json
import logging
import asyncio
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)

class FFmpegGenerator:
    def __init__(self, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe"):
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path
        # Use absolute path for temp dir to avoid CWD confusion
        self.temp_dir = Path("temp_ffmpeg_gen").resolve()
        self.temp_dir.mkdir(exist_ok=True)

    def _run_cmd(self, cmd):
        return subprocess.run(cmd, capture_output=True)

    async def get_duration(self, file_path: str) -> float:
        cmd = [
            self.ffprobe_path, "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", file_path
        ]
        try:
            # Run synchronously in a thread to avoid Windows asyncio subprocess issues
            result = await asyncio.to_thread(self._run_cmd, cmd)
            
            if result.returncode != 0:
                logger.error(f"ffprobe failed (code {result.returncode}): {result.stderr.decode(errors='replace')}")
                return 0.0
                
            val = result.stdout.decode().strip()
            if not val:
                 logger.warning("ffprobe returned empty output")
                 return 0.0
            return float(val)

        except FileNotFoundError:
            logger.error(f"ffprobe binary not found at '{self.ffprobe_path}'")
            return 0.0
        except Exception as e:
            logger.error(f"Error getting duration: {repr(e)}")
            return 0.0

    async def create_seamless_video_loop(self, input_path: str, crossfade: float = 1.0) -> str:
        """
        Creates a single seamless iteration of the video.
        """
        duration = await self.get_duration(input_path)
        if duration <= crossfade:
             logger.warning(f"Video too short for crossfade ({duration}s <= {crossfade}s). using original.")
             return input_path 

        output_path = self.temp_dir / f"seamless_{Path(input_path).name}"
        
        # Filter Graph: Overlay the end (faded out) onto the start
        filter_complex = (
            f"[0:v]split[main][tail];"
            f"[tail]trim=start={duration-crossfade},setpts=PTS-STARTPTS,format=yuva420p,fade=t=out:st=0:d={crossfade}:alpha=1[faded_tail];"
            f"[main]trim=duration={duration-crossfade},setpts=PTS-STARTPTS[base];"
            f"[base][faded_tail]overlay=0:0:eof_action=pass[out]"
        )

        cmd = [
            self.ffmpeg_path, "-y", "-i", input_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
             str(output_path)
        ]
        
        logger.info(f"Creating seamless loop: {' '.join(cmd)}")
        try:
            result = await asyncio.to_thread(self._run_cmd, cmd)
            
            if result.returncode != 0:
                err_msg = result.stderr.decode(errors='replace')
                logger.error(f"FFmpeg seamless loop failed (code {result.returncode}): {err_msg}")
                raise Exception(f"Seamless loop failed: {err_msg}")
                
            return str(output_path)
            
        except FileNotFoundError:
            raise Exception(f"FFmpeg binary not found at '{self.ffmpeg_path}'")

    async def generate_lofi(self, bg_path: str, audio_paths: List[str], duration: int, output_file: str, crossfade: float = 1.0):
        # 1. Create Seamless Loop
        seamless_bg = await self.create_seamless_video_loop(bg_path, crossfade=crossfade)
        
        # 2. Build Audio Chain
        concat_file = self.temp_dir / "audio_list.txt"
        with open(concat_file, "w", encoding='utf-8') as f:
            for path in audio_paths:
                # Escape path for concat demuxer
                safe_path = path.replace("'", "'\\''")
                f.write(f"file '{safe_path}'\n")
        
        # 3. Main Command
        cmd = [
            self.ffmpeg_path, "-y",
            "-stream_loop", "-1", "-i", seamless_bg,
            "-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", str(concat_file),
            "-t", str(duration),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", 
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", 
            output_file
        ]
        
        logger.info(f"Running FFmpeg: {' '.join(cmd)}")
        try:
            result = await asyncio.to_thread(self._run_cmd, cmd)
            
            if result.returncode != 0:
                err_msg = result.stderr.decode(errors='replace')
                logger.error(f"FFmpeg generate_lofi failed (code {result.returncode}): {err_msg}")
                raise Exception(f"FFmpeg render failed: {err_msg}")
                
            return output_file
        except FileNotFoundError:
             raise Exception(f"FFmpeg binary not found at '{self.ffmpeg_path}'")
        except Exception as e:
             logger.error(f"Generate Lofi Exception: {repr(e)}")
             raise e
