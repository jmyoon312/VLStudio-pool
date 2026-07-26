import os
import sys
import time
import logging
import subprocess
import uuid
import shutil
import asyncio
from . import schemas
from .llm_manager import LLMClient
from .tts_engine import TTSEngine

from app import dependency_manager

# Import SubtitleEngine
try:
    from subtitle_core import SubtitleEngine
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
    try:
        from subtitle_core import SubtitleEngine
    except ImportError:
        SubtitleEngine = None

logger = logging.getLogger(__name__)

class DubbingEngine:
    def __init__(self, settings: schemas.Settings):
        self.settings = settings
        self.llm_client = LLMClient(settings)
        self.tts_engine = TTSEngine(settings)
        
        # [FIX] Use settings for cross-platform directory
        from app.config import settings as app_settings
        self.base_media_dir = app_settings.MEDIA_ROOT
        self.temp_dir = app_settings.TEMP_DIR
        os.makedirs(self.temp_dir, exist_ok=True)

    async def dub_video(self, video_path: str, target_lang: str, voice_id: str = None) -> str:
        """
        Full Dubbing Pipeline:
        1. Transcribe (SRT)
        2. Translate (LLM)
        3. TTS (Generate Audio)
        4. Sync (Time Stretch)
        5. Merge (Replace Audio)
        """
        logger.info(f"🎙️ Starting Dubbing for {video_path} to {target_lang}")
        
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")
            
        if not SubtitleEngine:
            raise RuntimeError("SubtitleEngine missing. Cannot transcribe.")

        # 1. Transcribe
        logger.info("Step 1: Transcribing...")
        sub_engine = SubtitleEngine(
            ffmpeg_path=dependency_manager.DependencyManager.get_ffmpeg_path(),
            model_path=self.settings.whisper_model_path
        )
        
        # We need raw segments with timestamps
        # SubtitleEngine usually returns SRT string. We might need to parse it or add a method to get segments.
        # Let's assume we can get SRT and parse it, or use `extract_subtitle` and parse.
        srt_content, error = sub_engine.extract_subtitle(video_path, model_name="base", language="auto")
        if error: raise RuntimeError(f"Transcription failed: {error}")
        
        segments = self._parse_srt(srt_content)
        logger.info(f"Found {len(segments)} segments.")

        # 2. Translate & 3. Generate Audio
        logger.info("Step 2 & 3: Translating and Generating Audio...")
        
        dubbed_segments = []
        
        for i, seg in enumerate(segments):
            original_text = seg['text']
            start = seg['start']
            end = seg['end']
            duration = end - start
            
            # Translate
            translated_text = self._translate_text(original_text, target_lang)
            
            # Generate TTS
            # Use a default voice if not provided based on lang
            # For now, just use what's passed or default
            audio_path = await self.tts_engine.generate_audio(
                text=translated_text,
                engine="edge", # Default to Edge for speed/cost
                language=target_lang,
                voice_id=voice_id
            )
            
            # 4. Sync (Time Stretch)
            synced_audio_path = self._sync_audio(audio_path, duration)
            
            dubbed_segments.append({
                "start": start,
                "end": end,
                "path": synced_audio_path
            })
            
        # 5. Merge
        logger.info("Step 5: Merging Audio Tracks...")
        final_output = self._merge_audio_tracks(video_path, dubbed_segments)
        
        return final_output

    def _parse_srt(self, srt_content: str) -> list[dict]:
        """
        Parses SRT content into a list of dicts: {'start': float, 'end': float, 'text': str}
        """
        import re
        segments = []
        blocks = re.split(r'\n\n+', srt_content.strip())
        
        for block in blocks:
            lines = block.split('\n')
            if len(lines) >= 3:
                # index = lines[0]
                time_line = lines[1]
                text = " ".join(lines[2:])
                
                # Parse time: 00:00:01,000 --> 00:00:04,000
                times = time_line.split(' --> ')
                if len(times) != 2: continue
                
                def to_sec(t_str):
                    h, m, s_ms = t_str.split(':')
                    s, ms = s_ms.split(',')
                    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0
                
                start = to_sec(times[0])
                end = to_sec(times[1])
                
                segments.append({'start': start, 'end': end, 'text': text})
                
        return segments

    def _translate_text(self, text: str, target_lang: str) -> str:
        """
        Uses LLM to translate text.
        """
        prompt = f"Translate the following subtitle text to {target_lang}. Keep it concise and natural for subtitles.\n\nText: {text}"
        try:
            # Use a fast model
            return self.llm_client.generate_content(prompt, model_name=self.settings.default_model).strip()
        except:
            return text # Fallback

    def _sync_audio(self, audio_path: str, target_duration: float) -> str:
        """
        Stretches/Squeezes audio to fit target_duration using FFmpeg atempo.
        """
        # Get current duration
        ffprobe = dependency_manager.DependencyManager.get_ffprobe_path()
        cmd = [ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audio_path]
        current_duration = float(subprocess.check_output(cmd).strip())
        
        if current_duration <= 0: return audio_path
        
        ratio = current_duration / target_duration
        
        # Clamp ratio to avoid extreme robotic sounds (0.5x to 2.0x)
        # If it's too fast/slow, we might just accept the mismatch or silence padding.
        # For dubbing, usually we want to fit.
        
        # FFmpeg atempo filter limits: 0.5 to 2.0. Chain them if needed.
        # For simplicity, we clamp.
        ratio = max(0.5, min(2.0, ratio))
        
        output_path = audio_path.replace(".mp3", f"_synced_{uuid.uuid4().hex[:4]}.mp3")
        ffmpeg = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        cmd = [
            ffmpeg, '-y',
            '-i', audio_path,
            '-filter:a', f"atempo={ratio}",
            output_path
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    def _merge_audio_tracks(self, video_path: str, segments: list[dict]) -> str:
        """
        Creates a new audio track from segments and merges it with the video.
        """
        # 1. Create a complex filter to place audio segments at specific times
        # This is hard with many segments. Better approach:
        # Create a silent base audio of video duration.
        # Mix each segment into it.
        # OR: Use concat with padding (adelay).
        
        # Approach: "adelay" filter.
        # inputs: [s1][s2]...
        # filter: [0]adelay=start1|start1[a0];[1]adelay=start2|start2[a1];...[a0][a1]amix=inputs=N
        
        # Limit: Command line length. If too many segments, this fails.
        # Better: Generate a silence file, then use a loop to mix? Slow.
        
        # Robust Approach:
        # Generate a list of files for concat, filling gaps with silence.
        
        # 1. Get total duration
        ffprobe = dependency_manager.DependencyManager.get_ffprobe_path()
        cmd = [ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video_path]
        total_duration = float(subprocess.check_output(cmd).strip())
        
        concat_list_path = os.path.join(self.temp_dir, f"dub_concat_{uuid.uuid4()}.txt")
        
        current_time = 0.0
        ffmpeg = dependency_manager.DependencyManager.get_ffmpeg_path()
        
        # We need to generate silence files for gaps.
        # This is getting complex for a single function.
        
        # Alternative: Use `pydub` to construct the track in memory/disk?
        # Pydub is easier for this.
        try:
            from pydub import AudioSegment
            
            # Create silent track
            full_audio = AudioSegment.silent(duration=int(total_duration * 1000))
            
            for seg in segments:
                start_ms = int(seg['start'] * 1000)
                seg_audio = AudioSegment.from_file(seg['path'])
                
                # Overlay
                full_audio = full_audio.overlay(seg_audio, position=start_ms)
                
            # Export full audio
            mixed_audio_path = os.path.join(self.temp_dir, f"dubbed_track_{uuid.uuid4()}.mp3")
            full_audio.export(mixed_audio_path, format="mp3")
            
            # Merge with Video (Replace Audio)
            output_video_path = os.path.join(self.temp_dir, f"dubbed_final_{uuid.uuid4()}.mp4")
            
            cmd = [
                ffmpeg, '-y',
                '-i', video_path,
                '-i', mixed_audio_path,
                '-c:v', 'copy', # Copy video stream
                '-c:a', 'aac',
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-shortest',
                output_video_path
            ]
            
            subprocess.run(cmd, check=True, capture_output=True)
            return output_video_path
            
        except ImportError:
            # Fallback if pydub missing (shouldn't be, it's in requirements)
            raise RuntimeError("Pydub required for audio mixing.")
