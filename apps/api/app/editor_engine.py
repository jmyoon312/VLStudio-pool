import logging
import os
import uuid
import subprocess
import json
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def detect_scenes(video_path: str, threshold: float = 30.0) -> list:
    """
    Detects scenes in a video using PySceneDetect.
    Returns a list of dicts: [{'start': float, 'end': float, 'duration': float}]
    """
    from scenedetect import VideoManager, SceneManager
    from scenedetect.detectors import ContentDetector

    video_manager = VideoManager([video_path])
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=threshold))

    video_manager.set_downscale_factor()
    video_manager.start()
    scene_manager.detect_scenes(frame_source=video_manager)
    
    scene_list = scene_manager.get_scene_list()
    
    scenes = []
    for scene in scene_list:
        start = scene[0].get_seconds()
        end = scene[1].get_seconds()
        scenes.append({
            "start": start,
            "end": end,
            "duration": end - start
        })
        
    return scenes

def analyze_saturation(video_path: str) -> float:
    """
    Analyzes the average saturation of a video.
    Returns a mock value for now.
    """
    return 0.5

def generate_ass_file(clips: List[Dict[str, Any]], output_dir: str, width: int = 1920, height: int = 1080) -> str:
    """
    Generates an .ass subtitle file from text clips.
    """
    filename = f"subtitles_{uuid.uuid4()}.ass"
    filepath = os.path.join(output_dir, filename)
    
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    def format_timestamp(seconds):
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(header)
        for clip in clips:
            if clip.get('type') == 'text' or clip.get('type') == 'caption':
                start = format_timestamp(clip['start'])
                end = format_timestamp(clip['start'] + clip['duration'])
                
                # Check where content is stored (top level or inside text dict)
                text_content = clip.get('content')
                if not text_content:
                     # Check separate text dict if exists
                     text_obj = clip.get('text') or {}
                     text_content = text_obj.get('content') or clip.get('name', 'Text')
                
                text_content = str(text_content).replace('\n', '\\N')

                # Style Overrides
                style = clip.get('style', {})
                overrides = []
                
                # 1. Font Face (\fn)
                font_family = style.get('fontFamily')
                if font_family:
                    overrides.append(f"\\fn{font_family}")
                
                # 2. Font Size (\fs) - Ensure it maps reasonably to backend resolution
                font_size = style.get('fontSize')
                if font_size:
                    overrides.append(f"\\fs{int(font_size)}")
                    
                # 3. Colors (\1c&HBBGGRR&) - ASS uses BGR
                def hex_to_ass(hex_color):
                    if not hex_color: return None
                    hex_color = hex_color.lstrip('#')
                    if len(hex_color) == 6:
                        r, g, b = hex_color[:2], hex_color[2:4], hex_color[4:]
                        return f"&H{b}{g}{r}&"
                    return None

                text_color = style.get('color')
                ass_color = hex_to_ass(text_color)
                if ass_color:
                    overrides.append(f"\\1c{ass_color}")

                # 4. Bold/Italic
                if style.get('isBold') or str(style.get('fontWeight')) == 'bold' or (isinstance(style.get('fontWeight'), int) and style.get('fontWeight') >= 700):
                    overrides.append("\\b1")
                if style.get('isItalic') or style.get('fontStyle') == 'italic':
                    overrides.append("\\i1")
                
                # 5. Alignment (\an)
                # Map textAlign + positionPreset to ASS alignment (1-9)
                text_align = style.get('textAlign', 'center')
                pos_preset = style.get('positionPreset', 'bottom')
                
                align_num = 2 # Default bottom-center
                
                # Horizontal
                if text_align == 'left': align_num = 1
                elif text_align == 'right': align_num = 3
                else: align_num = 2
                
                # Vertical Shift
                if pos_preset == 'top': align_num += 6     # 1->7, 2->8, 3->9
                elif pos_preset == 'middle': align_num += 3 # 1->4, 2->5, 3->6
                
                overrides.append(f"\\an{align_num}")

                # Construct Dialogue
                override_tag = "{" + "".join(overrides) + "}" if overrides else ""
                f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{override_tag}{text_content}\n")
                
    return filepath

def get_speed_filter(speed: float, is_audio: bool = False) -> str:
    if abs(speed - 1.0) < 0.01:
        return ""
    
    if not is_audio:
        # PTS/speed -> 2x speed means timestamps are halved (faster)
        return f"setpts=PTS/{speed},"
    
    # Audio atempo chaining
    filters = []
    remaining_speed = speed
    while remaining_speed > 2.0:
        filters.append("atempo=2.0")
        remaining_speed /= 2.0
    while remaining_speed < 0.5:
        filters.append("atempo=0.5")
        remaining_speed /= 0.5
        
    filters.append(f"atempo={remaining_speed}")
    return ",".join(filters) + ","

def build_complex_filter(clips: List[Dict[str, Any]], output_dir: str, width: int = 1080, height: int = 1920, format: str = 'mp4'):
    """
    Builds a robust FFmpeg filter graph treating all video clips as overlays.
    Accepts a flat list of clips.
    """
    inputs = []
    filter_chains = []
    
    # 1. Sort clips by layer (Bottom to Top)
    sorted_clips = sorted(clips, key=lambda c: c.get('layer', 0))

    # 2. Calculate Total Duration
    total_duration = 0
    for clip in sorted_clips:
        start = clip.get('start', 0) or 0
        dur = clip.get('duration', 0) or 0
        end = start + dur
        if end > total_duration:
            total_duration = end
    
    if total_duration == 0:
        total_duration = 10

    is_audio_only = format in ['mp3', 'wav', 'm4a']

    # 3. Base Canvas
    last_video_label = "[base]"
    if not is_audio_only:
        filter_chains.append(f"color=c=black:s={width}x{height}:d={total_duration}[base]")
    
    current_input_idx = 0
    
    # 4. Process Visual Clips
    if not is_audio_only:
        visual_clips = [c for c in sorted_clips if c.get('type') in ['video', 'image']]
        
        for i, clip in enumerate(visual_clips):
            path = clip.get('path')
            if not path:
                 logger.warning(f"Clip {clip.get('id')} missing path, skipping")
                 continue
                 
            inputs.extend(["-i", path])
            input_label = f"[{current_input_idx}:v]"
            
            # Simple input tracking
            clip['_input_idx'] = current_input_idx
            current_input_idx += 1
            
            chain = f"{input_label}"
            
            # Loop image
            if clip.get('type') == 'image':
                 chain += f"loop=loop=-1:size=1:start=0,"
            
            # Time & Speed
            trim_start = clip.get('offset', 0)
            duration = clip.get('duration', 5)
            speed = clip.get('speed', 1.0)
            
            if speed != 1.0:
                 source_duration = duration * speed
                 chain += f"trim=start={trim_start}:duration={source_duration},setpts=PTS/{speed},"
            else:
                 chain += f"trim=start={trim_start}:duration={duration},setpts=PTS-STARTPTS,"
            
            # Transform
            tf = clip.get('transform', {})
            scale_val = tf.get('scale', 1.0)
            rotation = tf.get('rotation', 0)
            opacity = tf.get('opacity', 1.0)
            
            # Scale
            chain += f"scale=iw*{scale_val}:ih*{scale_val},"
            
            # Rotate
            if rotation != 0:
                 chain += f"rotate={rotation}*PI/180:c=none:ow=rotw(iw):oh=roth(ih),"
            
            # Opacity
            if opacity < 1.0:
                 chain += f"format=rgba,colorchannelmixer=aa={opacity},"
            
            processed_label = f"[v_proc_{i}]"
            chain = chain.rstrip(',') + processed_label
            filter_chains.append(chain)
            
            # Overlay
            # Center-based coordinates
            x = tf.get('x', 0)
            y = tf.get('y', 0)
            
            ffmpeg_x = f"(W-w)/2 + {x}"
            ffmpeg_y = f"(H-h)/2 + {y}"
            
            start_time = clip.get('start', 0)
            end_time = start_time + duration
            
            next_base = f"[base_{i}]"
            filter_chains.append(f"{last_video_label}{processed_label}overlay=x={ffmpeg_x}:y={ffmpeg_y}:enable='between(t,{start_time},{end_time})':shortest=0{next_base}")
            last_video_label = next_base

    # 5. Text Processing
    if not is_audio_only:
        text_clips = [c for c in sorted_clips if c.get('type') == 'text']
        if text_clips:
            ass_path = generate_ass_file(text_clips, output_dir, width, height)
            safe_ass = ass_path.replace('\\', '/').replace(':', '\\:')
            final_video_label = "[outv]"
            # Add fontsdir just in case
            filter_chains.append(f"{last_video_label}ass='{safe_ass}':fontsdir='C\\:/Windows/Fonts'{final_video_label}")
        else:
            final_video_label = "[outv]"
            filter_chains.append(f"{last_video_label}null{final_video_label}")

    # 6. Audio Processing
    audio_mix_inputs = []
    
    # Process all clips that have audio (video clips + audio clips)
    audio_clips = [c for c in sorted_clips if c.get('type') in ['video', 'audio']]
    
    for i, clip in enumerate(audio_clips):
        audio_props = clip.get('audio') or {}
        if audio_props.get('muted'): continue
        
        path = clip.get('path')
        if not path: continue
        
        # Check if input already exists
        input_idx = clip.get('_input_idx')
        if input_idx is None:
             inputs.extend(["-i", path])
             input_idx = current_input_idx
             current_input_idx += 1
        
        input_label = f"[{input_idx}:a]"
        chain = f"{input_label}"
        
        trim_start = clip.get('offset', 0)
        duration = clip.get('duration', 5)
        speed = clip.get('speed', 1.0)
        
        # Audio TRIM
        source_duration = duration * speed
        chain += f"atrim=start={trim_start}:duration={source_duration},asetpts=PTS-STARTPTS,"
        
        # Speed
        chain += get_speed_filter(speed, is_audio=True)
        
        # Volume
        vol = audio_props.get('volume', 1.0)
        chain += f"volume={vol},"
        
        # Delay
        start_ms = int(clip.get('start', 0) * 1000)
        chain += f"adelay={start_ms}|{start_ms},"
        
        processed_label = f"[a_proc_{i}_{uuid.uuid4().hex[:4]}]"
        chain = chain.rstrip(',') + processed_label
        filter_chains.append(chain)
        audio_mix_inputs.append(processed_label)
        
    if not audio_mix_inputs:
         filter_chains.append(f"anullsrc=channel_layout=stereo:sample_rate=44100[outa]")
    else:
         filter_chains.append(f"{''.join(audio_mix_inputs)}amix=inputs={len(audio_mix_inputs)}:dropout_transition=0,volume={len(audio_mix_inputs)}[outa]")

    return inputs, ";".join(filter_chains)
