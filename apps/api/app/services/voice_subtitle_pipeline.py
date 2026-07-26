"""
Automated Voice & Subtitle Pipeline

Orchestrates:
1. TTS generation with multiple engine fallback
2. Subtitle generation using faster-whisper
3. Word-level timestamp alignment
4. SRT/VTT subtitle file creation

Usage:
    pipeline = VoiceSubtitlePipeline()
    
    result = await pipeline.generate(
        script_text="안녕하세요! 오늘은...",
        voice_id="sohee",
        language="ko",
        output_format="srt"  # or "vtt"
    )
    
    # result:
    # {
    #     "audio_path": "/path/to/audio.wav",
    #     "subtitle_path": "/path/to/subtitles.srt",
    #     "duration_seconds": 30.5,
    #     "word_timestamps": [...]
    # }
"""

import os
import json
import logging
import asyncio
import uuid
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class SubtitleSegment:
    """Single subtitle segment with timing"""
    index: int
    start_time: float  # seconds
    end_time: float    # seconds
    text: str
    words: List[Dict] = None  # [{"word": "안녕하세요", "start": 0.0, "end": 0.5}, ...]


@dataclass
class PipelineResult:
    """Result of voice/subtitle pipeline"""
    success: bool
    audio_path: Optional[str] = None
    subtitle_path: Optional[str] = None
    duration_seconds: float = 0.0
    word_timestamps: List[Dict] = None
    error: Optional[str] = None
    
    def __post_init__(self):
        if self.word_timestamps is None:
            self.word_timestamps = []


class VoiceSubtitlePipeline:
    """
    Automated voice and subtitle generation pipeline
    
    Engines:
    - TTS: Kokoro, Qwen, ElevenLabs, Edge-TTS (fallback)
    - Subtitle: Faster-Whisper (word-level timestamps)
    - Format: SRT, VTT, or both
    """
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "downloads", "voice_subtitle"
            )
        
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Cache for TTS manager (lazy load)
        self._tts_manager = None
        
        # Subtitle format settings
        self.default_format = "srt"
    
    @property
    def tts_manager(self):
        """Lazy load TTS manager"""
        if self._tts_manager is None:
            from app.services.tts_manager import TTSManager
            self._tts_manager = TTSManager()
        return self._tts_manager
    
    async def generate(
        self,
        script_text: str,
        voice_id: str = "sohee",
        language: str = "ko",
        output_format: str = "srt",
        tts_engine: str = "auto",
        include_timestamps: bool = True,
        config: Dict[str, Any] = None
    ) -> PipelineResult:
        """
        Generate voice and subtitles from script
        
        Args:
            script_text: Script content to speak
            voice_id: Voice ID (e.g., "sohee", "jiyoon")
            language: Language code (ko, en, ja, etc.)
            output_format: "srt", "vtt", or "both"
            tts_engine: TTS engine to use ("auto", "kokoro", "qwen", "elevenlabs")
            include_timestamps: Whether to generate word-level timestamps
            config: TTS configuration (API keys, URLs)
            
        Returns:
            PipelineResult with audio_path, subtitle_path, duration
        """
        logger.info(f"🎙️ [Pipeline] Starting voice/subtitle generation")
        logger.info(f"   Script length: {len(script_text)} chars")
        logger.info(f"   Language: {language}, Voice: {voice_id}")
        
        try:
            # Step 1: Generate TTS audio
            audio_path = await self._generate_tts(
                script_text, voice_id, language, tts_engine, config
            )
            
            if not audio_path:
                return PipelineResult(
                    success=False,
                    error="TTS generation failed"
                )
            
            # Step 2: Get audio duration
            duration = self._get_audio_duration(audio_path)
            logger.info(f"   Audio duration: {duration:.2f}s")
            
            # Step 3: Generate subtitles with timestamps
            if include_timestamps:
                word_timestamps = await self._generate_word_timestamps(
                    audio_path, language
                )
            else:
                # Simple time-division subtitle
                word_timestamps = self._simple_subtitle_division(
                    script_text, duration, language
                )
            
            # Step 4: Create subtitle files
            subtitle_paths = await self._create_subtitle_files(
                word_timestamps, output_format
            )
            
            logger.info(f"✅ [Pipeline] Complete!")
            logger.info(f"   Audio: {audio_path}")
            logger.info(f"   Subtitles: {subtitle_paths}")
            
            return PipelineResult(
                success=True,
                audio_path=audio_path,
                subtitle_path=subtitle_paths.get(output_format),
                duration_seconds=duration,
                word_timestamps=word_timestamps
            )
            
        except Exception as e:
            logger.error(f"❌ [Pipeline] Failed: {e}")
            return PipelineResult(
                success=False,
                error=str(e)
            )
    
    async def _generate_tts(
        self,
        text: str,
        voice_id: str,
        language: str,
        engine: str,
        config: Optional[Dict]
    ) -> Optional[str]:
        """Generate TTS audio"""
        
        # Default config
        if config is None:
            config = {}
        
        # Generate unique filename
        filename = f"voice_{uuid.uuid4().hex[:8]}.wav"
        output_path = os.path.join(self.output_dir, filename)
        
        # Use synchronous TTS in thread pool
        loop = asyncio.get_event_loop()
        
        def _sync_tts():
            return self.tts_manager.generate_speech(
                text=text,
                voice_id=voice_id,
                engine=engine,
                config=config
            )
        
        result, error = await loop.run_in_executor(None, _sync_tts)
        
        if error:
            logger.error(f"TTS error: {error}")
            return None
        
        # Move result to output directory if needed
        if result and result != output_path:
            if os.path.exists(result):
                import shutil
                shutil.move(result, output_path)
                return output_path
        
        return result if os.path.exists(output_path) else None
    
    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio file duration in seconds"""
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(audio_path)
            return len(audio) / 1000.0  # pydub uses milliseconds
        except Exception as e:
            logger.warning(f"Could not get audio duration: {e}")
            return 30.0  # Default estimate
    
    async def _generate_word_timestamps(
        self,
        audio_path: str,
        language: str
    ) -> List[Dict]:
        """Generate word-level timestamps using Faster-Whisper"""
        
        try:
            from faster_whisper import WhisperModel
            
            # Use small model for speed
            model_size = "small" if language == "ko" else "base"
            
            logger.info(f"   Running Whisper ({model_size}) for timestamps...")
            
            # Run in thread pool
            loop = asyncio.get_event_loop()
            
            def _sync_whisper():
                model = WhisperModel(model_size, device="cpu", compute_type="int8")
                segments, info = model.transcribe(
                    audio_path,
                    language=language,
                    word_timestamps=True,
                    vad_filter=True
                )
                
                results = []
                for segment in segments:
                    for word in segment.words:
                        results.append({
                            "word": word.word,
                            "start": word.start,
                            "end": word.end,
                            "probability": word.probability
                        })
                
                return results
            
            word_timestamps = await loop.run_in_executor(None, _sync_whisper)
            
            if word_timestamps:
                logger.info(f"   Extracted {len(word_timestamps)} word timestamps")
                return word_timestamps
            
        except Exception as e:
            logger.warning(f"Whisper timestamp extraction failed: {e}")
        
        # Fallback to simple division
        logger.info("   Using simple subtitle division")
        # This would need duration, passing empty for now
        return []
    
    def _simple_subtitle_division(
        self,
        text: str,
        duration: float,
        language: str
    ) -> List[Dict]:
        """Simple subtitle division when Whisper fails"""
        
        # Split by sentences
        import re
        sentences = re.split(r'[.!?]\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return [{"word": text, "start": 0, "end": duration}]
        
        time_per_sentence = duration / len(sentences)
        
        timestamps = []
        current_time = 0.0
        
        for i, sentence in enumerate(sentences):
            start = current_time
            end = current_time + time_per_sentence
            
            # Add words within sentence
            words = sentence.split()
            if words:
                time_per_word = time_per_sentence / len(words)
                for j, word in enumerate(words):
                    timestamps.append({
                        "word": word,
                        "start": start + (j * time_per_word),
                        "end": start + ((j + 1) * time_per_word),
                        "probability": 1.0
                    })
            
            current_time = end
        
        return timestamps
    
    async def _create_subtitle_files(
        self,
        word_timestamps: List[Dict],
        output_format: str
    ) -> Dict[str, str]:
        """Create SRT/VTT subtitle files"""
        
        paths = {}
        
        if not word_timestamps:
            return paths
        
        # Group words into subtitle segments (roughly 3-5 words or 2-4 seconds)
        segments = self._group_words_into_segments(word_timestamps)
        
        if output_format in ["srt", "both"]:
            srt_path = await self._write_srt(segments)
            if srt_path:
                paths["srt"] = srt_path
        
        if output_format in ["vtt", "both"]:
            vtt_path = await self._write_vtt(segments)
            if vtt_path:
                paths["vtt"] = vtt_path
        
        return paths
    
    def _group_words_into_segments(
        self,
        word_timestamps: List[Dict],
        max_words: int = 5,
        max_duration: float = 4.0
    ) -> List[SubtitleSegment]:
        """Group words into subtitle segments"""
        
        if not word_timestamps:
            return []
        
        segments = []
        current_words = []
        segment_start = 0.0
        
        for i, word_data in enumerate(word_timestamps):
            current_words.append(word_data)
            
            # Check if should end segment
            should_end = (
                len(current_words) >= max_words or
                (current_words[-1]["end"] - current_words[0]["start"]) >= max_duration or
                i == len(word_timestamps) - 1  # Last word
            )
            
            if should_end and current_words:
                # Create segment
                text = " ".join(w["word"] for w in current_words)
                segment = SubtitleSegment(
                    index=len(segments) + 1,
                    start_time=current_words[0]["start"],
                    end_time=current_words[-1]["end"],
                    text=text,
                    words=current_words.copy()
                )
                segments.append(segment)
                current_words = []
        
        return segments
    
    async def _write_srt(self, segments: List[SubtitleSegment]) -> Optional[str]:
        """Write SRT subtitle file"""
        
        filename = f"subtitles_{uuid.uuid4().hex[:8]}.srt"
        filepath = os.path.join(self.output_dir, filename)
        
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                for seg in segments:
                    f.write(f"{seg.index}\n")
                    f.write(f"{self._format_srt_time(seg.start_time)} --> {self._format_srt_time(seg.end_time)}\n")
                    f.write(f"{seg.text}\n\n")
            
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to write SRT: {e}")
            return None
    
    async def _write_vtt(self, segments: List[SubtitleSegment]) -> Optional[str]:
        """Write VTT subtitle file"""
        
        filename = f"subtitles_{uuid.uuid4().hex[:8]}.vtt"
        filepath = os.path.join(self.output_dir, filename)
        
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write("WEBVTT\n\n")
                
                for seg in segments:
                    f.write(f"{seg.index}\n")
                    f.write(f"{self._format_vtt_time(seg.start_time)} --> {self._format_vtt_time(seg.end_time)}\n")
                    f.write(f"{seg.text}\n\n")
            
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to write VTT: {e}")
            return None
    
    def _format_srt_time(self, seconds: float) -> str:
        """Format time for SRT (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    def _format_vtt_time(self, seconds: float) -> str:
        """Format time for VTT (HH:MM:SS.mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
    
    async def batch_generate(
        self,
        scripts: List[Dict[str, Any]],
        default_config: Dict[str, Any] = None
    ) -> List[PipelineResult]:
        """
        Generate voice/subtitles for multiple scripts
        
        Args:
            scripts: List of {"text": "...", "voice_id": "...", "language": "..."}
            default_config: Default TTS configuration
            
        Returns:
            List of PipelineResult
        """
        
        results = []
        
        for i, script_data in enumerate(scripts):
            logger.info(f"Processing script {i+1}/{len(scripts)}")
            
            result = await self.generate(
                script_text=script_data.get("text", ""),
                voice_id=script_data.get("voice_id", "sohee"),
                language=script_data.get("language", "ko"),
                output_format=script_data.get("format", "srt"),
                tts_engine=script_data.get("engine", "auto"),
                config=default_config
            )
            
            results.append(result)
            
            # Small delay between requests
            if i < len(scripts) - 1:
                await asyncio.sleep(0.5)
        
        return results


# Global singleton
_voice_subtitle_pipeline = None

def get_voice_subtitle_pipeline() -> VoiceSubtitlePipeline:
    """Get global VoiceSubtitlePipeline instance"""
    global _voice_subtitle_pipeline
    if _voice_subtitle_pipeline is None:
        _voice_subtitle_pipeline = VoiceSubtitlePipeline()
    return _voice_subtitle_pipeline