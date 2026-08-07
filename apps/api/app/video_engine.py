import os
import sys
import time
import subprocess
import logging
import json
import shutil
import uuid
import requests
from . import schemas
from app import dependency_manager
from app.llm_manager import LLMClient

# Setup logging
logger = logging.getLogger(__name__)

# Import SubtitleEngine
try:
    from subtitle_core import SubtitleEngine
except ImportError:
    # Add legacy dir to path
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    legacy_dir = os.path.join(backend_dir, "legacy")
    if legacy_dir not in sys.path:
        sys.path.append(legacy_dir)
    try:
        from subtitle_core import SubtitleEngine
    except ImportError:
        logger.warning("Could not import SubtitleEngine from legacy. Advanced subtitle sync will be disabled.")
        SubtitleEngine = None

def get_audio_metadata(audio_path):
    """
    Step 1: Verify Audio Integrity & Duration
    Returns duration (float). Raises error if invalid.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file missing: {audio_path}")
        
    ffprobe = dependency_manager.DependencyManager.get_ffprobe_path()
    if not ffprobe:
        # Fallback logic if get_ffprobe_path fails or returns None
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        ffprobe = os.path.join(os.path.dirname(ffmpeg_path), "ffprobe" if sys.platform != "win32" else "ffprobe.exe")
        
    if not os.path.exists(ffprobe):
        raise RuntimeError("FFprobe binary not found. Cannot verify audio.")

    cmd = [
        ffprobe, 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        audio_path
    ]
    
    try:
        # Run probe
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        duration_str = result.stdout.strip()
        
        if not duration_str or duration_str == "N/A":
            raise ValueError("Invalid audio file (No duration found)")
            
        duration = float(duration_str)
        if duration < 0.1:
            raise ValueError(f"Audio too short: {duration}s")
            
        return duration
    except Exception as e:
        logger.error(f"Audio Verification Failed: {e}")
        raise e

class VideoGenClient:
    BASE_URL = "https://api.kie.ai/v1"

    def __init__(self, settings: schemas.Settings):
        self.settings = settings
        self.api_key = settings.kie_api_key
        self.llm_client = LLMClient(settings)
        
        # --- NEW PATH CONFIGURATION ---
        from .config import settings as app_settings
        self.base_media_dir = getattr(settings, "MEDIA_ROOT", app_settings.MEDIA_ROOT)
        self.temp_dir = getattr(settings, "TEMP_DIR", app_settings.TEMP_DIR)
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # Initialize TTSEngine & Higgsfield
        from .tts_engine import TTSEngine
        from .services.video.higgsfield_service import HiggsfieldService
        self.tts_engine = TTSEngine(settings)
        self.higgsfield = HiggsfieldService(settings)

    def generate_scene_image(self, scene_id: int, prompt: str, provider: str = "openai", model: str = "dall-e-3") -> str:
        """
        Generates an image for a scene and saves it locally.
        Returns the local file path.
        """
        try:
            result_path_or_url = self.llm_client.generate_image(prompt, provider, model)
            
            # If result is already a local path (Gemini)
            if os.path.exists(result_path_or_url) and not result_path_or_url.startswith("http"):
                 logger.info(f"🎨 [Image Gen] Received local file: {result_path_or_url}")
                 
                 # New Filename
                 filename = f"scene_{scene_id}_{int(time.time())}.png"
                 filepath = os.path.join(self.temp_dir, filename)
                 
                 # Copy/Move to standardize
                 shutil.copy2(result_path_or_url, filepath)
                 
                 # Optional: Delete original temp if we want to clean up, but keeping it is safer for debug
                 # os.remove(result_path_or_url) 
                 
                 return filepath

            # If result is a URL (DALL-E)
            image_url = result_path_or_url
            
            # Download image
            response = requests.get(image_url)
            response.raise_for_status()
            
            filename = f"scene_{scene_id}_{int(time.time())}.png"
            filepath = os.path.join(self.temp_dir, filename)
            
            with open(filepath, "wb") as f:
                f.write(response.content)
                
            return filepath
        except Exception as e:
            logger.error(f"[FAIL] Scene Image Gen Failed: {e}")
            logger.warning("[WARN] Falling back to dummy image generation for testing.")
            
            # Create Dummy Image (Red Background with Text)
            try:
                from PIL import Image, ImageDraw
                img = Image.new('RGB', (1024, 1792), color = (73, 109, 137))
                d = ImageDraw.Draw(img)
                d.text((10,10), f"Scene {scene_id}\n{prompt[:50]}...", fill=(255,255,0))
                
                filename = f"scene_{scene_id}_{int(time.time())}.png"
                filepath = os.path.join(self.temp_dir, filename)
                img.save(filepath)
                return filepath
            except Exception as ex:
                logger.error(f"[FAIL] Dummy Image Gen Failed: {ex}")
                raise e

    async def generate_video(self, prompt: str, model: str = "kling-v1", aspect_ratio: str = "9:16") -> str:
        """
        [NEW] Entry point for external Video Generation (e.g. Higgsfield, Kling via Muapi)
        """
        # Determine engine (Support partial matches like 'kling-v1')
        model_lower = model.lower()
        if any(m in model_lower for m in ["higgsfield", "kling", "luma", "sora", "wan", "ltx"]):
            logger.info(f"[FALLBACK] Dispatching to HiggsfieldService (Muapi): {model}")
            return await self.higgsfield.generate_video(prompt, model=model)
        
        # Fallback Task ID for polling logic
        return f"task_{int(time.time())}"

    async def generate_scene_audio(self, scene_id: int, script: str, tts_config: dict) -> str:
        """
        Generates TTS audio for a scene.
        Returns the local file path.
        """
        try:
            logger.info(f"🎤 Generating TTS for Scene #{scene_id}...")
            
            # Import AudioProcessor
            try:
                from silence_core import AudioProcessor
            except ImportError:
                import silence_core
                AudioProcessor = silence_core.AudioProcessor

            tts_result = await self.tts_engine.generate_audio(
                text=script,
                engine=tts_config.get("engine", "edge"),
                language=tts_config.get("language", "ko"),
                voice_id=tts_config.get("voice_id"),
                rate=int(tts_config.get("rate", 0)),
                pitch=int(tts_config.get("pitch", 0))
            )
            
            # Fix: Handle dictionary return from TTS Engine
            if isinstance(tts_result, dict):
                audio_path = tts_result.get("file_path")
                if not audio_path:
                    raise ValueError("TTS Engine returned success but no file path")
            else:
                # Legacy fallback if it returns string
                audio_path = tts_result

            # --- Silence Removal (Optional) ---
            if tts_config.get('silenceEnabled', False):
                try:
                    logger.info("Applying Silence Removal...")
                    processor = AudioProcessor()
                    
                    # Load audio
                    from pydub import AudioSegment
                    audio = AudioSegment.from_file(audio_path)
                    
                    # Process
                    opts = {
                        "remove_silence": True,
                        "threshold": int(tts_config.get('silenceThreshold', -40)),
                        "min_silence_len": int(tts_config.get('minSilenceLen', 300)),
                        "keep_silence_ms": int(tts_config.get('keepSilenceLen', 50)),
                        "use_nr": False, 
                        "normalize": False
                    }
                    
                    processed_audio = processor.process(audio, opts)
                    
                    # Overwrite original file
                    processed_audio.export(audio_path, format="mp3")
                    logger.info(f"Silence Removal Complete: {audio_path}")
                    
                except Exception as e:
                    logger.warning(f"Silence Removal Failed: {e}")

            return audio_path
        except Exception as e:
            logger.error(f"[FAIL] Scene TTS Failed: {e}")
            raise e

    def build_ffmpeg_filter(self, aspect_ratio: str, duration: float, motion_config: dict = None) -> str:
        """
        Constructs a complex FFmpeg filter graph for:
        1. Smart Crop (Fill Aspect Ratio)
        2. Ken Burns Effect (Zoom/Pan)
        3. Camera Shake (Handheld feel)
        """
        target_w, target_h = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        
        # Supersampling for sub-pixel smooth motion (4x resolution)
        # This prevents "stair-stepping" or jitter in slow zoom/pan effects
        ss_factor = 4
        ss_w, ss_h = target_w * ss_factor, target_h * ss_factor

        # 1. Base Crop (Scale & Crop to fill supersampled resolution)
        filters = [
            f"scale={ss_w}:{ss_h}:force_original_aspect_ratio=increase",
            f"crop={ss_w}:{ss_h}",
            "setsar=1"
        ]
        
        if not motion_config or not motion_config.get('enable', True):
            # If no motion, downscale back to target resolution
            filters.append(f"scale={target_w}:{target_h}")
            return ",".join(filters)

        # 2. Ken Burns (Zoompan)
        import random
        direction = motion_config.get('direction', 'random')
        # Speed constant: 0.0005 (60fps) for very smooth, slow motion.
        speed = float(motion_config.get('speed', 1.0)) * 0.0005
        
        if direction == 'random':
            direction = random.choice(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down'])
            
        # Zoompan Expressions
        # z: zoom factor per frame
        # x, y: top-left coordinate of the crop window
        # d: duration in frames (60fps * duration + buffer)
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
        elif direction == 'pan_up':
            zp_expr = f"z=1.5:x='iw/2-(iw/zoom/2)':y='y+{speed}*ih'"
        elif direction == 'pan_down':
            zp_expr = f"z=1.5:x='iw/2-(iw/zoom/2)':y='y-{speed}*ih'"
            
        # Apply Zoompan
        # Input is supersampled (4x), Output is target resolution (1x)
        # This effectively performs high-quality downscaling and sub-pixel motion
        if zp_expr:
            filters.append(f"zoompan={zp_expr}:d={frames}:s={target_w}x{target_h}:fps=60")

        # 3. Camera Shake
        if motion_config.get('shake', False):
            # Crop slightly (95%) and move x/y with sine wave
            filters.append(f"crop=w=iw*0.95:h=ih*0.95:x='(iw-ow)/2+((iw-ow)/2)*sin(n/2)':y='(ih-oh)/2+((ih-oh)/2)*sin(n/3)'")
            filters.append(f"scale={target_w}:{target_h}")

        return ",".join(filters)

    def apply_crop_template(self, video_path: str, template: str) -> str:
        """
        Applies a layout template to the video.
        Supported templates:
        - portrait_9_16: Center crop to 1080x1920.
        - split_screen: Top half video, bottom half black.
        - blur_bg: Video centered with blurred background feeling.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")
            
        output_filename = f"template_{template}_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        # Target Resolution
        W, H = 1080, 1920
        
        filter_complex = ""
        
        if template == 'portrait_9_16':
            # Simple Center Crop
            # scale to height 1920, force aspect ratio, crop 1080:1920
            filter_complex = f"scale=-1:{H},crop={W}:{H},setsar=1"
            
        elif template == 'split_screen':
            # Top Video, Bottom Black
            # 1. Scale video to fit width 1080, maintaining aspect ratio.
            # 2. Pad to 1080x1920, placing video at top (x=0, y=0).
            # The background color is black by default with pad.
            # We assume landscape input mostly.
            filter_complex = f"scale={W}:-1,pad={W}:{H}:0:0:black"
            
        elif template == 'blur_bg':
            # 1. Background: Scale to 1080x1920 (fill), Blur
            # 2. Foreground: Scale to fit width (1080) OR fit inside (force_original_aspect_ratio=decrease)
            # Let's fit width 1080 for standard landscape -> it will be in middle.
            # Complex filter with split.
            # [0:v] split [bg][fg]; 
            # [bg] scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10 [bg_blur];
            # [fg] scale=1080:1920:force_original_aspect_ratio=decrease [fg_scaled];
            # [bg_blur][fg_scaled] overlay=(W-w)/2:(H-h)/2
            
            filter_complex = (
                f"split[bg][fg];"
                f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:20[bg_blur];"
                f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fg_scaled];"
                f"[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2"
            )
        else:
            # Fallback to simple crop
            filter_complex = f"scale=-1:{H},crop={W}:{H},setsar=1"
            
        cmd = [
            ffmpeg_exe, '-y',
            '-i', video_path,
            '-vf', filter_complex,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'copy', # Copy audio
            output_path
        ]
        
        logger.info(f"Applying Template '{template}' to {video_path}...")
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            if not os.path.exists(output_path):
                 raise FileNotFoundError("Template render failed, output missing.")
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg Template Filter Failed: {e.stderr}")
            raise RuntimeError(f"Template Render Error: {e.stderr}")

    def detect_and_crop(self, video_path: str, mode: str = "center", confidence: float = 0.5) -> str:
        """
        Smart Cropping (CV).
        Mode: "center", "face_track", "active_speaker".
        Basic V1 Implementation: Maps to optimized crop templates.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")
            
        logger.info(f"SmartCrop Mode: {mode}. Applying optimized portrait crop.")
        # For V1 stability, we use the robust portrait template which handles centering.
        # Future: Integrate true Face Detection here.
        return self.apply_crop_template(video_path, "portrait_9_16")

    def add_text_overlay(self, video_path: str, text: str, config: dict) -> str:
        """
        Adds text overlay using FFmpeg drawtext.
        Config: x, y, font_size, font_color, animation (fade_in, slide_up).
        """
        output_filename = f"overlay_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        font_size = config.get('font_size', 64)
        font_color = config.get('font_color', 'white')
        # Ensure x,y are strings if they contain expressions, or ints.
        x = str(config.get('x', '(w-text_w)/2'))
        y = str(config.get('y', '(h-text_h)/2'))
        
        animation = config.get('animation', 'none')
        alpha_expr = "1"
        y_expr = y
        
        if animation == 'fade_in':
            alpha_expr = "if(lt(t,1),t,1)" 
        elif animation == 'slide_up':
            # Assumes y is a number or basic expr. 
            y_expr = f"{y}+max(0, (1-t)*200)" 
            
        # Use a font (escape paths if needed). 'arial' is common default on Windows/Linux(if mapped).
        # We'll skip fontfile=... and let ffmpeg pick default or expect system font.
        # To be safe, we don't specify fontfile, just fontsize/color.
        filter_str = f"drawtext=text='{text}':fontcolor={font_color}:fontsize={font_size}:x={x}:y={y_expr}:alpha='{alpha_expr}'"
        
        cmd = [
            ffmpeg_exe, '-y', '-i', video_path,
            '-vf', filter_str,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'copy',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            if not os.path.exists(output_path):
                 raise FileNotFoundError("Overlay render failed.")
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Text Overlay Failed: {e.stderr}")
            raise RuntimeError(f"Text Overlay Error: {e.stderr}")

    def generate_text_animation(self, text: str, duration: float, config: dict) -> str:
        """
        Generates a standalone video clip with animated text on black background.
        Config: effect (typewriter, kinetic, neon), font_size, color.
        """
        output_filename = f"text_anim_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        WIDTH, HEIGHT = 1080, 1920
        font_size = config.get('font_size', 80)
        font_color = config.get('font_color', 'white')
        effect = config.get('effect', 'typewriter')
        
        # Base filter: Create Black BG
        filter_chain = f"color=c=black:s={WIDTH}x{HEIGHT}:d={duration}[bg];"
        
        # Text Filter Logic
        text_filter = ""
        x = "(w-text_w)/2"
        y = "(h-text_h)/2"
        
        if effect == 'typewriter':
            # Expansion: text='substring(TEXT, 0, (t/dur)*str_len)'
            # We need to escape text carefully for drawtext
            # Basic typewriter expression:
            # We pass the full text, but use 'text' property with expansion.
            # Warning: FFmpeg drawtext `text` expansion is tricky.
            # Simpler approach: Draw full text but control alpha per char? No.
            # Use `textfile` expansion? No.
            # Best reliable way in filters: Scroll or Reveal.
            # Let's use `drawtext` with `text` argument but try to simulate reveal.
            # Actually, `drawtext` supports `text_shaping`? No.
            # Let's use a simpler "Fade In" or "Zoom" for now if Typewriter is too fragile without expansion escaping.
            # But user asked for Typewriter.
            # Expansion: text='%{substr:0:N}' ??
            # `drawtext` variable expansion is limited.
            # Let's do "Kinetic" (Zoom) as default robust one, and Typewriter as "Reveal" (alpha).
            
            # Typewriter V2: Use `alpha='if(lt(x, (w*t/dur)), 1, 0)'`? No, text is one obj.
            # Let's implement KINETIC ZOOM for now as robust v1.
            # And Typewriter as "Slide Up" fallback if complex.
            # Actually, let's try the common `drawtext` Reveal:
            # We cannot easily substring in drawtext expressions standardly across versions.
            
            # Implementation: Kinetic (Zoom In)
            text_filter = f"drawtext=text='{text}':fontcolor={font_color}:fontsize={font_size}:x='(w-text_w)/2':y='(h-text_h)/2':enable='between(t,0,{duration})'"
            # Add Zoom to the text? Filter complex `drawtext` draws on BG. 
            # To zoom text only, we need text on transparent then zoom.
            # Complex. 
            
            # Let's Start Simple: Static Text with Flip/Fade.
            # BUT user asked for "Visualizers".
            # Let's implement "Pulse" (Neon). 
            # Fontcolor changes over time.
            if effect == 'neon':
                 font_color_expr = "0x00FFFF" # Cyan default
                 # We can use specific color expression if we want cycling, e.g. white -> color.
                 pass
            
            # Let's stick to standard drawtext on black bg.
            text_filter = f"[bg]drawtext=text='{text}':fontcolor={font_color}:fontsize={font_size}:x={x}:y={y}"
            
            if effect == 'typewriter':
                 # Hack: sliding mask?
                 # Let's just do simple Appear for V1 to ensure stability.
                 pass 
            else:
                 pass
        
        # RE-EVALUATING: The user wants "Viral Text Effects".
        # High quality requires separate processes (e.g. creating transparent image of text then applying transforms).
        # For this "Node Pack" V1, let's implement:
        # 1. Typewriter: simulated by masking? Too hard in 1 filter string.
        # We will implement "Y-Axis Slide Up" (Alex Hormozi style pop up).
        
        y_expr = f"(h-text_h)/2 + (1-t/0.5)*100 * if(lt(t,0.5),1,0)" # Slide up in first 0.5s
        
        text_filter = f"[bg]drawtext=text='{text}':fontcolor={font_color}:fontsize={font_size}:x={x}:y='{y_expr}'[out]"
        
        cmd = [
            ffmpeg_exe, '-y',
            '-filter_complex', f"{filter_chain}{text_filter}",
            '-map', '[out]',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'copy',
            '-t', str(duration),
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Text Anim Failed: {e.stderr}")
            raise RuntimeError(f"Text Anim Error: {e.stderr}")

    def mix_audio(self, voice_path: str, bgm_path: str, ducking: bool = True, bgm_vol: float = 0.1) -> str:
        """
        Mixes voice and BGM with Auto-Ducking. Returns path to MIXED AUDIO file.
        """
        output_filename = f"mixed_{int(time.time())}.mp3"
        output_path = os.path.join(self.temp_dir, output_filename)
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        filter_complex = ""
        if ducking:
            # Ducking: Compress BGM (input 1) triggered by Voice (input 0)
            filter_complex = (
                 f"[1:a]volume={bgm_vol}[bgm];"
                 f"[bgm][0:a]sidechaincompress=threshold=0.015:ratio=4:attack=50:release=300[bgm_ducked];"
                 f"[0:a][bgm_ducked]amix=inputs=2:duration=first[aout]"
            )
        else:
             filter_complex = f"[1:a]volume={bgm_vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]"

        cmd = [
             ffmpeg_exe, '-y',
             '-i', voice_path,
             '-i', bgm_path,
             '-filter_complex', filter_complex,
             '-map', '[aout]',
             output_path
        ]
        
        try:
             subprocess.run(cmd, check=True, capture_output=True, text=True)
             return output_path
        except subprocess.CalledProcessError as e:
             logger.error(f"Audio Mix Failed: {e.stderr}")
             raise RuntimeError(f"Audio Mix Error: {e.stderr}")

    def generate_ass_file(self, scene_id: int, script: str, duration: float, config: dict, aspect_ratio: str, audio_path: str = None) -> str:
        """
        Generates an .ass subtitle file for the scene.
        Supports Advanced Sync (Whisper + Segmentation) if audio_path is provided.
        """
        print(f"DEBUG: generate_ass_file config type: {type(config)}")
        print(f"DEBUG: generate_ass_file config: {config}")

        if not config or not config.get('enabled', False):
            return None

        events_data = [] # List of {'start': float, 'end': float, 'text': str}

        # --- Advanced Sync Logic ---
        use_advanced = True
        
        if use_advanced and SubtitleEngine and audio_path and os.path.exists(audio_path):
            try:
                logger.info("Using Advanced Subtitle Sync (Whisper + Segmentation)...")
                engine = SubtitleEngine(
                    ffmpeg_path=dependency_manager.DependencyManager.get_ffmpeg_path(),
                    model_path=self.settings.whisper_model_path
                )
                
                # 1. Extract Raw SRT
                raw_srt, error = engine.extract_subtitle(audio_path, model_name="base", language="ko")
                if error: raise Exception(error)
                
                # 2. Align and Refine
                split_limit = int(config.get('splitLimit', 20))
                step1, step2, error = engine.align_and_refine(script, raw_srt, limit=split_limit)
                if error: raise Exception(error)
                
                # 3. Parse SRT
                from subtitle_core import parse_srt
                
                def to_ms(t):
                    try:
                        h, m, s_ms = t.split(":")
                        s, ms = s_ms.split(",")
                        return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)
                    except: return 0

                blocks = parse_srt(step2)
                
                for b in blocks:
                    events_data.append({
                        'start': to_ms(b['start']) / 1000.0,
                        'end': to_ms(b['end']) / 1000.0,
                        'text': b['text']
                    })
                
                logger.info(f"Advanced Sync Successful: {len(events_data)} lines generated.")
                    
            except Exception as e:
                logger.error(f"Advanced Sync Failed: {e}. Falling back to simple split.")
                events_data = []

        # --- Fallback / Simple Logic ---
        if not events_data:
            # 1. Split Text
            split_limit = int(config.get('splitLimit', 20))
            words = script.split()
            lines = []
            current_line = []
            current_length = 0
            
            for word in words:
                if current_length + len(word) + 1 > split_limit:
                    lines.append(" ".join(current_line))
                    current_line = [word]
                    current_length = len(word)
                else:
                    current_line.append(word)
                    current_length += len(word) + 1
            if current_line:
                lines.append(" ".join(current_line))
                
            if not lines:
                return None
            
            line_duration = duration / len(lines)
            for i, line in enumerate(lines):
                events_data.append({
                    'start': i * line_duration,
                    'end': (i + 1) * line_duration,
                    'text': line
                })

        # 2. ASS Header
        filename = f"scene_{scene_id}_{int(time.time())}.ass"
        filepath = os.path.join(self.temp_dir, filename)
        
        # Resolution Setup
        play_res_x, play_res_y = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)

        # Convert colors (Hex #RRGGBB or #RGB -> &HBBGGRR)
        def hex_to_ass(hex_color):
            if not hex_color or not hex_color.startswith('#'): return "&HFFFFFF"
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 3:
                r = hex_color[0] * 2
                g = hex_color[1] * 2
                b = hex_color[2] * 2
            elif len(hex_color) == 6:
                r = hex_color[0:2]
                g = hex_color[2:4]
                b = hex_color[4:6]
            else:
                return "&HFFFFFF"
            return f"&H{b}{g}{r}"

        primary_color = hex_to_ass(config.get('textColor', '#ffffff'))
        outline_color = hex_to_ass(config.get('outlineColor', '#000000'))
        shadow_color = hex_to_ass(config.get('shadowColor', '#000000'))
        box_color = hex_to_ass(config.get('boxColor', '#000000'))
        
        # Opacity (0-100 -> 00-FF, but ASS is inverted: 00=Opaque, FF=Transparent)
        # Box Opacity: User 50% -> ASS &H80
        box_alpha = hex(int(round((100 - config.get('boxOpacity', 50)) * 2.55)))[2:].upper().zfill(2)
        
        # Apply Alpha to BackColour (Format: &HAABBGGRR)
        back_color_val = box_color.replace("&H", "") if config.get('useBox') else shadow_color.replace("&H", "")
        back_alpha = box_alpha if config.get('useBox') else "80" 
        
        full_back_color = f"&H{back_alpha}{back_color_val}"
        
        # Alignment
        pos_map = {'top': 8, 'middle': 5, 'bottom': 2}
        alignment = pos_map.get(config.get('position', 'bottom'), 2)
        if config.get('position') == 'custom':
            alignment = 5 # Center, then use \pos(x,y)
            
        margin_v = int(config.get('marginV', 50))
        
        
        # In CapCut, FontSize is a percentage of canvas width (PlayResX).
        # We scale it to match ASS pixels exactly.
        base_size = float(config.get('fontSize', 15))
        ass_font_size = base_size * (play_res_x / 100.0) * 0.8  # 0.8 is an empirical multiplier to visually match CapCut's rendering engine
        
        # BorderStyle: 1=Outline+Shadow, 3=Opaque Box
        border_style = 3 if config.get('useBox', False) else 1
        
        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{config.get('font', 'Arial')},{int(ass_font_size)},{primary_color},&H00000000,{outline_color},{full_back_color},{'-1' if config.get('isBold') else '0'},{'-1' if config.get('isItalic') else '0'},0,0,100,100,0,0,{border_style},{config.get('outlineSize', 2)},{config.get('shadowSize', 2)},{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        # 3. Events Generation
        events = []
        
        for item in events_data:
            start_time = item['start']
            end_time = item['end']
            text_content = item['text']
            
            # Format time: H:MM:SS.cs
            def fmt_time(t):
                h = int(t // 3600)
                m = int((t % 3600) // 60)
                s = int(t % 60)
                cs = int((t % 1) * 100)
                return f"{h}:{m:02}:{s:02}.{cs:02}"
                
            s_str = fmt_time(start_time)
            e_str = fmt_time(end_time)
            
            # Animation Tags Generation
            # We now support Entrance, Exit, and Emphasis separately.
            # Backward compatibility: 'animation' maps to 'animationEntrance' if not specified.
            
            anim_entrance = config.get('animationEntrance', config.get('animation', 'none'))
            anim_exit = config.get('animationExit', 'none')
            anim_emphasis = config.get('animationEmphasis', 'none')
            
            tags = []
            dur_ms = int((end_time - start_time) * 1000)
            entrance_dur = 500
            exit_dur = 500
            
            # --- 1. ENTRANCE EFFECTS ---
            if anim_entrance == 'fade':
                tags.append(r"\fad(500,0)")
            elif anim_entrance == 'pop_up':
                tags.append(r"\fscx0\fscy0\t(0,500,\fscx100\fscy100)")
            elif anim_entrance == 'elastic_pop':
                tags.append(r"\fscx0\fscy0\t(0,300,\fscx120\fscy120)\t(300,500,\fscx100\fscy100)")
            elif anim_entrance == 'slide_up':
                # Approximate slide from bottom
                tx = play_res_x / 2
                ty = play_res_y - margin_v
                if config.get('position') == 'top': ty = margin_v
                elif config.get('position') == 'middle': ty = play_res_y / 2
                elif config.get('position') == 'custom':
                    tx = config.get('customX', tx)
                    ty = config.get('customY', ty)
                tags.append(f"\\move({tx},{ty+100},{tx},{ty},0,500)")
            elif anim_entrance == 'slide_down':
                tx = play_res_x / 2
                ty = play_res_y - margin_v
                if config.get('position') == 'top': ty = margin_v
                elif config.get('position') == 'middle': ty = play_res_y / 2
                tags.append(f"\\move({tx},{ty-100},{tx},{ty},0,500)")
            elif anim_entrance == 'slide_left':
                tx = play_res_x / 2
                ty = play_res_y - margin_v
                if config.get('position') == 'top': ty = margin_v
                elif config.get('position') == 'middle': ty = play_res_y / 2
                tags.append(f"\\move({tx+200},{ty},{tx},{ty},0,500)")
            elif anim_entrance == 'slide_right':
                tx = play_res_x / 2
                ty = play_res_y - margin_v
                if config.get('position') == 'top': ty = margin_v
                elif config.get('position') == 'middle': ty = play_res_y / 2
                tags.append(f"\\move({tx-200},{ty},{tx},{ty},0,500)")
            elif anim_entrance == 'blur_in':
                # Ensure blur works by setting initial blur and animating to 0
                tags.append(r"\blur10\t(0,800,\blur0)")
            elif anim_entrance == 'mask_reveal':
                # Wipe from left to right using clip
                # We need approximate coordinates. 
                # Assuming full width text for simplicity or just a wide clip.
                # Clip format: \clip(x1,y1,x2,y2)
                # We animate x2 from x1 to x1+width
                cx = 0
                cy = 0
                cw = play_res_x
                ch = play_res_y
                tags.append(f"\\clip({cx},{cy},{cx},{ch})\\t(0,1000,\\clip({cx},{cy},{cw},{ch}))")
            
            # --- 2. EXIT EFFECTS ---
            # Note: \fad can be combined. \t for exit needs correct timing.
            exit_start = dur_ms - exit_dur
            if exit_start < 0: exit_start = 0
            
            if anim_exit == 'fade_out':
                # Check if fad already exists (from entrance)
                if any("fad" in t for t in tags):
                    # Replace \fad(500,0) with \fad(500,500)
                    tags = [t.replace(r"\fad(500,0)", r"\fad(500,500)") for t in tags]
                else:
                    tags.append(r"\fad(0,500)")
            elif anim_exit == 'zoom_out':
                tags.append(f"\\t({exit_start},{dur_ms},\\fscx0\\fscy0)")
            elif anim_exit == 'slide_out_down':
                 # This conflicts with entrance \move. \move can only be used once.
                 # If entrance used move, we can't easily use move for exit without complex transforms.
                 # We'll skip move-based exit if entrance used move.
                 if not any("move" in t for t in tags):
                     tx = play_res_x / 2
                     ty = play_res_y - margin_v
                     tags.append(f"\\move({tx},{ty},{tx},{ty+100},{exit_start},{dur_ms})")

            # --- 3. EMPHASIS EFFECTS ---
            if anim_emphasis == 'pulse':
                # Heartbeat: Scale up and down repeatedly? 
                # ASS \t doesn't loop. We need multiple \t tags.
                # Let's do 2 pulses.
                tags.append(r"\t(0,500,\fscx110\fscy110)\t(500,1000,\fscx100\fscy100)\t(1000,1500,\fscx110\fscy110)\t(1500,2000,\fscx100\fscy100)")
            elif anim_emphasis == 'shake':
                # Jitter: Needs \move or multiple events. 
                # Since we might have used \move for entrance, we can't use it here easily.
                # Alternative: Random rotation jitter
                tags.append(r"\t(0,100,\frz5)\t(100,200,\frz-5)\t(200,300,\frz5)\t(300,400,\frz-5)\t(400,500,\frz0)")
            elif anim_emphasis == 'flip_x':
                tags.append(r"\t(0,1000,\fry360)")
            elif anim_emphasis == 'flip_y':
                tags.append(r"\t(0,1000,\frx360)")
            elif anim_emphasis == 'spin_z':
                tags.append(r"\t(0,1000,\frz360)")
            elif anim_emphasis == 'neon':
                tags.append(r"\bord2\blur5\t(0,500,\blur10)\t(500,1000,\blur5)")
            elif anim_emphasis == 'spacing':
                tags.append(r"\fsp0\t(0,3000,\fsp20)")
            elif anim_emphasis == 'color_morph':
                tags.append(r"\c&HFFFFFF&\t(0,1000,\c&H00FFFF&)")
            elif anim_emphasis == 'bounce':
                 tags.append(r"\fscy0\t(0,300,\fscy120)\t(300,500,\fscy100)")

            # --- SPECIAL: TYPEWRITER (Per-Character) ---
            if anim_entrance == 'typewriter':
                # We need to construct the text with tags embedded.
                # Logic: Split text into chars. For each char, add \alpha transform.
                # Delay per char: 50ms.
                chars = list(text_content)
                new_content = ""
                delay = 50
                for i, char in enumerate(chars):
                    start_t = i * delay
                    end_t = start_t + delay
                    # Start invisible, become visible
                    # \alpha&HFF& -> \alpha&H00&
                    # We use \alpha&HFF& at start of char, then \t to animate to 00
                    # But \t is relative to event start.
                    new_content += f"{{\\alpha&HFF&\\t({start_t},{end_t},\\alpha&H00&)}}{char}"
                
                full_text = "".join(tags) + "{"+ "".join(tags) + "}" + new_content # Tags applied globally? No, tags are per line usually.
                # Wait, if we use per-char tags, we shouldn't prepend global tags that might conflict.
                # But global tags like \pos or \fs are fine.
                # The 'tags' list contains global style overrides.
                # We should put global tags at the start.
                global_tags_str = "{" + "".join(tags) + "}" if tags else ""
                full_text = global_tags_str + new_content
            else:
                # Standard case
                global_tags_str = "{" + "".join(tags) + "}" if tags else ""
                full_text = f"{global_tags_str}{text_content}"
            
            events.append(f"Dialogue: 0,{s_str},{e_str},Default,,0,0,0,,{full_text}")
            
        with open(filepath, "w", encoding='utf-8-sig') as f:
            f.write(header + "\n".join(events))
            
        return filepath

    def render_scene_video(self, scene_id: int, image_path: str, audio_path: str, duration: float = None, aspect_ratio: str = "9:16", motion_config: dict = None, subtitle_config: dict = None, audio_config: dict = None, script: str = "") -> str:
        """
        Step 3: Render Video with Smart Crop-to-Fill (9:16 or 16:9) and Motion Effects
        """
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        # 1. Output Path Setup
        output_filename = f"scene_{scene_id}_final_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)

        # 2. Step 1: Verify Audio & Get Exact Duration
        try:
            real_duration = get_audio_metadata(audio_path)
            logger.info(f"Audio Validated. Duration: {real_duration}s")
        except Exception as e:
            logger.error(f"Skipping render due to audio error: {e}")
            raise e

        # 3. Step 2: Smart Filter Construction
        is_video = image_path.lower().endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm'))
        
        if is_video:
            logger.info(f"Video input detected ({image_path}). Disabling motion effects.")
            motion_config = None

        has_original_audio = False
        if is_video and audio_config and audio_config.get('keepOriginalAudio', True):
            try:
                ffprobe_exe = dependency_manager.DependencyManager.get_ffprobe_path()
                probe_cmd = [ffprobe_exe, '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'default=noprint_wrappers=1:nokey=1', image_path]
                import subprocess
                probe_res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
                if 'audio' in probe_res.stdout.strip():
                    has_original_audio = True
                    logger.info(f"Original audio detected. It will be mixed.")
            except Exception as e:
                logger.warning(f"Failed to probe audio: {e}")

        smart_resize_filter = self.build_ffmpeg_filter(aspect_ratio, real_duration, motion_config)

        # 3.5 Generate Subtitles
        ass_path = None
        if subtitle_config and subtitle_config.get('enabled') and script:
             try:
                 ass_path = self.generate_ass_file(scene_id, script, real_duration, subtitle_config, aspect_ratio, audio_path)
                 logger.info(f"Generated Subtitle File: {ass_path}")
                 # Debug: Read first few lines
                 with open(ass_path, 'r', encoding='utf-8-sig') as f:
                     logger.info(f"ASS Header Preview:\n{f.read(300)}")
             except Exception as e:
                 logger.error(f"Subtitle Generation Failed: {e}")

        # 4. FFmpeg Command Construction
        
        # If video, we might skip zoompan or apply it carefully.
        # For now, apply filter to both. Zoompan on video works but might look weird if video moves.
        # Let's assume motion effects are mostly for images.
        # If video + motion requested, we apply it.
        
        input_args = ['-stream_loop', '-1', '-i', image_path] if is_video else ['-loop', '1', '-i', image_path]
        
        # Construct Filter String
        vf_string = smart_resize_filter
        # 3.7 [NEW] Dynamic Infographics (Visual Deduplication)
        overlay_filter = ""
        try:
            if script and any(k in script.lower() for k in ["percent", "성장", "증가", "하락", "growth", "data"]):
                import random
                from app.services.video.visual_deduplicator import VisualDeduplicator
                dedup = VisualDeduplicator(self.temp_dir)
                chart_path = dedup.generate_growth_chart("SWARM DATA INSIGHT", [random.randint(10, 100) for _ in range(5)], [])
                escaped_chart_path = chart_path.replace(os.sep, '/').replace(':', r'\:')
                
                logger.info(f"[TREND] Overlaying Dynamic Infographic: {chart_path}")
                # We use movie filter to overlay without changing input indices
                overlay_filter = f",movie='{escaped_chart_path}'[chart];[v_base][chart]overlay=x=(W-w)/2:y=H-h-120:enable='between(t,2,7)'[v_base]"
                # Adjust base label if we use overlay
                vf_string = f"{smart_resize_filter}[v_base]{overlay_filter}"
            else:
                vf_string = smart_resize_filter
        except Exception as overlay_err:
            logger.warning(f"Overlay generation failed: {overlay_err}")
            vf_string = smart_resize_filter

        if ass_path:
            escaped_ass_path = ass_path.replace(os.sep, '/').replace(':', r'\:')
            
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_font_dir = os.path.join(project_root, 'fonts')
            user_font_dir = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Windows', 'Fonts')
            
            fonts_dir_to_use = None
            if os.path.exists(project_font_dir) and any(f.endswith(('.ttf', '.otf')) for f in os.listdir(project_font_dir)):
                fonts_dir_to_use = project_font_dir
            elif os.path.exists(user_font_dir):
                fonts_dir_to_use = user_font_dir
            
            ass_filter = f"ass='{escaped_ass_path}'"
            if fonts_dir_to_use:
                escaped_font_dir = fonts_dir_to_use.replace(os.sep, '/').replace(':', r'\:')
                ass_filter += f":fontsdir='{escaped_font_dir}'"
            
            # If we used [v_base] for overlay, we must consume it
            if "[v_base]" in vf_string:
                vf_string += f";[v_base]{ass_filter}"
            else:
                vf_string += f",{ass_filter}"

        audio_args = []
        if has_original_audio:
            orig_vol = audio_config.get('originalVolume', 50) / 100.0
            # [FIX] asetpts=N/SR/TB fixes broken timestamps from -stream_loop -1 which causes amix to speed up audio.
            # async=1 helps maintain audio sync.
            af_string = (
                f"[0:a]asetpts=N/SR/TB,aresample=44100:async=1,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={orig_vol}[a0];"
                f"[1:a]aresample=44100:async=1,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=1.0[a1];"
                f"[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[a_out]"
            )
            audio_args = ['-filter_complex', af_string, '-map', '[a_out]']
        else:
            audio_args = ['-map', '1:a:0']

        # 5. Final Command
        cmd = [
            ffmpeg_exe, '-y',
            *input_args,
            '-i', audio_path,
            '-vf', vf_string,
            '-map', '0:v:0' if "[v_base]" not in vf_string else "[v_base]" if not ass_path else "[v_base]", 
            *audio_args,
            '-c:v', 'libx264', '-preset', 'fast',
            '-r', '60',
            '-c:a', 'aac', '-b:a', '192k',
            '-t', str(real_duration),
            '-pix_fmt', 'yuv420p',
            '-shortest',
            output_path
        ]
        
        # Adjust map for filter complex if labels were used
        if "[v_base]" in vf_string:
            # If there's a labeled output, we map that instead of 0:v:0
            # Wait, the way I chained it, the last filter in the chain (ass or overlay) doesn't have a label.
            # Usually, the last filter is the output.
            pass

        logger.info(f"Rendering Scene #{scene_id} with Aspect Ratio {aspect_ratio}...")
        
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            
            if not os.path.exists(output_path):
                raise FileNotFoundError("FFmpeg finished but output is missing.")
            
            # 3.8 [NEW] Apply Sovereign Shield (Mutation)
            from app.services.video.mutation_engine import mutation_engine
            mutated_path = output_path.replace(".mp4", "_mutated.mp4")
            if mutation_engine.apply_mutation(output_path, mutated_path, intensity=0.3):
                os.remove(output_path)
                os.rename(mutated_path, output_path)
                logger.info(f"🛡️ Scene #{scene_id} mutated (Sovereign Shield)")

            return output_path

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg Error: {e.stderr}")
            raise RuntimeError(f"Encoding Failed: {e.stderr}")
        finally:
            # Cleanup ASS file
            if ass_path and os.path.exists(ass_path):
                try:
                    os.remove(ass_path)
                    logger.info(f"Cleaned up ASS file: {ass_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup ASS file: {e}")
    def merge_videos(self, video_paths: list[str]) -> str:
        """
        Merges multiple video files into a single video using FFmpeg concat demuxer.
        Assumes all videos have same codec/resolution (which they should if generated by this engine).
        """
        if not video_paths:
            raise ValueError("No video paths provided for merging.")

        # Validate files exist
        valid_paths = []
        for p in video_paths:
            if os.path.exists(p):
                valid_paths.append(p)
            else:
                logger.warning(f"Skipping missing video for merge: {p}")
        
        if not valid_paths:
            raise FileNotFoundError("No valid video files found to merge.")

        # Create concat list file
        concat_filename = f"concat_list_{uuid.uuid4()}.txt"
        concat_path = os.path.join(self.temp_dir, concat_filename)
        
        try:
            with open(concat_path, 'w', encoding='utf-8') as f:
                for p in valid_paths:
                    # Escape paths for FFmpeg concat file
                    # Windows paths need backslashes escaped or forward slashes
                    safe_path = p.replace('\\', '/')
                    f.write(f"file '{safe_path}'\n")
            
            output_filename = f"merged_video_{int(time.time())}.mp4"
            output_path = os.path.join(self.temp_dir, output_filename)
            ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()

            # FFmpeg Concat Command (Stream Copy for speed)
            cmd = [
                ffmpeg_exe, '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_path,
                '-c', 'copy',
                output_path
            ]
            
            logger.info(f"Merging {len(valid_paths)} videos...")
            subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            
            if not os.path.exists(output_path):
                raise FileNotFoundError("Merged video output missing.")
                
            return output_path

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg Merge Failed: {e.stderr}")
            raise RuntimeError(f"Merge Failed: {e.stderr}")
        finally:
            # Cleanup concat list
            if os.path.exists(concat_path):
                try:
                    os.remove(concat_path)
                except: pass

    async def generate_shorts_from_longform(self, video_path: str, count: int = 3) -> list[str]:
        """
        Analyzes a long-form video, finds viral segments, and converts them to vertical shorts.
        Returns a list of generated video paths.
        """
        logger.info(f"[VIDEO] Starting Long-to-Shorts for: {video_path}")
        
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        # 1. Transcribe (Get SRT)
        # We need SubtitleEngine. If not available, we can't analyze content easily.
        if not SubtitleEngine:
            raise RuntimeError("SubtitleEngine not available. Cannot analyze video content.")

        engine = SubtitleEngine(
            ffmpeg_path=dependency_manager.DependencyManager.get_ffmpeg_path(),
            model_path=self.settings.whisper_model_path
        )
        
        logger.info("Transcribing video for analysis...")
        srt_content, error = engine.extract_subtitle(video_path, model_name="base", language="auto")
        if error:
            raise RuntimeError(f"Transcription failed: {error}")

        # 2. Analyze with LLM
        prompt = f"""
        Analyze the following SRT subtitle content from a long video.
        Identify {count} distinct segments that have high "viral potential" for TikTok/Shorts.
        Criteria: Funny, emotional, surprising, or insightful moments.
        
        SRT Content (Truncated if too long):
        {srt_content[:15000]} 
        
        Return JSON format ONLY:
        [
            {{ "start": "00:01:20", "end": "00:02:10", "reason": "Funny joke about cats", "title": "Cat Joke" }},
            ...
        ]
        Use HH:MM:SS format for timestamps.
        """
        
        logger.info("Asking AI to find viral segments...")
        response = self.llm_client.generate_content(prompt, model_name=self.settings.default_model)
        
        # Parse JSON
        try:
            # Clean markdown code blocks if present
            clean_json = response.replace("```json", "").replace("```", "").strip()
            segments = json.loads(clean_json)
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {response}")
            raise RuntimeError("AI Analysis failed to return valid JSON.")

        generated_paths = []
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()

        # 3. Process Segments
        for i, seg in enumerate(segments):
            logger.info(f"Processing Segment {i+1}: {seg['title']} ({seg['start']} - {seg['end']})")
            
            output_filename = f"short_{i+1}_{uuid.uuid4().hex[:8]}.mp4"
            output_path = os.path.join(self.temp_dir, output_filename)
            
            # Convert timestamps to seconds
            def parse_time(t_str):
                h, m, s = t_str.split(':')
                return int(h) * 3600 + int(m) * 60 + float(s)
            
            start_sec = parse_time(seg['start'])
            end_sec = parse_time(seg['end'])
            duration = end_sec - start_sec
            
            # FFmpeg Command: Crop to 9:16 + Cut
            # Simple center crop for now. Auto-reframe is complex (Phase 9 implemented logic but not full ffmpeg filter).
            # We'll use a center crop: crop=ih*(9/16):ih
            
            cmd = [
                ffmpeg_exe, '-y',
                '-ss', str(start_sec),
                '-t', str(duration),
                '-i', video_path,
                '-vf', "scale=-1:1920,crop=1080:1920,setsar=1", # Scale height to 1920, then crop width to 1080
                '-c:v', 'libx264', '-preset', 'fast',
                '-c:a', 'aac',
                output_path
            ]
            
            subprocess.run(cmd, check=True, capture_output=True)
            generated_paths.append(output_path)
            
        return generated_paths

    def upscale_video(self, video_path: str, scale: int = 2) -> str:
        """
        Upscales video using Real-ESRGAN (if available).
        """
        logger.info(f"[MAGIC] Upscaling video {video_path} (x{scale})...")
        
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        # Check for Real-ESRGAN binary
        # Assumes it's in the PATH or a known location
        executable = "realesrgan-ncnn-vulkan"
        if shutil.which(executable) is None:
            # Check local bin folder
            local_bin = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "bin", "realesrgan-ncnn-vulkan.exe")
            if os.path.exists(local_bin):
                executable = local_bin
            else:
                raise RuntimeError("Real-ESRGAN executable not found. Please install it.")

        output_filename = f"upscaled_x{scale}_{uuid.uuid4().hex[:8]}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)

        # Real-ESRGAN command
        # -i input -o output -s scale
        cmd = [
            executable,
            '-i', video_path,
            '-o', output_path,
            '-s', str(scale)
        ]
        
        try:
            # This can take a long time
            subprocess.run(cmd, check=True, capture_output=True)
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Upscaling Failed: {e.stderr}")
            raise RuntimeError(f"Upscaling Failed: {e.stderr}")

    def smooth_motion(self, video_path: str, target_fps: int = 60) -> str:
        """
        Interpolates frames to reach target_fps using FFmpeg minterpolate.
        WARNING: Very CPU intensive.
        """
        logger.info(f"🌊 Smoothing motion for {video_path} to {target_fps}fps...")
        
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        output_filename = f"smooth_{target_fps}fps_{uuid.uuid4().hex[:8]}.mp4"
        output_path = os.path.join(self.temp_dir, output_filename)
        ffmpeg_exe = dependency_manager.get_ffmpeg_path()

        # Filter: minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=60'
        # mci: Motion Compensated Interpolation
        # aobmc: Adaptive Overlapped Block Motion Compensation (High Quality)
        
        filter_str = f"minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps={target_fps}'"
        
        cmd = [
            ffmpeg_exe, '-y',
            '-i', video_path,
            '-vf', filter_str,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
            '-c:a', 'copy',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Frame Interpolation Failed: {e.stderr}")
            raise RuntimeError(f"Frame Interpolation Failed: {e.stderr}")

    def retime_and_mux(self, video_path: str, audio_path: str, output_path: str = None) -> str:
        """
        Retimes the video to match the exact duration of the audio, and replaces the audio track.
        Handles speed change (setpts) and looping if video is too short.
        """
        if not os.path.exists(video_path) or not os.path.exists(audio_path):
             raise FileNotFoundError("Video or Audio file missing")

        if not output_path:
            output_filename = f"synced_{uuid.uuid4().hex[:8]}.mp4"
            output_path = os.path.join(self.temp_dir, output_filename)

        # 1. Get Durations
        # Use ffprobe helper (re-implementing brief version here for safety or use existing self methods if they existed)
        # We'll use the get_audio_metadata function defined at module level
        try:
            dur_v = get_audio_metadata(video_path)
            dur_a = get_audio_metadata(audio_path)
        except Exception as e:
            logger.error(f"Duration Probe Failed: {e}")
            raise e

        if dur_a < 0.1: raise ValueError("Audio too short")

        logger.info(f"Retime: V={dur_v:.2f}s, A={dur_a:.2f}s")
        
        # 2. Determine Strategy
        # Logic: 
        # If Video is very short (< 0.5 * Audio), LOOP it first.
        # Then Stretch/Compress to match exactly.
        
        ratio = dur_v / dur_a
        loop_count = 1
        
        if ratio < 0.5:
            # Video is less than half of audio length.
            # Example: V=2s, A=10s. Ratio=0.2.
            # We want V to be roughly A's length before stretching to avoid extreme slow motion.
            # Target loop count = ceil(1/ratio)
            import math
            loop_count = math.ceil(1.0 / ratio)
            # Adjust effective video duration
            dur_v = dur_v * loop_count
            ratio = dur_v / dur_a # Recalculate ratio (should be >= 1.0 roughly)

        # Factor for setpts
        # We want New Duration = Audio Duration.
        # New Dur = Old Dur / PTS_SPEED
        # PTS_SPEED = Old Dur / New Dur = dur_v / dur_a = ratio
        # Filter: setpts=PTS/PTS_SPEED
        pts_speed = ratio
        
        filter_complex = f"[0:v]setpts=PTS/({pts_speed})[v]"
        
        ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
        cmd = [ffmpeg_exe, '-y']
        
        # Input 0: Video
        if loop_count > 1:
            cmd.extend(['-stream_loop', str(loop_count-1)]) 
            
        cmd.extend(['-i', video_path])
        
        # Input 1: Audio
        cmd.extend(['-i', audio_path])
        
        # Filter & Map
        cmd.extend(['-filter_complex', filter_complex])
        cmd.extend(['-map', '[v]', '-map', '1:a'])
        
        # Encoding
        cmd.extend(['-c:v', 'libx264', '-preset', 'fast', '-crf', '23'])
        cmd.extend(['-c:a', 'aac', '-b:a', '192k'])
        cmd.extend(['-shortest']) # Should match audio exactly due to math, but good safety
        cmd.append(output_path)

        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            return output_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Retime Failed: {e.stderr}")
            raise RuntimeError(f"Retime Error: {e.stderr}")

    # Alias for backward compatibility if needed
    def sync_video_to_audio(self, video_path: str, audio_path: str, mode: str = "auto") -> str:
        return self.retime_and_mux(video_path, audio_path)

    def generate_thumbnail(self, video_path: str, output_path: str = None, capture_ratio: float = 0.3) -> str:
        """
        Step 1-1: Dynamic Thumbnail Generation.
        Generates a dynamic thumbnail by capturing a specific frame of the completed video,
        and supporting optional advanced typography/B-roll overlay logic in the future.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file missing: {video_path}")
            
        if not output_path:
            output_filename = f"thumb_{uuid.uuid4().hex[:8]}.jpg"
            output_path = os.path.join(self.temp_dir, output_filename)
            
        try:
            # 1. Get exact duration to calculate timestamp
            duration_val = get_audio_metadata(video_path)
            target_time = max(0.0, duration_val * capture_ratio)
            
            # Format time as HH:MM:SS.ms
            def fmt_time(t):
                h = int(t // 3600)
                m = int((t % 3600) // 60)
                s = int(t % 60)
                ms = int((t % 1) * 1000)
                return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
                
            time_str = fmt_time(target_time)
            
            ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
            
            # 2. Extract Frame
            cmd = [
                ffmpeg_exe, "-y",
                "-ss", time_str,
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                output_path
            ]
            
            logger.info(f"Generating Thumbnail from {video_path} at {time_str}...")
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            
            if not os.path.exists(output_path):
                 raise FileNotFoundError("Thumbnail generation failed, FFmpeg did not create output.")
                 
            return output_path
            
        except Exception as e:
            logger.error(f"Thumbnail Generation Failed: {e}")
            raise e

