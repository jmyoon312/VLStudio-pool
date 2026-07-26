import os
import time
import subprocess
import logging
import random
from typing import List
from app import dependency_manager

logger = logging.getLogger(__name__)

class FFmpegService:
    def __init__(self, settings):
        self.settings = settings
        self.ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        from ...config import settings as app_settings
        self.temp_dir = app_settings.TEMP_DIR

    def build_motion_filter(self, aspect_ratio: str, duration: float, motion_config: dict = None) -> str:
        """Constructs complex FFmpeg filters for Ken Burns, Zoom/Pan, and Shake."""
        target_w, target_h = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        ss_factor = 4
        ss_w, ss_h = target_w * ss_factor, target_h * ss_factor

        filters = [
            f"scale={ss_w}:{ss_h}:force_original_aspect_ratio=increase",
            f"crop={ss_w}:{ss_h}",
            "setsar=1"
        ]
        
        if not motion_config or not motion_config.get('enable', True):
            filters.append(f"scale={target_w}:{target_h}")
            return ",".join(filters)

        direction = motion_config.get('direction', 'random')
        speed = float(motion_config.get('speed', 1.0)) * 0.0005
        if direction == 'random':
            direction = random.choice(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down'])
            
        frames = int(duration * 60) + 60 
        zp_expr = ""
        if direction == 'zoom_in':
            zp_expr = f"z='min(zoom+{speed},1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        elif direction == 'zoom_out':
            zp_expr = f"z='if(eq(on,1),1.5,max(zoom-{speed},1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        elif direction == 'pan_left':
            zp_expr = f"z=1.5:x='x+{speed}*iw':y='ih/2-(ih/zoom/2)'"
        elif direction == 'pan_right':
            zp_expr = f"z=1.5:x='x-{speed}*iw':y='ih/2-(ih/zoom/2)'"
        
        if zp_expr:
            filters.append(f"zoompan={zp_expr}:d={frames}:s={target_w}x{target_h}:fps=60")

        if motion_config.get('shake', False):
            filters.append(f"crop=w=iw*0.95:h=ih*0.95:x='(iw-ow)/2+((iw-ow)/2)*sin(n/2)':y='(ih-oh)/2+((ih-oh)/2)*sin(n/3)'")
            filters.append(f"scale={target_w}:{target_h}")

        return ",".join(filters)

    def apply_layout_template(self, video_path: str, template: str) -> str:
        """Applies portrait, split_screen, or blur_bg templates."""
        output_path = os.path.join(self.temp_dir, f"template_{template}_{int(time.time())}.mp4")
        W, H = 1080, 1920
        
        if template == 'portrait_9_16':
            fc = f"scale=-1:{H},crop={W}:{H},setsar=1"
        elif template == 'split_screen':
            fc = f"scale={W}:-1,pad={W}:{H}:0:0:black"
        elif template == 'blur_bg':
            fc = (f"split[bg][fg];[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:20[bg_blur];"
                  f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fg_scaled];[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2")
        else:
            fc = f"scale=-1:{H},crop={W}:{H},setsar=1"
            
        cmd = [self.ffmpeg_exe, '-y', '-i', video_path, '-vf', fc, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'copy', output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    def mix_audio(self, voice_path: str, bgm_path: str, bgm_vol: float = 0.2, ducking: bool = True) -> str:
        """Mixes voice and BGM with sidechain compression (ducking)."""
        output_path = os.path.join(self.temp_dir, f"mixed_{int(time.time())}.mp3")
        if ducking:
            fc = (f"[1:a]volume={bgm_vol}[bgm];[bgm][0:a]sidechaincompress=threshold=0.015:ratio=4:attack=50:release=300[bgm_ducked];"
                  f"[0:a][bgm_ducked]amix=inputs=2:duration=first[aout]")
        else:
            fc = f"[1:a]volume={bgm_vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]"

        cmd = [self.ffmpeg_exe, '-y', '-i', voice_path, '-i', bgm_path, '-filter_complex', fc, '-map', '[aout]', output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    def freeze_and_animate_last_frame(self, video_path: str, target_duration: float, effect: str = "static", aspect_ratio: str = "9:16") -> str:
        """
        Freezes the last frame of the video and applies a Ken Burns effect (Pan/Zoom) 
        to fill the remaining duration until target_duration.
        """
        output_path = os.path.join(self.temp_dir, f"frozen_{int(time.time())}.mp4")
        target_w, target_h = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        
        # 1. Get current video duration
        cmd_dur = [self.ffmpeg_exe, '-i', video_path]
        proc = subprocess.run(cmd_dur, capture_output=True, text=True)
        # Parse duration from stderr
        import re
        match = re.search(r"Duration:\s(\d+):(\d+):(\d+\.\d+)", proc.stderr)
        if not match: return video_path # Fallback
        h, m, s = match.groups()
        current_dur = int(h)*3600 + int(m)*60 + float(s)
        
        if current_dur >= target_duration:
            return video_path
            
        freeze_dur = target_duration - current_dur
        fps = 60
        
        # Complex Filter: 
        # [0:v] -> extract last frame -> apply zoompan -> concat with original
        # This is complex in one line. Simpler: Extract last frame as image, then create second video, then concat.
        last_frame_img = os.path.join(self.temp_dir, f"last_frame_{int(time.time())}.jpg")
        subprocess.run([self.ffmpeg_exe, '-y', '-sseof', '-0.1', '-i', video_path, '-vframes', '1', last_frame_img], check=True)
        
        # Build Ken Burns for the image
        speed = 0.0005
        zp_expr = "z=1.0"
        if effect == 'zoom':
            zp_expr = f"z='min(zoom+{speed},1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        elif effect == 'pan_left':
            zp_expr = f"z=1.5:x='x+{speed}*iw':y='ih/2-(ih/zoom/2)'"
        elif effect == 'pan_right':
            zp_expr = f"z=1.5:x='x-{speed}*iw':y='ih/2-(ih/zoom/2)'"
            
        freeze_video = os.path.join(self.temp_dir, f"freeze_part_{int(time.time())}.mp4")
        fc = f"scale={target_w*4}:{target_h*4}:force_original_aspect_ratio=increase,crop={target_w*4}:{target_h*4},zoompan={zp_expr}:d={int(freeze_dur*fps)}:s={target_w}x{target_h}:fps={fps}"
        
        subprocess.run([self.ffmpeg_exe, '-y', '-loop', '1', '-i', last_frame_img, '-vf', fc, '-t', str(freeze_dur), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', freeze_video], check=True)
        
        # Concat original and freeze
        concat_file = os.path.join(self.temp_dir, f"concat_{int(time.time())}.txt")
        # Relative paths for concat file if needed, but absolute is safer in some versions.
        # Ensure paths use forward slashes for FFmpeg concat format
        v1 = video_path.replace("\\", "/")
        v2 = freeze_video.replace("\\", "/")
        with open(concat_file, 'w') as f:
            f.write(f"file '{v1}'\n")
            f.write(f"file '{v2}'\n")
            
        subprocess.run([self.ffmpeg_exe, '-y', '-f', 'concat', '-safe', '0', '-i', concat_file, '-c', 'copy', output_path], check=True)
        
        return output_path
    def render_beats_hyperframes(self, beats: List[dict], video_id: int, aspect_ratio: str = "9:16") -> str:
        """
        [SOVEREIGN] Hyperframes Multi-Layer Rendering Engine.
        Assembles a sequence of beats with complex visual transforms using FFmpeg.
        """
        output_filename = f"hyper_{video_id}_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)
        target_w, target_h = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        
        # 1. Create individual segments for each beat
        segments = []
        for i, beat in enumerate(beats):
            seg_path = os.path.join(self.temp_dir, f"seg_{video_id}_{i}.mp4")
            
            # Extract source (Video or Image)
            source_url = beat.get('video_url') or beat.get('thumbnail_url')
            if not source_url: continue
            
            # Resolve absolute path (Assume local storage for now)
            from app.utils.path_utils import get_absolute_path
            abs_source = get_absolute_path(source_url)
            
            # Build Transform Filter
            t = beat.get('transform', {})
            scale = t.get('scale', 1.0)
            x_pos = (t.get('x', 0) / 100.0) * target_w
            y_pos = (t.get('y', 0) / 100.0) * target_h
            rotate = t.get('rotate', 0)
            opacity = t.get('opacity', 1.0)
            
            # Complex Filter: Scale -> Rotate -> Pad/Crop -> Overlay
            # For simplicity in this v1, we apply basic scale and padding
            vf = [
                f"scale={int(target_w * scale)}:-1",
                f"pad={target_w}:{target_h}:(ow-iw)/2+({x_pos}):(oh-ih)/2+({y_pos}):black",
                f"format=yuv420p"
            ]
            
            if rotate != 0:
                vf.insert(1, f"rotate={rotate}*PI/180:c=black@0")
            
            cmd = [
                self.ffmpeg_exe, '-y',
                '-i', abs_source,
                '-t', str(beat.get('duration_sec', 5)),
                '-vf', ",".join(vf),
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
                seg_path
            ]
            
            logger.info(f"🎞️ [Hyperframes] Rendering segment {i}: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, capture_output=True)
            segments.append(seg_path)
            
        # 2. Concatenate segments
        if not segments:
            raise ValueError("No segments rendered")
            
        concat_list_path = os.path.join(self.temp_dir, f"concat_{video_id}.txt")
        with open(concat_list_path, "w") as f:
            for s in segments:
                f.write(f"file '{s}'\n")
                
        cmd_concat = [
            self.ffmpeg_exe, '-y',
            '-f', 'concat', '-safe', '0',
            '-i', concat_list_path,
            '-c', 'copy',
            output_path
        ]
        
        logger.info(f"🎬 [Hyperframes] Final assembly: {' '.join(cmd_concat)}")
        subprocess.run(cmd_concat, check=True, capture_output=True)
        
        # Cleanup segments
        for s in segments:
            try: os.remove(s)
            except: pass
            
        return output_path
