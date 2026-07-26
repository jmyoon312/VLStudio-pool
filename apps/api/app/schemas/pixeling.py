from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ProjectConfig(BaseModel):
    type: str = Field(default="shorts", description="shorts or long_form")
    aspect_ratio: str = Field(default="9:16", description="9:16, 16:9, or 1:1")
    channel_id: Optional[str] = Field(None, description="Channel ID for preset loading")
    template_id: Optional[str] = Field(None, description="Template identifier")

class AssetConfig(BaseModel):
    type: str = Field(..., description="video, image, or audio")
    path: str = Field(..., description="Absolute or relative path to the asset")
    duration: Optional[float] = None
    effect: Optional[str] = Field(None, description="pan_zoom, etc.")

class ContentConfig(BaseModel):
    script: str = Field(..., description="Full script text")
    assets: List[AssetConfig] = Field(default_factory=list)

class TTSConfig(BaseModel):
    voice_id: str = Field(default="ko-KR-Standard-A")
    speed: float = Field(default=1.0)
    pitch: float = Field(default=0.0)

class BGMConfig(BaseModel):
    track_id: Optional[str] = None
    volume: float = Field(default=0.15)
    ducking: bool = Field(default=True, description="Lower BGM when voice is active")

class SilenceRemovalConfig(BaseModel):
    enabled: bool = Field(default=True)
    threshold_db: float = Field(default=-40.0)
    min_silence_len: float = Field(default=0.5)

class AudioControlConfig(BaseModel):
    tts: Optional[TTSConfig] = Field(default_factory=TTSConfig)
    bgm: Optional[BGMConfig] = Field(default_factory=BGMConfig)
    silence_removal: Optional[SilenceRemovalConfig] = Field(default_factory=SilenceRemovalConfig)

class SubtitleConfig(BaseModel):
    enabled: bool = Field(default=True)
    font: str = Field(default="Pretendard-Bold")
    style: str = Field(default="karaoke", description="karaoke, pop, highlight")
    primary_color: str = Field(default="#FFFF00")
    stroke_color: str = Field(default="#000000")

class TransitionConfig(BaseModel):
    default_type: str = Field(default="fade")
    duration: float = Field(default=0.3)

class VisualControlConfig(BaseModel):
    subtitles: Optional[SubtitleConfig] = Field(default_factory=SubtitleConfig)
    transitions: Optional[TransitionConfig] = Field(default_factory=TransitionConfig)

class PixelingDeepControlRequest(BaseModel):
    project: ProjectConfig = Field(default_factory=ProjectConfig)
    content: ContentConfig
    audio_control: AudioControlConfig = Field(default_factory=AudioControlConfig)
    visual_control: VisualControlConfig = Field(default_factory=VisualControlConfig)
