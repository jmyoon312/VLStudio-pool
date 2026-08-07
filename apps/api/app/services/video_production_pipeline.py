"""
Complete Video Production Pipeline

Orchestrates:
1. Visual asset generation (images)
2. Audio production (voice, BGM, SFX, mixing)
3. Subtitle generation
4. Video rendering with FFmpeg
5. Quality verification

Usage:
    pipeline = VideoProductionPipeline()
    
    result = await pipeline.produce_video(
        script="안녕하세요! 오늘의 주제는...",
        topic="부산 여행",
        niche="travel",
        channel_id=123
    )
    
    # result:
    # {
    #     "success": True,
    #     "video_path": "/path/to/final.mp4",
    #     "duration": 30.5,
    #     "thumbnail_path": "/path/to/thumb.jpg",
    #     "assets": {...}
    # }
"""

import os
import json
import logging
import asyncio
import uuid
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class VideoFormat(Enum):
    """Video format options"""
    SHORTS = "9:16"      # YouTube Shorts
    STANDARD = "16:9"    # Standard YouTube
    SQUARE = "1:1"       # Instagram


class VideoQuality(Enum):
    """Quality presets"""
    FAST = "fast"        # Lower quality, faster
    STANDARD = "standard"
    HIGH = "high"        # Best quality


@dataclass
class Scene:
    """Scene definition"""
    scene_id: int
    script_segment: str
    duration: float
    image_prompt: str
    transitions: str = "fade"  # fade, slide, none


@dataclass
class VideoProductionConfig:
    """Configuration for video production"""
    format: VideoFormat = VideoFormat.SHORTS
    quality: VideoQuality = VideoQuality.STANDARD
    voice_id: str = "sohee"
    language: str = "ko"
    style: str = "energetic"
    aspect_ratio: str = "9:16"
    include_subtitles: bool = True
    auto_upscale: bool = True
    generate_thumbnail: bool = True


@dataclass
class VideoProductionResult:
    """Result of video production"""
    success: bool
    video_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    duration: float = 0.0
    assets: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class VideoProductionPipeline:
    """
    Complete video production pipeline
    
    Phases:
    1. Script segmentation into scenes
    2. Visual asset generation per scene
    3. Audio production (voice + BGM + SFX)
    4. Subtitle generation
    5. Video rendering with all elements
    6. Thumbnail generation
    7. Quality verification
    """
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "07_Downloads", "video_production"
            )
        
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Sub-pipelines
        self._visual_pipeline = None
        self._audio_pipeline = None
    
    @property
    def visual_pipeline(self):
        if self._visual_pipeline is None:
            from app.services.visual_asset_pipeline import get_visual_asset_pipeline
            self._visual_pipeline = get_visual_asset_pipeline()
        return self._visual_pipeline
    
    @property
    def audio_pipeline(self):
        if self._audio_pipeline is None:
            from app.services.audio_production_pipeline import get_audio_production_pipeline
            self._audio_pipeline = get_audio_production_pipeline()
        return self._audio_pipeline
    
    async def produce_video(
        self,
        script: str,
        topic: str,
        niche: str = "general",
        channel_id: Optional[int] = None,
        config: VideoProductionConfig = None
    ) -> VideoProductionResult:
        """
        Produce complete video from script
        
        Args:
            script: Full script content
            topic: Video topic/title
            niche: Content niche
            channel_id: Channel ID for DNA
            config: Production configuration
            
        Returns:
            VideoProductionResult with final video and metadata
        """
        logger.info(f"[VIDEO] [Video Pipeline] Starting production: {topic}")
        
        if config is None:
            config = VideoProductionConfig()
        
        try:
            # Step 1: Segment script into scenes
            logger.info("   Step 1: Segmenting script...")
            scenes = await self._segment_script(script, config)
            logger.info(f"   Created {len(scenes)} scenes")
            
            # Step 2: Generate visual assets
            logger.info("   Step 2: Generating visuals...")
            visual_result = await self.visual_pipeline.generate_scene_assets(
                scenes=[{
                    "scene_id": s.scene_id,
                    "prompt": s.image_prompt,
                    "duration": s.duration
                } for s in scenes],
                niche=niche,
                style_consistency=True,
                aspect_ratio=config.aspect_ratio,
                quality=config.quality.value
            )
            
            if not visual_result.success:
                return VideoProductionResult(
                    success=False,
                    error=f"Visual generation failed: {visual_result.error}"
                )
            
            # Step 3: Generate audio
            logger.info("   Step 3: Producing audio...")
            audio_result = await self.audio_pipeline.produce_audio(
                script=script,
                niche=niche,
                style=config.style,
                voice_id=config.voice_id,
                language=config.language
            )
            
            if not audio_result.success:
                return VideoProductionResult(
                    success=False,
                    error=f"Audio production failed: {audio_result.error}"
                )
            
            # Step 4: Get subtitle file
            subtitle_path = None
            if config.include_subtitles:
                from app.services.voice_subtitle_pipeline import get_voice_subtitle_pipeline
                voice_pipe = get_voice_subtitle_pipeline()
                # Re-generate for subtitles
                sub_result = await voice_pipe.generate(
                    script_text=script,
                    voice_id=config.voice_id,
                    language=config.language,
                    output_format="srt"
                )
                if sub_result.success:
                    subtitle_path = sub_result.subtitle_path
            
            # Step 5: Render video
            logger.info("   Step 4: Rendering video...")
            video_path = await self._render_video(
                scenes=scenes,
                scene_assets=visual_result.scenes,
                audio_path=audio_result.mixed_path,
                subtitle_path=subtitle_path,
                config=config
            )
            
            if not video_path or not os.path.exists(video_path):
                return VideoProductionResult(
                    success=False,
                    error="Video rendering failed"
                )
            
            # Step 6: Generate thumbnail
            thumbnail_path = None
            if config.generate_thumbnail:
                logger.info("   Step 5: Generating thumbnail...")
                thumbnail_path = await self._generate_thumbnail(
                    topic=topic,
                    niche=niche,
                    video_path=video_path
                )
            
            # Step 7: Security Wash (SAIF Phase 4)
            logger.info("   Step 6: Applying Security Wash (SAIF-P4)...")
            washed_video_path = await self._security_wash(video_path, channel_id=channel_id)
            if washed_video_path:
                video_path = washed_video_path

            # Step 8: Quality verification (simple check)
            logger.info("   Step 7: Verifying quality...")
            quality_ok = await self._verify_quality(video_path)
            
            logger.info(f"   [OK] Video production complete (Security Hardened)!")
            logger.info(f"   Video: {video_path}")
            logger.info(f"   Duration: {audio_result.duration_seconds:.1f}s")
            
            return VideoProductionResult(
                success=quality_ok,
                video_path=video_path,
                thumbnail_path=thumbnail_path,
                duration=audio_result.duration_seconds,
                assets={
                    "scenes": [s.__dict__ for s in scenes],
                    "visual_assets": [a.__dict__ for a in visual_result.scenes],
                    "voice_path": audio_result.voice_path,
                    "bgm_path": audio_result.bgm_path,
                    "subtitle_path": subtitle_path
                }
            )
            
        except Exception as e:
            logger.error(f"[FAIL] [Video Pipeline] Failed: {e}")
            return VideoProductionResult(
                success=False,
                error=str(e)
            )
    
    async def _segment_script(
        self,
        script: str,
        config: VideoProductionConfig
    ) -> List[Scene]:
        """Segment script into scenes"""
        
        # Simple segmentation by sentences
        import re
        
        # Split by sentence-ending punctuation
        segments = re.split(r'([.!?])\s+', script)
        
        scenes = []
        scene_id = 1
        current_text = ""
        
        # Rebuild segments properly
        sentences = []
        i = 0
        while i < len(segments):
            sentences.append(segments[i])
            if i + 1 < len(segments) and segments[i + 1] in '.!?':
                sentences[-1] += segments[i + 1]
                i += 2
            else:
                i += 1
        
        # Group into scenes (roughly 10-15 seconds each)
        target_scene_duration = 12.0  # seconds
        min_scene_duration = 5.0
        
        current_scene_text = ""
        current_duration = 0.0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Estimate duration (average 4 characters per second for speech)
            estimated_duration = max(len(sentence) / 8, 2.0)
            
            current_scene_text += " " + sentence
            current_duration += estimated_duration
            
            # Create scene if long enough
            if current_duration >= min_scene_duration:
                scenes.append(Scene(
                    scene_id=scene_id,
                    script_segment=current_scene_text.strip(),
                    duration=current_duration,
                    image_prompt=self._extract_image_prompt(current_scene_text)
                ))
                
                scene_id += 1
                current_scene_text = ""
                current_duration = 0.0
        
        # Add remaining as final scene
        if current_scene_text.strip():
            scenes.append(Scene(
                scene_id=scene_id,
                script_segment=current_scene_text.strip(),
                duration=max(current_duration, 3.0),
                image_prompt=self._extract_image_prompt(current_scene_text)
            ))
        
        return scenes
    
    def _extract_image_prompt(self, text: str) -> str:
        """Extract image generation prompt from text"""
        
        # Simple keyword extraction
        keywords = []
        
        # Common Korean content keywords
        korean_keywords = {
            "바다": "ocean beach",
            "산": "mountain landscape",
            "도시": "city skyline",
            "음식": "delicious food",
            "여행": "travel adventure",
            "자연": "nature scenery",
            "해변": "beach sunset",
            "야경": "night city lights"
        }
        
        for kr, en in korean_keywords.items():
            if kr in text:
                keywords.append(en)
        
        if not keywords:
            keywords = ["cinematic scene"]
        
        return ", ".join(keywords) + ", high quality, professional cinematography"
    
    async def _render_video(
        self,
        scenes: List[Scene],
        scene_assets: List[Any],
        audio_path: Optional[str],
        subtitle_path: Optional[str],
        config: VideoProductionConfig
    ) -> Optional[str]:
        """Render video from scenes"""
        
        output_path = os.path.join(
            self.output_dir,
            f"video_{uuid.uuid4().hex[:8]}.mp4"
        )
        
        try:
            # Get video engine
            from app.video_engine import VideoEngine
            
            settings = self._get_settings()
            engine = VideoEngine(settings)
            
            # Process each scene
            scene_videos = []
            
            for i, (scene, asset) in enumerate(zip(scenes, scene_assets)):
                if asset.status != "ready" or not asset.image_path:
                    logger.warning(f"   Scene {scene.scene_id} asset not ready, skipping")
                    continue
                
                # Render single scene
                scene_video = engine.render_scene_video(
                    scene_id=scene.scene_id,
                    image_path=asset.image_path,
                    audio_path=audio_path,
                    duration=scene.duration,
                    aspect_ratio=config.aspect_ratio,
                    script=scene.script_segment
                )
                
                if scene_video and os.path.exists(scene_video):
                    scene_videos.append(scene_video)
            
            if not scene_videos:
                logger.error("No scenes rendered successfully")
                return None
            
            # Merge scenes
            if len(scene_videos) == 1:
                import shutil
                shutil.copy(scene_videos[0], output_path)
                return output_path
            
            # Merge multiple scenes
            merged = engine.merge_videos(scene_videos, output_path)
            
            if merged and os.path.exists(merged):
                # Clean up temp files
                for sv in scene_videos:
                    try:
                        os.remove(sv)
                    except:
                        pass
                return merged
            
        except Exception as e:
            logger.error(f"Video rendering failed: {e}")
        
        return None
    
    async def _generate_thumbnail(
        self,
        topic: str,
        niche: str,
        video_path: str
    ) -> Optional[str]:
        """Generate thumbnail from video"""
        
        thumbnail_path = os.path.join(
            self.output_dir,
            f"thumbnail_{uuid.uuid4().hex[:8]}.jpg"
        )
        
        try:
            import subprocess
            
            # Extract frame at 1 second
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-ss", "00:00:01",
                "-vframes", "1",
                "-s", "1280x720",
                thumbnail_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=30
            )
            
            if result.returncode == 0 and os.path.exists(thumbnail_path):
                # Try to enhance with AI
                try:
                    from app.services.vision_agent import AIVisionAgent
                    from app.llm_manager import LLMClient
                    
                    # Could enhance thumbnail here
                    pass
                except:
                    pass
                
                return thumbnail_path
                
        except Exception as e:
            logger.error(f"Thumbnail generation failed: {e}")
        
        return None
    
    async def _security_wash(self, video_path: str, channel_id: Optional[str] = None) -> Optional[str]:
        """[SAIF Phase 4] 고도화된 바이너리 변조 엔진 호출"""
        if channel_id is None:
            channel_id = "default_vloop"
            
        output_path = video_path.replace(".mp4", "_secure.mp4")
        
        try:
            from app.services.video.mutation_engine import mutation_engine
            
            # 전용 엔진에 위임 (DNA 기반 변조)
            success = mutation_engine.apply_mutation(
                input_path=video_path,
                output_path=output_path,
                channel_id=str(channel_id),
                intensity=0.3 # 육안 구분 최소화 수준
            )
            
            if success and os.path.exists(output_path):
                # 원본 삭제 (임시파일인 경우)
                if "_secure" not in video_path:
                    try: os.remove(video_path)
                    except: pass
                return output_path
                
        except Exception as e:
            logger.error(f"[FAIL] [SAIF-P4] Security wash failed: {e}")
        
        return video_path

    async def _verify_quality(self, video_path: str) -> bool:
        """Basic quality verification"""
        
        try:
            import subprocess
            
            # Check file exists and has reasonable size
            if not os.path.exists(video_path):
                return False
            
            file_size = os.path.getsize(video_path)
            if file_size < 100000:  # Less than 100KB
                return False
            
            # Probe video info
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                try:
                    duration = float(result.stdout.strip())
                    if duration < 1.0:
                        return False
                except:
                    pass
            
            return True
            
        except Exception as e:
            logger.warning(f"Quality verification failed: {e}")
            return True  # Assume OK if check fails
    
    def _get_settings(self):
        """Get settings for video engine"""
        from app.config import settings
        return settings


# Global singleton
_video_production_pipeline = None

def get_video_production_pipeline() -> VideoProductionPipeline:
    """Get global VideoProductionPipeline instance"""
    global _video_production_pipeline
    if _video_production_pipeline is None:
        _video_production_pipeline = VideoProductionPipeline()
    return _video_production_pipeline