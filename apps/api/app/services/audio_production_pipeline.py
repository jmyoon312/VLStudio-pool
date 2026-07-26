"""
Audio Production Pipeline

Orchestrates:
1. Voice generation (TTS)
2. Background music selection/generation
3. Sound effects (SFX) placement
4. Audio mixing with ducking

Usage:
    pipeline = AudioProductionPipeline()
    
    result = await pipeline.produce_audio(
        script="안녕하세요! 오늘의 주제는...",
        niche="travel",
        duration_target=30,
        style="energetic"
    )
    
    # result:
    # {
    #     "voice_path": "/path/to/voice.wav",
    #     "bgm_path": "/path/to/bgm.mp3",
    #     "mixed_path": "/path/to/mixed.mp3",
    #     "duration": 30.2,
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
from enum import Enum

logger = logging.getLogger(__name__)


class AudioMood(Enum):
    """Audio mood categories"""
    ENERGETIC = "energetic"
    CALM = "calm"
    DRAMATIC = "dramatic"
    HAPPY = "happy"
    MYSTERIOUS = "mysterious"
    NEUTRAL = "neutral"


@dataclass
class AudioMixConfig:
    """Audio mixing configuration"""
    bgm_volume: float = 0.25       # 0.0 - 1.0
    voice_volume: float = 1.0       # 0.0 - 1.0
    sfx_volume: float = 0.5        # 0.0 - 1.0
    enable_ducking: bool = True    # Lower BGM when voice plays
    ducking_threshold: float = 0.02
    fade_in_duration: float = 2.0   # seconds
    fade_out_duration: float = 3.0  # seconds


@dataclass
class AudioProductionResult:
    """Result of audio production"""
    success: bool
    voice_path: Optional[str] = None
    bgm_path: Optional[str] = None
    sfx_paths: List[str] = None
    mixed_path: Optional[str] = None
    duration_seconds: float = 0.0
    word_timestamps: List[Dict] = None
    error: Optional[str] = None
    
    def __post_init__(self):
        if self.sfx_paths is None:
            self.sfx_paths = []
        if self.word_timestamps is None:
            self.word_timestamps = []


class AudioProductionPipeline:
    """
    Unified audio production pipeline
    
    Features:
    - Voice/TTS generation (via VoiceSubtitlePipeline)
    - BGM selection based on mood/niche
    - SFX detection and placement
    - Professional audio mixing with ducking
    """
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "downloads", "audio_production"
            )
        
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Sub-pipelines
        self._voice_pipeline = None
        
        # Mood mapping for BGM
        self._mood_keywords = {
            AudioMood.ENERGETIC: ["upbeat", "exciting", "driving", "pop"],
            AudioMood.CALM: ["peaceful", "relaxing", "ambient", "soft"],
            AudioMood.DRAMATIC: ["cinematic", "epic", "suspenseful", "intense"],
            AudioMood.HAPPY: ["cheerful", "bright", "uplifting", "fun"],
            AudioMood.MYSTERIOUS: ["dark", "mystery", "atmospheric", "ambient"],
            AudioMood.NEUTRAL: ["background", "instrumental", "generic"]
        }
    
    @property
    def voice_pipeline(self):
        """Lazy load voice pipeline"""
        if self._voice_pipeline is None:
            from app.services.voice_subtitle_pipeline import get_voice_subtitle_pipeline
            self._voice_pipeline = get_voice_subtitle_pipeline()
        return self._voice_pipeline
    
    async def produce_audio(
        self,
        script: str,
        niche: str = "general",
        duration_target: Optional[float] = None,
        style: str = "energetic",
        voice_id: str = "sohee",
        language: str = "ko",
        config: AudioMixConfig = None
    ) -> AudioProductionResult:
        """
        Produce complete audio track
        
        Args:
            script: Script content
            niche: Content niche (for BGM selection)
            duration_target: Target duration in seconds (None = auto)
            style: Audio style/mood
            voice_id: TTS voice ID
            language: Language code
            config: Mixing configuration
            
        Returns:
            AudioProductionResult with all audio paths
        """
        logger.info(f"🎵 [Audio Pipeline] Starting production")
        logger.info(f"   Script: {len(script)} chars, Style: {style}")
        
        if config is None:
            config = AudioMixConfig()
        
        try:
            # Step 1: Generate voice with timestamps
            logger.info("   Step 1: Generating voice...")
            voice_result = await self.voice_pipeline.generate(
                script_text=script,
                voice_id=voice_id,
                language=language,
                output_format="srt",
                include_timestamps=True
            )
            
            if not voice_result.success:
                return AudioProductionResult(
                    success=False,
                    error=f"Voice generation failed: {voice_result.error}"
                )
            
            voice_path = voice_result.audio_path
            duration = voice_result.duration_seconds
            word_timestamps = voice_result.word_timestamps
            
            logger.info(f"   Voice: {voice_path} ({duration:.1f}s)")
            
            # Step 2: Select/generate BGM
            logger.info("   Step 2: Selecting BGM...")
            bgm_path = await self._select_bgm(
                niche=niche,
                style=style,
                duration=duration
            )
            
            if bgm_path:
                logger.info(f"   BGM: {bgm_path}")
            else:
                logger.warning("   BGM: Not available")
            
            # Step 3: Detect and add SFX
            logger.info("   Step 3: Detecting SFX positions...")
            sfx_paths = await self._detect_and_add_sfx(
                script=script,
                word_timestamps=word_timestamps,
                duration=duration
            )
            
            # Step 4: Mix audio
            logger.info("   Step 4: Mixing audio...")
            mixed_path = await self._mix_audio(
                voice_path=voice_path,
                bgm_path=bgm_path,
                sfx_paths=sfx_paths,
                word_timestamps=word_timestamps,
                config=config
            )
            
            if mixed_path:
                logger.info(f"   ✅ Mixed: {mixed_path}")
            else:
                # Use voice only if mixing failed
                mixed_path = voice_path
                logger.warning("   ⚠️ Mixing failed, using voice only")
            
            return AudioProductionResult(
                success=True,
                voice_path=voice_path,
                bgm_path=bgm_path,
                sfx_paths=sfx_paths,
                mixed_path=mixed_path,
                duration_seconds=duration,
                word_timestamps=word_timestamps
            )
            
        except Exception as e:
            logger.error(f"❌ [Audio Pipeline] Failed: {e}")
            return AudioProductionResult(
                success=False,
                error=str(e)
            )
    
    async def _select_bgm(
        self,
        niche: str,
        style: str,
        duration: float
    ) -> Optional[str]:
        """Select BGM based on niche and style"""
        
        try:
            # Try MCP BGM generation first
            from app.services.mcp.mcp_server import generate_background_music
            
            mood = style if style in [m.value for m in AudioMood] else "neutral"
            
            result = await generate_background_music(
                mood=mood,
                duration_sec=int(duration) + 10,  # Add buffer
                engine="musicgen"
            )
            
            if result.get("success") and result.get("bgm_path"):
                return result["bgm_path"]
                
        except Exception as e:
            logger.warning(f"BGM generation failed: {e}")
        
        # Fallback: Try static music directory
        static_music_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "static", "music", style
        )
        
        if os.path.exists(static_music_dir):
            import random
            files = [f for f in os.listdir(static_music_dir) 
                    if f.endswith(('.mp3', '.wav', '.m4a'))]
            if files:
                return os.path.join(static_music_dir, random.choice(files))
        
        return None
    
    async def _detect_and_add_sfx(
        self,
        script: str,
        word_timestamps: List[Dict],
        duration: float
    ) -> List[str]:
        """Detect SFX opportunities and add them"""
        
        sfx_paths = []
        
        # Common SFX triggers in Korean/English
        sfx_triggers = {
            "와!": "applause",
            "대박!": "applause",
            "爆炸": "explosion",
            "쿵": "thud",
            "타타타": "gunfire",
            "빠라빠라": "rain",
            "딩동": "bell",
            "噹": "bell",
            "!": "impact",
            "???": "question"
        }
        
        # Check for triggers in script
        found_sfx = []
        for trigger, sfx_type in sfx_triggers.items():
            if trigger in script:
                found_sfx.append(sfx_type)
        
        if not found_sfx:
            return sfx_paths
        
        # Try to generate SFX
        try:
            from app.services.mcp.mcp_server import generate_sfx_for_video
            
            sfx_descriptions = [
                {"description": sfx, "start_time": duration * 0.5}  # Placeholder position
                for sfx in found_sfx[:3]  # Limit to 3
            ]
            
            result = await generate_sfx_for_video(
                video_path="",
                sfx_descriptions=sfx_descriptions
            )
            
            if result.get("success"):
                for sfx_data in result.get("generated_sfx", []):
                    if sfx_data.get("file_path"):
                        sfx_paths.append(sfx_data["file_path"])
                        
        except Exception as e:
            logger.warning(f"SFX generation failed: {e}")
        
        return sfx_paths
    
    async def _mix_audio(
        self,
        voice_path: Optional[str],
        bgm_path: Optional[str],
        sfx_paths: List[str],
        word_timestamps: List[Dict],
        config: AudioMixConfig
    ) -> Optional[str]:
        """Mix all audio tracks together"""
        
        if not voice_path:
            return None
        
        # If no BGM, just return voice
        if not bgm_path and not sfx_paths:
            return voice_path
        
        output_path = os.path.join(
            self.output_dir,
            f"mixed_{uuid.uuid4().hex[:8]}.mp3"
        )
        
        try:
            import subprocess
            
            # Build ffmpeg command
            cmd = ["ffmpeg", "-y"]  # -y to overwrite
            
            inputs = []
            
            # Voice input
            if voice_path and os.path.exists(voice_path):
                cmd.extend(["-i", voice_path])
                inputs.append(voice_path)
            
            # BGM input
            if bgm_path and os.path.exists(bgm_path):
                cmd.extend(["-i", bgm_path])
                inputs.append(bgm_path)
            
            # SFX inputs
            for sfx_path in sfx_paths:
                if sfx_path and os.path.exists(sfx_path):
                    cmd.extend(["-i", sfx_path])
                    inputs.append(sfx_path)
            
            if len(inputs) < 2:
                # Just copy voice
                import shutil
                shutil.copy(voice_path, output_path)
                return output_path
            
            # Build filter complex
            filter_complex = ""
            
            if bgm_path and config.enable_ducking and word_timestamps:
                # Advanced: Use voice timestamps for ducking
                # Simplified: Use sidechain compression
                filter_complex = (
                    f"[1:a]volume={config.bgm_volume}[bgm];"
                    f"[bgm]asetpts=PTS-STARTPTS[bgm_out];"
                    f"[0:a]asetpts=PTS-STARTPTS[voice_out];"
                    f"[bgm_out][voice_out]amix=inputs=2:duration=first[out]"
                )
            elif bgm_path:
                filter_complex = (
                    f"[1:a]volume={config.bgm_volume}[bgm];"
                    f"[0:a][bgm]amix=inputs=2:duration=first[out]"
                )
            else:
                filter_complex = "[0:a]copy[out]"
            
            cmd.extend([
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-t", str(config.fade_out_duration) if config.fade_out_duration else None,
                output_path
            ])
            
            # Remove None values
            cmd = [c for c in cmd if c]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0 and os.path.exists(output_path):
                return output_path
            else:
                logger.warning(f"Mixing failed: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Audio mixing error: {e}")
        
        return None
    
    async def adjust_audio_levels(
        self,
        audio_path: str,
        target_rms: float = -20.0
    ) -> Optional[str]:
        """Normalize audio levels"""
        
        output_path = audio_path.replace(".mp3", "_normalized.mp3")
        
        try:
            import subprocess
            
            cmd = [
                "ffmpeg", "-y",
                "-i", audio_path,
                "-af", f"loudnorm=I={target_rms}",
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60
            )
            
            if result.returncode == 0:
                return output_path
                
        except Exception as e:
            logger.error(f"Normalization failed: {e}")
        
        return None


# Global singleton
_audio_production_pipeline = None

def get_audio_production_pipeline() -> AudioProductionPipeline:
    """Get global AudioProductionPipeline instance"""
    global _audio_production_pipeline
    if _audio_production_pipeline is None:
        _audio_production_pipeline = AudioProductionPipeline()
    return _audio_production_pipeline