import os
import subprocess
import json
import uuid
from app.dependency_manager import DependencyManager

class MediaProcessor:
    def __init__(self):
        self.ffmpeg_path = DependencyManager.get_ffmpeg_path()
        # If ffmpeg_path is a directory, append ffmpeg.exe
        if os.path.isdir(self.ffmpeg_path):
             self.ffmpeg_exe = os.path.join(self.ffmpeg_path, "ffmpeg.exe" if os.name == 'nt' else "ffmpeg")
        else:
             self.ffmpeg_exe = self.ffmpeg_path if os.path.exists(self.ffmpeg_path) else "ffmpeg"
             
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "07_Downloads", "_processed")
        os.makedirs(self.output_dir, exist_ok=True)

    def process(self, input_path: str, tasks: list):
        """
        Refactored entry point for simple task list execution.
        tasks: ["trim", "normalize", "proxy"] (simplified)
        For V3 MVP, we focus on a unified 'standardize' pipeline for Shorts.
        """
        # Current Logic:
        # 1. Normalize Audio (loudnorm) + Recode to standard MP4 (h264/aac)
        # 2. If 'trim' needed, we'd need timestamps.
        
        # NOTE: For simplicity, we just create a "Standardized" version:
        # - h264 video, aac audio
        # - -16 LUFS audio normalization
        # - 30fps (for Remotion consistency)
        
        filename = f"proc_{uuid.uuid4()}.mp4"
        output_path = os.path.join(self.output_dir, filename)
        
        # FFmpeg command for robust standardization
        # -y: overwrite
        # -af loudnorm: Normalize Audio to -14 LUFS (Broadcast Standard)
        # -vf scale='if(gt(iw,ih),1280,-1):if(gt(iw,ih),-1,1280)': Standard 720p/Wide/Vert
        # -r 30: fixed framerate
        cmd = [
            self.ffmpeg_exe, "-y",
            "-i", input_path,
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", # Ensure even dimensions for h264
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-r", "30",
            "-c:a", "aac", "-b:a", "192k",
            output_path
        ]
        
        # Check for trim request in tasks?
        # If tasks is list of strings, it's generic.
        # Ideally tasks should be list of dicts: [{"name": "trim", "start": 0, "end": 10}]
        # But Bridge API currently passed `tasks: ["trim", "normalize"]` with no params.
        # We assume full file standardization for now.
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return output_path
        except subprocess.CalledProcessError as e:
            raise Exception(f"FFmpeg Error: {e.stderr.decode()}")

    def extract_clip(self, input_path, start, duration):
        filename = f"clip_{uuid.uuid4()}.mp4"
        output_path = os.path.join(self.output_dir, filename)
        
        # Fast Stream Copy
        cmd = [
            self.ffmpeg_exe, "-y",
            "-ss", str(start),
            "-i", input_path,
            "-t", str(duration),
            "-c", "copy",
            output_path
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return output_path
        except subprocess.CalledProcessError as e:
            # Fallback to re-encoding if codec issues (stream copy can be finicky)
            print("Stream copy failed, falling back to re-encode...")
            cmd[cmd.index("-c") + 1] = "libx264" # Replace copy with libx264
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return output_path

media_processor = MediaProcessor()
