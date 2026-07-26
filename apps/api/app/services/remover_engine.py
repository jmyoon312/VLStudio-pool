import os
import cv2
import numpy as np
import subprocess
import uuid
import logging
from app.dependency_manager import DependencyManager

# [FIXED] Correct logger initialization
logger = logging.getLogger(__name__)

class RemoverEngine:
    @staticmethod
    def separate_audio(video_path: str, mode: str) -> str:
        # Lazy Import
        try:
            import torch
            from audio_separator.separator import Separator
        except ImportError:
            raise RuntimeError("Audio separator not installed.")

        # Ensure absolute path
        video_path = os.path.abspath(video_path)
        output_dir = os.path.join(os.path.dirname(video_path), "audio_out")
        os.makedirs(output_dir, exist_ok=True)
        
        separator = Separator(output_dir=output_dir, output_format="mp3")
        model_name = "UVR-MDX-NET-Inst_HQ_3.onnx" if mode == "remove_vocal" else "Kim_Vocal_2.onnx"
        
        try:
            logger.info(f"Loading Audio Model: {model_name}")
            separator.load_model(model_filename=model_name)
            output_files = separator.separate(video_path)
            
            # Cleanup
            del separator
            torch.cuda.empty_cache()
            
            target_stem = "Instrumental" if mode == "remove_vocal" else "Vocals"
            for f in output_files:
                if target_stem in f:
                    return os.path.join(output_dir, f)
            return os.path.join(output_dir, output_files[0])
        except Exception as e:
            logger.error(f"Separation failed: {e}")
            raise e

    @staticmethod
    def remove_visual_object(video_path: str, rois: list) -> str:
        """
        Fast & Stable Object Removal using OpenCV (Navier-Stokes) with Edge Softening.
        """
        # [FIX] Pre-convert to standard H264 to handle AV1 or other tricky codecs
        standardized_path = video_path.replace(".mp4", f"_std_{uuid.uuid4().hex[:6]}.mp4")
        ffmpeg_exe = DependencyManager.get_ffmpeg_path()
        logger.info(f"Standardizing input video: {video_path} -> {standardized_path}")
        try:
            subprocess.run([
                ffmpeg_exe, '-y', '-i', video_path,
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-c:a', 'copy',
                standardized_path
            ], capture_output=True, text=True, check=True)
            video_path = standardized_path
        except Exception as e:
            logger.warning(f"Standardization failed, trying original: {e}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened(): raise RuntimeError(f"Could not open video: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        import imageio
        
        # Use MP4 directly with imageio
        temp_raw = video_path.replace(".mp4", f"_raw_{uuid.uuid4().hex[:6]}.mp4")
        writer = imageio.get_writer(temp_raw, fps=fps, codec='libx264', quality=8)
        
        logger.info(f"Processing {total_frames} frames ({width}x{height} @ {fps}fps) using imageio...")
        
        frame_idx = 0
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                
                # Progress update
                frame_idx += 1
                
                # Visual Processing (Inpainting)
                mask = np.zeros((height, width), dtype=np.uint8)
                for roi in rois:
                    # Frontend gives x,y,width,height
                    x, y, w, h = int(roi.get('x', 0)), int(roi.get('y', 0)), int(roi.get('width', 0)), int(roi.get('height', 0))
                    cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)
                
                # Dilate mask slightly for smoother edges
                kernel = np.ones((5,5), np.uint8)
                mask = cv2.dilate(mask, kernel, iterations=1)
                
                # Inpaint
                inpainted = cv2.inpaint(frame, mask, 3, cv2.INPAINT_TELEA)
                
                # imageio expects RGB
                inpainted_rgb = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
                writer.append_data(inpainted_rgb)
                
                if frame_idx % 100 == 0: 
                    logger.info(f"Processed {frame_idx}/{total_frames} frames")
                    
        finally:
            cap.release()
            try:
                writer.close()
            except: pass
            
        # [DEBUG] Check if raw file exists and has size
        if not os.path.exists(temp_raw) or os.path.getsize(temp_raw) == 0:
            logger.error(f"Raw video file missing or empty: {temp_raw}")
            raise Exception("Processing failed: Internal video buffer is empty.")

        # 3. Final Encode for Web Compatibility
        final_path = video_path.replace(".mp4", f"_clean_{uuid.uuid4().hex[:6]}.mp4")
        ffmpeg_exe = DependencyManager.get_ffmpeg_path()
        
        logger.info(f"Final encoding: {temp_raw} -> {final_path}")
        try:
            result = subprocess.run([
                ffmpeg_exe, '-y', '-i', temp_raw, 
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-an', final_path
            ], capture_output=True, text=True, check=True)
            logger.info("Encoding successful.")
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg Error Output: {e.stderr}")
            raise Exception(f"Encoding failed: {e.stderr}")
        
        if os.path.exists(temp_raw): os.remove(temp_raw)
        return final_path

    @staticmethod
    def merge_media(video_path: str, audio_path: str) -> str:
        output_path = video_path.replace(".mp4", f"_final_{uuid.uuid4().hex[:6]}.mp4")
        ffmpeg_exe = DependencyManager.get_ffmpeg_path()
        
        logger.info(f"Merging Video: {video_path} + Audio: {audio_path}")
        cmd = [
            ffmpeg_exe, '-y',
            '-i', video_path, '-i', audio_path,
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy', '-c:a', 'aac', '-shortest',
            output_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return output_path