import os
import time
import logging
from app import dependency_manager

logger = logging.getLogger(__name__)

class SubtitleService:
    def __init__(self, settings):
        self.settings = settings
        from ...config import settings as app_settings
        self.temp_dir = app_settings.TEMP_DIR

    async def generate_ass_file(self, scene_id: int, script: str, duration: float, config: dict, audio_path: str = None, aspect_ratio: str = "9:16") -> str:
        """
        Generates an .ass subtitle file. Supports Advanced Sync (Whisper) if audio is provided.
        """
        if not config or not config.get('enabled', False):
            return None

        events_data = []
        
        # 1. Try Advanced Sync (Whisper + Segmentation)
        try:
            from subtitle_core import SubtitleEngine
            if audio_path and os.path.exists(audio_path):
                events_data = await self._run_advanced_sync(script, audio_path, config)
        except ImportError:
            logger.warning("SubtitleEngine not found. Falling back to simple timing.")

        # 2. Fallback to Simple Timing
        if not events_data:
            events_data = self._generate_simple_timing(script, duration, config)

        # 3. Generate ASS File
        return self._write_ass_file(scene_id, events_data, config, aspect_ratio)

    async def _run_advanced_sync(self, script, audio_path, config):
        """Whisper-based alignment logic"""
        from subtitle_core import SubtitleEngine, parse_srt
        import asyncio
        
        engine = SubtitleEngine(
            ffmpeg_path=dependency_manager.DependencyManager.get_ffmpeg_path(),
            model_path=self.settings.whisper_model_path
        )
        
        # Async wrapping of heavy logic
        raw_srt, error = await asyncio.to_thread(engine.extract_subtitle, audio_path, model_name="base", language="ko")
        if error: raise Exception(error)
        
        split_limit = int(config.get('splitLimit', 20))
        _, step2, error = await asyncio.to_thread(engine.align_and_refine, script, raw_srt, limit=split_limit)
        if error: raise Exception(error)
        
        blocks = parse_srt(step2)
        
        def to_ms(t):
            h, m, s_ms = t.split(":"); s, ms = s_ms.split(",")
            return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)

        return [{'start': to_ms(b['start'])/1000.0, 'end': to_ms(b['end'])/1000.0, 'text': b['text']} for b in blocks]

    def _generate_simple_timing(self, script, duration, config):
        """Uniformly distribute subtitles if Whisper is unavailable"""
        limit = int(config.get('splitLimit', 20))
        words = script.split()
        lines = []
        curr = []
        l = 0
        for w in words:
            if l + len(w) + 1 > limit:
                lines.append(" ".join(curr)); curr = [w]; l = len(w)
            else:
                curr.append(w); l += len(w) + 1
        if curr: lines.append(" ".join(curr))
        
        dur = duration / len(lines)
        return [{'start': i*dur, 'end': (i+1)*dur, 'text': text} for i, text in enumerate(lines)]

    def _write_ass_file(self, scene_id, events_data, config, aspect_ratio):
        """Constructs the .ass file content based on styles and events."""
        filepath = os.path.join(self.temp_dir, f"scene_{scene_id}_{int(time.time())}.ass")
        res_x, res_y = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        
        # Style resolution (simplified for brevity)
        primary = config.get('textColor', '&HFFFFFF')
        
        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {res_x}
PlayResY: {res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{config.get('font', 'Arial')},{config.get('fontSize', 40)},{primary},&H00000000,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,20,20,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        with open(filepath, "w", encoding='utf-8') as f:
            f.write(header)
            for e in events_data:
                start = self._fmt_time(e['start'])
                end = self._fmt_time(e['end'])
                f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{e['text']}\n")
        return filepath

    def _fmt_time(self, t):
        h = int(t // 3600); m = int((t % 3600) // 60); s = int(t % 60); cs = int((t % 1) * 100)
        return f"{h}:{m:02}:{s:02}.{cs:02}"
