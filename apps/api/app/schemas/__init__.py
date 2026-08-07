from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Any, Dict

# Stealth Protocol Schemas
class TinCanAccountBase(BaseModel):
    email: str
    owner_identity: str
    status: str = "INCUBATING"
    proxy_config: Optional[str] = None
    last_upload_ip: Optional[str] = None

class TinCanAccount(TinCanAccountBase):
    id: int
    client_secret_json: Optional[str] = None # Return explicitly if needed, or hide?
    recovery_email: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class CaptainAccountBase(BaseModel):
    email: str
    browser_profile_name: str
    risk_score: int = 0

class CaptainAccount(CaptainAccountBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# [NEW] Daily Report System
class ReportStats(BaseModel):
    videos_collected: int
    scripts_collected: int
    failed_downloads: int
    channels: dict
    trends_cached: int
    logs: dict
    recent_errors: Optional[List[str]] = []

class DailyReport(BaseModel):
    id: int
    report_date: datetime
    summary_markdown: str
    raw_stats_json: ReportStats
    auto_fix_log: Optional[List[dict]] = [] # [NEW]
    is_read: bool 
    created_at: datetime

    class Config:
        from_attributes = True

# Category schemas
class CategoryBase(BaseModel):
    name: str
    folder_name: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    level: Optional[int] = 0

class Category(CategoryBase):
    id: int
    name_en: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[int] = 0
    is_fixed: Optional[bool] = False
    ai_generated: Optional[bool] = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CategoryTreeNode(Category):
    children: List['CategoryTreeNode'] = []

CategoryTreeNode.update_forward_refs()

# Channel schemas
class ChannelBase(BaseModel):
    url: str
    platform: str
    name: str
    folder_name: str
    thumbnail_path: Optional[str] = None
    category_id: Optional[int] = None
    last_scanned_at: Optional[datetime] = None
    auto_download: bool = True
    default_script_only: bool = False
    subscriber_count: Optional[int] = 0 # [NEW]


    class Config:
        from_attributes = True

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    status: Optional[str] = None
    auto_download: Optional[bool] = None
    default_script_only: Optional[bool] = None # [NEW]
    last_scanned_at: Optional[datetime] = None

class Channel(ChannelBase):
    id: int
    status: str
    default_script_only: bool # [NEW]
    created_at: datetime
    last_scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Video schemas
class VideoBase(BaseModel):
    video_id: Optional[str] = None
    title: str
    url: Optional[str] = None
    file_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    upload_date: Optional[datetime] = None
    status: str = "downloaded"
    metadata_json: Optional[Any] = None
    is_script_only: bool = False
    viral_score: Optional[float] = 0.0 # [NEW]
    velocity_score: Optional[float] = 0.0 # [NEW]
    view_count: Optional[int] = 0 # [FIX] Ensure this is exposed
    duration: Optional[int] = 0 # [FIX] Ensure this is exposed
    
    # [NEW] Distribution Status
    upload_status: Optional[str] = None
    privacy_status: Optional[str] = None
    uploaded_video_id: Optional[str] = None
    
    # [NEW] Content preview for script mode
    content: Optional[str] = None

    @classmethod
    def parse_metadata(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except:
                return {}
        return v
        
    # Check if we should use @validator or @field_validator depending on Pydantic version
    # Given existing codebase uses `class Config`, likely Pydantic V1 or V2 compat
    # Using specific import to be safe
    from pydantic import validator
    @validator('metadata_json', pre=True, check_fields=False)
    def validate_metadata_json(cls, v):
        return cls.parse_metadata(v)

class VideoCreate(VideoBase):
    channel_id: int

class Video(VideoBase):
    id: int
    channel_id: Optional[int] = None
    channel: Optional["Channel"] = None # [FIX] Include channel info in response
    downloaded_at: datetime

    class Config:
        from_attributes = True

# Asset Schemas
class AssetQuery(BaseModel):
    source_channel_id: Optional[int] = None
    keywords: List[str] = []
    limit: int = 1
    sort_by: str = "upload_date" # upload_date, viral_score
    time_range_hours: Optional[int] = None # e.g. 24 for last 24h
    viewed_at: Optional[datetime] = None
    file_missing: bool = False
    is_script_only: bool = False # [NEW]

    class Config:
        from_attributes = True

# Settings schemas
class SettingsBase(BaseModel):
    root_download_path: str = "07_Downloads"
    cookies_path: Optional[str] = None
    global_auto_download: Optional[bool] = None
    enable_trend_scheduling: Optional[bool] = None # [NEW]
    scan_interval_minutes: Optional[int] = None
    enable_view_stats_collection: Optional[bool] = True # [NEW]
    
    # [NEW] Auto HD Download Thresholds
    auto_hd_viral_threshold: Optional[float] = None
    auto_hd_velocity_threshold: Optional[float] = None
    
    # [NEW] Outlier Pre-filtering Thresholds
    outlier_ev_threshold: Optional[float] = 120.0
    outlier_ratio_threshold: Optional[float] = 1.5
    
    # [NEW] ADB & Browser
    adb_default_serial: Optional[str] = None
    adb_connection_method: Optional[str] = "usb"
    chrome_path: Optional[str] = "/usr/bin/google-chrome"
    headless_mode: Optional[bool] = True
    ixbrowser_api_url: Optional[str] = "http://127.0.0.1:4320"
    
    # [NEW] Multi-Proxy Routing Settings
    proxy_mode: Optional[str] = "DIRECT_LTE"
    netshare_ip: Optional[str] = "192.168.49.1"
    netshare_port: Optional[int] = 8282
    isp_proxy_url: Optional[str] = None

    ffmpeg_path: Optional[str] = None
    whisper_model_path: Optional[str] = None
    default_tts_engine: Optional[str] = None
    default_model_size: Optional[str] = "base"
    default_language: Optional[str] = "ko"
    jina_reader_endpoint: Optional[str] = "http://localhost:20128/v1/web/fetch"
    jina_reader_api_keys: Optional[List[str]] = []
    gemini_api_keys: Optional[List[str]] = []
    elevenlabs_api_keys: Optional[List[str]] = []
    typecast_api_keys: Optional[List[str]] = []
    groq_api_keys: Optional[List[str]] = []
    tavily_api_keys: Optional[List[str]] = []
    sambanova_api_keys: Optional[List[str]] = [] # [NEW]
    cerebras_api_keys: Optional[List[str]] = [] # [NEW]
    openrouter_api_keys: Optional[List[str]] = [] # [NEW]
    nvidia_api_keys: Optional[List[str]] = []     # [Added]
    opencode_api_keys: Optional[List[str]] = []   # [OpenCode Zen]
    youtube1_api_keys: Optional[List[str]] = []   # [YouTube1 Custom Provider]
    
    # [NEW] Phase 1: Media & Automation Keys
    pexels_api_keys: Optional[List[str]] = []
    pixabay_api_keys: Optional[List[str]] = []
    fal_api_keys: Optional[List[str]] = []
    replicate_api_keys: Optional[List[str]] = []
    muapi_api_keys: Optional[List[str]] = []
    n8n_base_url: Optional[str] = "http://localhost:5678"
    
    supertone_project_key: Optional[str] = None
    supertone_local_enabled: Optional[bool] = None # [NEW]
    supertone_model_path: Optional[str] = "backend/models/supertonic" # [NEW]
    kokoro_tts_url: Optional[str] = "https://tts1.gogloo.gleeze.com"
    searxng_url: Optional[str] = "https://search.gogloo.gleeze.com/search"
    web_search_engine: Optional[str] = "searxng_first" # [NEW]
    
    # [NEW] Ollama Local Inference
    ollama_api_base_url: Optional[str] = "http://127.0.0.1:11434/v1"
    
    openai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    qwen_tts_url: Optional[str] = "https://miscultivated-nonvertically-londa.ngrok-free.dev"
    groq_api_key: Optional[str] = None
    kie_api_key: Optional[str] = None
    ytdlp_auto_update: Optional[bool] = None
    ytdlp_last_check: Optional[datetime] = None
    ytdlp_version: Optional[str] = None
    ffmpeg_status: Optional[str] = None
    default_model: Optional[str] = None
    hermes_agent_model: Optional[str] = None
    
    # Advanced Rate Limiting
    rate_limit_requests: Optional[int] = 30
    rate_limit_window: Optional[int] = 60
    circuit_breaker_threshold: Optional[int] = 5
    
    script_analysis_provider: Optional[str] = "opencode"
    script_analysis_model: Optional[str] = "opencode/deepseek-v4-flash-free"

    # Distributed AI Grid
    audio_node_url: Optional[str] = "https://miscultivated-nonvertically-londa.ngrok-free.dev"
    audio_node_api_key: Optional[str] = None
    visual_node_url: Optional[str] = "https://unstalled-eustyle-chet.ngrok-free.dev"
    visual_node_api_key: Optional[str] = None
    
    # [NEW] Model Caching
    model_cache: Optional[Dict[str, Any]] = None
    model_cache_updated_at: Optional[datetime] = None
    
    # [NEW] OpenClaw Integration
    openclaw_preferred_provider: Optional[str] = None
    openclaw_model: Optional[str] = None
    default_llm_model: Optional[str] = "gemini-2.0-flash-exp"

    # [Phase 5: Sovereign Hermes Intelligence]
    hermes_agent_provider: Optional[str] = "google"
    hermes_agent_model: Optional[str] = None
    hermes_wisdom_depth: Optional[int] = None
    hermes_reflection_verbosity: Optional[str] = None
    hermes_auto_reflection: Optional[bool] = None
    hermes_auto_update_enabled: Optional[bool] = None
    
    # [NEW] Multi-Hub Granular Control
    paperclip_provider: Optional[str] = None
    paperclip_model: Optional[str] = None
    openclaude_provider: Optional[str] = None
    openclaude_model: Optional[str] = None
    github_token: Optional[str] = None # [NEW]

class SettingsCreate(SettingsBase):
    pass

class SettingsUpdate(BaseModel):
    root_download_path: Optional[str] = None
    cookies_path: Optional[str] = None
    global_auto_download: Optional[bool] = None
    enable_trend_scheduling: Optional[bool] = None
    scan_interval_minutes: Optional[int] = None
    enable_view_stats_collection: Optional[bool] = None # [NEW]
    auto_hd_viral_threshold: Optional[float] = None
    auto_hd_velocity_threshold: Optional[float] = None
    
    # [NEW] ADB & Browser
    adb_default_serial: Optional[str] = None
    adb_connection_method: Optional[str] = "usb"
    chrome_path: Optional[str] = "/usr/bin/google-chrome"
    headless_mode: Optional[bool] = True
    ffmpeg_path: Optional[str] = None
    whisper_model_path: Optional[str] = None
    default_tts_engine: Optional[str] = None
    default_model_size: Optional[str] = None
    default_language: Optional[str] = None
    gemini_api_keys: Optional[List[str]] = None
    elevenlabs_api_keys: Optional[List[str]] = None
    typecast_api_keys: Optional[List[str]] = None
    groq_api_keys: Optional[List[str]] = None
    tavily_api_keys: Optional[List[str]] = None
    sambanova_api_keys: Optional[List[str]] = None
    cerebras_api_keys: Optional[List[str]] = None
    nvidia_api_keys: Optional[List[str]] = None   # [Added]
    opencode_api_keys: Optional[List[str]] = None # [OpenCode Zen]
    
    # [NEW] Phase 1: Media & Automation Keys
    pexels_api_keys: Optional[List[str]] = None
    pixabay_api_keys: Optional[List[str]] = None
    fal_api_keys: Optional[List[str]] = None
    replicate_api_keys: Optional[List[str]] = None
    muapi_api_keys: Optional[List[str]] = None
    n8n_base_url: Optional[str] = None
    supertone_project_key: Optional[str] = None
    kokoro_tts_url: Optional[str] = None
    
    # Supertonic (Local)
    supertone_local_enabled: Optional[bool] = None
    supertone_model_path: Optional[str] = None
    searxng_url: Optional[str] = None
    web_search_engine: Optional[str] = None
    openai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    kie_api_key: Optional[str] = None
    ytdlp_auto_update: Optional[bool] = None
    ytdlp_version: Optional[str] = None
    
    # Advanced Rate Limiting
    rate_limit_requests: Optional[int] = None
    rate_limit_window: Optional[int] = None
    circuit_breaker_threshold: Optional[int] = None
    
    script_analysis_provider: Optional[str] = None
    script_analysis_model: Optional[str] = None
    
    # Distributed AI Grid
    audio_node_url: Optional[str] = None
    audio_node_api_key: Optional[str] = None
    visual_node_url: Optional[str] = None
    visual_node_api_key: Optional[str] = None
    
    # [NEW] OpenClaw Integration
    openclaw_preferred_provider: Optional[str] = None
    openclaw_model: Optional[str] = None
    default_llm_model: Optional[str] = None

    hermes_agent_provider: Optional[str] = None
    hermes_agent_model: Optional[str] = None
    github_token: Optional[str] = None # [NEW]

class Settings(SettingsBase):
    id: int

    class Config:
        from_attributes = True

# [System Tab Schemas]
class RateLimitSettingsUpdate(BaseModel):
    mode: str
    enabled: Optional[bool] = True
    circuit_breaker_enabled: Optional[bool] = True
    enable_view_stats_collection: Optional[bool] = None # [NEW]
    # Advanced
    requests_per_minute: Optional[int] = None
    rate_limit_window: Optional[int] = None
    circuit_breaker_threshold: Optional[int] = None

class MaintenanceSettingsUpdate(BaseModel):
    auto_cleanup: bool
    cleanup_interval_days: int
    backup_enabled: bool

# Custom Link schemas
class CustomLinkBase(BaseModel):
    title: str
    url: str
    order_index: int = 0

class CustomLinkCreate(CustomLinkBase):
    pass

class CustomLinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    order_index: Optional[int] = None

class CustomLink(CustomLinkBase):
    id: int

    class Config:
        from_attributes = True

# Script Writer Schemas
class ScriptStyleBase(BaseModel):
    name: str
    system_instruction: str
    sample_text: Optional[str] = None

class ScriptStyleCreate(ScriptStyleBase):
    pass

class ScriptStyleUpdate(BaseModel):
    name: Optional[str] = None
    system_instruction: Optional[str] = None
    sample_text: Optional[str] = None

class ScriptStyle(ScriptStyleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ScriptGenerationRequest(BaseModel):
    input_text: str
    style_id: Optional[int] = None
    glossary: Optional[str] = None
    niche: Optional[str] = None
    wisdom: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    use_web_search: bool = False

class ScriptRefinementRequest(BaseModel):
    video_id: Optional[int] = None
    current_text: str
    instruction: str
    persona: Optional[str] = None
    style_id: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    tempo_percentage: Optional[int] = 100

class SafetyReviewRequest(BaseModel):
    current_text: str
    provider: Optional[str] = None
    model: Optional[str] = None

class SafetyChange(BaseModel):
    original: str
    replacement: str
    reason: str

class SafetyReviewResponse(BaseModel):
    revised_script: str
    changes: List[SafetyChange]

class ScriptRewriteRequest(BaseModel):
    video_id: Optional[int] = None
    original_script: str
    instruction: str
    provider: Optional[str] = None
    model: Optional[str] = None
    tempo_percentage: Optional[int] = 100

class ScriptGenerationResponse(BaseModel):
    script: str
    model_used: str
    warning: Optional[str] = None
    research_used: bool = False
    research_summary: Optional[str] = None
    research_sources: Optional[list] = None
    trend_used: bool = False
    trend_count: int = 0

class ScriptSaveRequest(BaseModel):
    video_id: int
    script_content: str

class GenesisPersistRequest(BaseModel):
    audio_path: Optional[str] = None
    srt_content: Optional[str] = None


# Style Preset Schemas
class StylePresetBase(BaseModel):
    name: str
    positive_prompt: str
    negative_prompt: Optional[str] = None

class StylePresetCreate(StylePresetBase):
    pass

class StylePresetUpdate(BaseModel):
    name: Optional[str] = None
    positive_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None

class StylePreset(StylePresetBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Config Preset Schemas
class ConfigPresetBase(BaseModel):
    type: str
    name: str
    config: dict

class ConfigPresetCreate(ConfigPresetBase):
    pass

class ConfigPreset(ConfigPresetBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Analysis Schemas
class VideoAnalysis(BaseModel):
    word_count: int
    char_count: int
    sentiment_label: str
    sentiment_score: float
    top_keywords: List[dict] # [{"text": "word", "value": 10}]
    engagement_graph: List[dict] # [{"name": "Jan", "value": 100}]

class ScriptAnalysisBase(BaseModel):
    viral_score: int
    summary_one_line: str
    summary_three_lines: str
    sentiment_score: float
    sentiment_label: str
    tone: Optional[str] = None
    keywords: Optional[List[str]] = []
    hooks: Optional[List[dict]] = []
    audience_reaction: Optional[dict] = None
    structure_breakdown: Optional[dict] = None
    script_content: Optional[str] = None

class ScriptAnalysisCreate(ScriptAnalysisBase):
    video_id: int

class ScriptAnalysis(ScriptAnalysisBase):
    id: int
    video_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Google Project Schemas
class GoogleProjectBase(BaseModel):
    project_name: str
    quota_limit: int = 10000
    worker_id: Optional[int] = None

class GoogleProjectCreate(GoogleProjectBase):
    client_secret_json: Any

class GoogleProject(GoogleProjectBase):
    id: int
    quota_used: int
    is_exhausted: bool
    is_suspended: bool
    last_reset: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Brand Channel Schemas
class BrandChannelBase(BaseModel):
    channel_id: str
    title: str
    thumbnail_url: Optional[str] = None
    worker_id: Optional[int] = None
    default_privacy: Optional[str] = "private"
    default_tags: Optional[str] = "[]"
    default_upload_delay_minutes: Optional[int] = 0
    
    # [NEW] Phase 2: Intelligence DNA
    reference_channel_id: Optional[int] = None
    style_signature: Optional[Dict[str, Any]] = None
    last_dna_sync: Optional[datetime] = None

class BrandChannelCreate(BrandChannelBase):
    access_token: str
    refresh_token: str
    token_expiry: datetime

class BrandChannelUpdate(BaseModel):
    default_privacy: Optional[str] = None
    # [NEW] Multi-Agent Strategic Intelligence
    growth_phase: Optional[str] = None
    trust_score: Optional[int] = None
    autonomy_status: Optional[str] = None
    default_tags: Optional[str] = None
    default_upload_delay_minutes: Optional[int] = None
    worker_id: Optional[int] = None
    
    # [NEW] Phase 2: Intelligence DNA
    reference_channel_id: Optional[int] = None
    style_signature: Optional[Dict[str, Any]] = None
    last_dna_sync: Optional[datetime] = None

class BrandChannel(BrandChannelBase):
    id: int
    created_at: datetime
    token_expiry: Optional[datetime] = None
    
    # [Incubator]
    growth_phase: Optional[str] = "NEW"
    warmup_stage: Optional[int] = 0
    warmup_last_run: Optional[datetime] = None
    warmup_status: Optional[str] = "IDLE"
    trust_score: Optional[int] = 0
    autonomy_status: Optional[str] = "MANUAL"

    class Config:
        from_attributes = True

# Batch Operations
class BatchOperationRequest(BaseModel):
    video_ids: List[int]

# Workflow Schemas
class WorkflowBase(BaseModel):
    title: str = "Untitled Workflow"
    description: Optional[str] = None
    graph_data: Optional[dict] = None
    is_active: bool = False

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    graph_data: Optional[dict] = None

class WorkflowResponse(WorkflowBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- [NEW] LLM Test Request ---
class LLMTestRequest(BaseModel):
    provider: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None

# Dashboard Schema
class DashboardStats(BaseModel):
    total_channels: int
    active_channels: int
    total_videos: int
    downloaded_today: int
    recent_videos: List[Video]
    recent_scripts: List[Video]

    class Config:
        from_attributes = True

# Profile Schema (New Architecture)
class ProfileBase(BaseModel):
    id: str
    profile_type: str
    usage_type: Optional[str] = "CONTENT_PRODUCTION"
    status: str
    folder_path: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    recovery_email: Optional[str] = None
    channel_id: Optional[str] = None
    created_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    tags: Optional[List[str]] = []
    
    # [NEW] Network Config
    proxy_mode: Optional[str] = "DIRECT"
    proxy_protocol: Optional[str] = "http"
    proxy_host: Optional[str] = None
    proxy_port: Optional[str] = None
    proxy_username: Optional[str] = None
    proxy_password: Optional[str] = None
    
    # [NEW] Engine config
    engine_type: Optional[str] = "cloakbrowser"
    
    class Config:
        from_attributes = True

class Profile(ProfileBase):
    pass

# Multi-Platform Account Schemas
class TikTokChannelCreate(BaseModel):
    id: str  # username/handle
    nickname: Optional[str] = None
    google_email: Optional[str] = None
    platform_username: Optional[str] = None
    cookies_json: Optional[str] = None
    follower_count: Optional[int] = 0

class TikTokChannelUpdate(BaseModel):
    nickname: Optional[str] = None
    status: Optional[str] = None
    cookies_json: Optional[str] = None
    platform_username: Optional[str] = None
    follower_count: Optional[int] = None

class TikTokChannel(BaseModel):
    id: str
    nickname: Optional[str] = None
    profile_id: str
    status: str
    last_uploaded_at: Optional[datetime] = None
    cookies_json: Optional[str] = None
    cookies_updated_at: Optional[datetime] = None
    google_email: Optional[str] = None
    platform_username: Optional[str] = None
    follower_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InstagramChannelCreate(BaseModel):
    id: str  # username
    nickname: Optional[str] = None
    google_email: Optional[str] = None
    platform_username: Optional[str] = None
    cookies_json: Optional[str] = None
    follower_count: Optional[int] = 0

class InstagramChannelUpdate(BaseModel):
    nickname: Optional[str] = None
    status: Optional[str] = None
    cookies_json: Optional[str] = None
    platform_username: Optional[str] = None
    follower_count: Optional[int] = None

class InstagramChannel(BaseModel):
    id: str
    nickname: Optional[str] = None
    profile_id: str
    status: str
    last_uploaded_at: Optional[datetime] = None
    cookies_json: Optional[str] = None
    cookies_updated_at: Optional[datetime] = None
    google_email: Optional[str] = None
    platform_username: Optional[str] = None
    follower_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Profile with Multi-Platform Accounts
class ProfileDetail(Profile):
    tiktok_channels: list[TikTokChannel] = []
    instagram_channels: list[InstagramChannel] = []
    brand_channels: list[BrandChannel] = []

    class Config:
        from_attributes = True

# --- [Phase 5: Industrial Management Schemas] ---

class ContainerStatus(BaseModel):
    name: str
    status: str # running, exited, paused
    image: str
    uptime: str
    cpu_usage: str
    mem_usage: str

class InfraStatusResponse(BaseModel):
    services: List[ContainerStatus]
    docker_available: bool
    error: Optional[str] = None

class HermesSettings(BaseModel):
    agent_provider: str = "google"
    agent_model: Optional[str] = None
    hermes_wisdom_depth: int = 3
    reflection_verbosity: str = "balanced" # low, balanced, high
    auto_reflection: bool = True
    auto_update_enabled: bool = True
    github_token: Optional[str] = None # [NEW]

class HermesUpdateResponse(BaseModel):
    status: str
    message: str
    version_info: Optional[str] = None

# [NEW] Agent Version Tracking Schemas
class AgentVersionInfo(BaseModel):
    local: str
    latest: str
    github_url: str
    homepage_url: Optional[str] = None

class AllAgentVersions(BaseModel):
    openclaw: AgentVersionInfo
    paperclip: AgentVersionInfo
    openclaude: AgentVersionInfo
    hermes: AgentVersionInfo

# [NEW] Pixeling Schemas
from .pixeling import PixelingDeepControlRequest, ProjectConfig, AssetConfig, ContentConfig, AudioControlConfig, VisualControlConfig
