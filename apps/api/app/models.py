from sqlalchemy import Boolean, Column, Integer, String, DateTime, Text, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime, timedelta
import os
import enum

class ProfileStatus(str, enum.Enum):
    DRAFT = "DRAFT"           # 생성 중
    ACTIVE = "ACTIVE"         # 정상 사용 가능
    SUSPENDED = "SUSPENDED"   # 정지됨
    COOLING = "COOLING"       # 쿨링 중 (휴식)
    QUARANTINED = "QUARANTINED" # [Quarantine] 90-day lock

class ChannelStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    QUARANTINED = "QUARANTINED"
    SUSPENDED = "SUSPENDED"
    AUTH_DROPPED = "AUTH_DROPPED"
    CAPTCHA_BLOCKED = "CAPTCHA_BLOCKED"

class StationStatus(str, enum.Enum):
    OFFLINE = "OFFLINE"
    STARTING = "STARTING"
    ONLINE = "ONLINE"
    ERROR = "ERROR"

class ChannelRole(str, enum.Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"

class ProfileType(str, enum.Enum):
    CAPTAIN = "CAPTAIN"
    TIN_CAN = "TIN_CAN"

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, index=True) # UUID
    name = Column(String, nullable=True) # [NEW] Brand Folder Name
    email = Column(String, unique=True, index=True, nullable=True)
    password = Column(String, nullable=True)
    recovery_email = Column(String, nullable=True)
    
    profile_type = Column(String, default=ProfileType.TIN_CAN)
    usage_type = Column(String, default="CONTENT_PRODUCTION")
    status = Column(String, default=ProfileStatus.DRAFT)
    
    # [Quarantine System]
    quarantine_start_date = Column(DateTime, nullable=True)
    quarantine_reason = Column(String, nullable=True)
    
    folder_path = Column(String) # Chrome User Data Path
    engine_type = Column(String, default="cloakbrowser")  # cloakbrowser | ixbrowser
    channel_id = Column(String, nullable=True) # [stealth] Managed Brand Channel ID
    created_at = Column(DateTime, default=datetime.now)
    last_used_at = Column(DateTime, nullable=True)
    
    proxy_info = Column(JSON, nullable=True) # LTE Binding Info
    
    # [NEW] Browser Farm Capabilities
    tags = Column(JSON, default=list) # ["upload", "image_gen", "whisk", "opal"]
    daily_gen_count = Column(Integer, default=0)
    last_gen_at = Column(DateTime, nullable=True)
    
    # [NEW] OAuth2 Authentication (TIN_CAN/Captain 공통)
    client_secret_json = Column(Text, nullable=True)  # Google OAuth2 client secret
    access_token = Column(String, nullable=True)       # YouTube API access token
    refresh_token = Column(String, nullable=True)      # YouTube API refresh token
    token_expiry = Column(DateTime, nullable=True)     # Token expiration time
    
    # [NEW] Google Cloud Project Information
    google_project_id = Column(String, nullable=True)      # e.g., "my-youtube-project-123"
    google_project_name = Column(String, nullable=True)    # e.g., "TinCan1 YouTube API"
    
    # [NEW] Multi-Proxy & Networking settings
    proxy_mode = Column(String, default="DIRECT") # DIRECT_LTE, NETSHARE, ISP_PROXY
    proxy_protocol = Column(String, default="http") # http, socks5
    proxy_host = Column(String, nullable=True)    # 127.0.0.1 or ISP Proxy IP
    proxy_port = Column(String, nullable=True)    # 8080 or ISP Proxy Port
    proxy_username = Column(String, nullable=True)
    proxy_password = Column(String, nullable=True)
class WorkerAccount(Base):
    __tablename__ = "worker_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    refresh_token = Column(Text, nullable=True)

class BrandChannel(Base):
    __tablename__ = "brand_channels"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, unique=True, index=True)
    title = Column(String)
    thumbnail_url = Column(String)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    account_email = Column(String, nullable=True) # [STABILIZATION] Added for dashboard compatibility

    # [NEW] Lifecycle & Security Control
    is_autonomous_enabled = Column(Boolean, default=False) # [NEW] Manual vs Autonomous
    
    # [Incubator] Warmup Progress Tracking
    warmup_stage = Column(Integer, default=0) # 0: New, 1: Day1, 2: Day2, ...
    warmup_last_run = Column(DateTime, nullable=True)
    warmup_status = Column(String, default="IDLE") # IDLE, RUNNING, COMPLETED, FAILED
    
    # [NEW] Channel Stats (Captain Dashboard)
    subscriber_count = Column(Integer, default=0)
    video_count = Column(Integer, default=0)
    revenue_text = Column(String, default="N/A") # e.g. "$1,200" or "₩150,000"
    last_synced_at = Column(DateTime, nullable=True)
    
    # New Architecture Links
    owner_profile_id = Column(String, ForeignKey("profiles.id"), nullable=True) # [New] Link to Profile (UUID)
    
    owner_profile = relationship("Profile", backref="brand_channels") # Use brand_channels to avoid conflict if any

    # [NEW] Phase 4: Pro-Grade Features
    incubation_day_count = Column(Integer, default=0) # Track D-Day
    default_upload_delay_minutes = Column(Integer, default=0)
    
    # [NEW] Multi-Agent Strategic Intelligence
    is_active = Column(Boolean, default=True)
    reference_channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True) # Linked reference channel for DNA
    style_signature = Column(JSON, nullable=True) # { pacing, tone, hooks, visual_prompt, keywords }
    last_dna_sync = Column(DateTime, nullable=True)
    growth_phase = Column(String, default="NEW") # [NEW] NEW, INCUBATING, REFINING, SCALED
    
    # [NEW] Sovereign Automata v6.0
    trust_score = Column(Integer, default=0) # 0-100: Manual to Autonomous transition
    autonomy_status = Column(String, default="MANUAL") # MANUAL, SEMI_AUTO, SOVEREIGN

    # [NEW] Identity DNA (Sovereign Swarm Evolution)
    expert_identity = Column(JSON, nullable=True) # Persistent guidelines { tone, strategy, success_criteria }
    identity_version = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.now)

class MissionExperience(Base):
    """
    [HERMES-INTEGRITY] Persistent memory of agent missions.
    Stores successes, failures, and LLM-extracted 'Wisdom' for the Collective Intelligence.
    """
    __tablename__ = "mission_experience"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True) # Linked to AgentSwarmSession if needed
    niche = Column(String, index=True)
    topic = Column(String)
    success = Column(Boolean, default=False)
    
    # LLM Analysis Results
    bottleneck = Column(Text, nullable=True)
    learnings = Column(Text, nullable=True) # Strategy extraction
    summary = Column(String, nullable=True)
    
    # Metadata
    artifacts_json = Column(JSON, nullable=True)
    embedding = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    def __repr__(self):
        return f"<MissionExperience(topic='{self.topic}', success={self.success})>"

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String, unique=True, index=True)
    platform = Column(String)
    platform_id = Column(String, index=True, nullable=True) # [NEW] External ID (e.g. UC...)
    folder_name = Column(String)
    status = Column(String, default="active")

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_scanned_at = Column(DateTime, nullable=True) # [NEW] Track scan time
    auto_download = Column(Boolean, default=False)
    default_script_only = Column(Boolean, default=False) # [NEW] Script Only Mode
    thumbnail_path = Column(String, nullable=True)
    
    subscriber_count = Column(Integer, default=0) # For Viral Calc
    
    # [NEW] Error Tracking
    fail_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    
    worker_id = Column(Integer, nullable=True) # [Legacy Support]
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True) # [NEW]
    
    category = relationship("Category") # [NEW]
    
    # If channel is deleted, delete all videos (Cascade)
    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True)
    video_id = Column(String, unique=True, index=True)
    url = Column(String)
    file_path = Column(String)
    thumbnail_path = Column(String)
    upload_date = Column(DateTime)
    downloaded_at = Column(DateTime, default=datetime.now)
    status = Column(String, default="completed") # completed, failed, downloading
    description = Column(Text, nullable=True)
    view_count = Column(Integer, default=0)
    duration = Column(Integer, default=0)
    metadata_json = Column(JSON, nullable=True)
    file_missing = Column(Boolean, default=False)
    
    # Metrics
    viral_score = Column(Float, default=0.0) 
    velocity_score = Column(Float, default=0.0)
    is_script_only = Column(Boolean, default=False) # [NEW] Script Only Flag
    priority_level = Column(Integer, default=0) # [NEW] Phase 4: 0=Normal, 1=High
    
    viewed_at = Column(DateTime, nullable=True)
    failure_reason = Column(String, nullable=True)
    
    # [NEW] Distribution Status
    upload_status = Column(String, nullable=True) # PENDING, UPLOADING, COMPLETED, FAILED, WAITING_FOR_MOBILE
    privacy_status = Column(String, nullable=True) # public, private, unlisted
    uploaded_video_id = Column(String, nullable=True) # [NEW] YouTube ID of uploaded video
    
    workflow_mode = Column(String, default="AUTO_FULL") # [Legacy Support]

    channel = relationship("Channel", back_populates="videos")
    script_analysis = relationship("ScriptAnalysis", back_populates="video", uselist=False, cascade="all, delete-orphan")
    history = relationship("VideoHistory", back_populates="video", cascade="all, delete-orphan")

class VideoHistory(Base):
    """Tracks view count over time for graph"""
    __tablename__ = "video_history"
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"))
    view_count = Column(Integer)
    timestamp = Column(DateTime, default=datetime.now)
    
    video = relationship("Video", back_populates="history")


class WorkQueueItem(Base):
    """작업 대기열 항목 - 모든 영상 업로드의 중앙 관문"""
    __tablename__ = "work_queue_items"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # === 영상 정보 ===
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    hashtags = Column(JSON, nullable=True)  # [NEW] Visible Hashtags (for description)
    tags = Column(JSON, nullable=True)      # Hidden Tags (metadata)
    thumbnail_path = Column(String, nullable=True)
    video_file_path = Column(String, nullable=True)  # [DRAFT support] nullable for temp/draft items
    duration = Column(Integer, nullable=True)
    
    # === 쇼핑 태그 (Shopping Tag) ===
    enable_shopping_tag = Column(Boolean, default=False)
    shopping_tag_keyword = Column(String, nullable=True)
    
    # === 유입 경로 추적 ===
    source_type = Column(String, nullable=True)  # MANUAL, WORKFLOW, SCRIPT_REMIX, GALLERY_EXPORT, SOVEREIGN_AI, BULK_IMPORT
    source_workflow_id = Column(Integer, nullable=True)
    source_metadata = Column(JSON, nullable=True)  # store external_id, batch_id, original_file info
    source_batch_id = Column(String, nullable=True)  # BULK_IMPORT batch identifier (UUID)
    source_external_id = Column(String, nullable=True, index=True)  # 각 아이템별 외부 시스템 고유 식별값 (JSON/Excel 매핑용)
    
    # === 품질 검증 ===
    approval_status = Column(String, default="PENDING")
    approval_required = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)
    quality_score = Column(Float, nullable=True)
    quality_checks = Column(JSON, nullable=True)
    
    # === 업로드 설정 ===
    upload_method = Column(String, nullable=True)  # API, BROWSER_AUTO, MANUAL
    upload_priority = Column(Integer, default=0)
    
    # === 플랫폼 배포 설정 ===
    target_platforms = Column(JSON, nullable=True)
    platform_configs = Column(JSON, nullable=True)
    
    # === 스케줄링 ===
    scheduled_upload_time = Column(DateTime, nullable=True)
    upload_delay_minutes = Column(Integer, default=0)
    
    # === 상태 추적 ===
    status = Column(String, default="DRAFT")  # DRAFT -> PENDING -> QUEUED -> UPLOADING -> VERIFYING -> COMPLETED | FAILED
    upload_started_at = Column(DateTime, nullable=True)
    upload_completed_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True) # [NEW] Final publish or schedule time
    upload_progress = Column(Integer, default=0)
    
    # === 결과 ===
    uploaded_urls = Column(JSON, nullable=True)
    failure_reason = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # === 메타데이터 ===
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    created_by = Column(String, nullable=True)
    
    # === 관계 ===
    video = relationship("Video", backref="queue_items")


class UploadRule(Base):
    """업로드 규칙 엔진 - 조건 기반 자동 설정"""
    __tablename__ = "upload_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    conditions = Column(JSON, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    is_rising_star = Column(Boolean, default=False)
    is_ai_estimated = Column(Boolean, default=True) # [NEW] API vs AI Estimation toggle
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    root_download_path = Column(String, default="")
    cookies_path = Column(String, nullable=True)
    
    # [UPDATED] Multi-Key Support (Stored as JSON List)
    gemini_api_keys = Column(JSON, default=list)        # Google
    elevenlabs_api_keys = Column(JSON, default=list)    # ElevenLabs
    typecast_api_keys = Column(JSON, default=list)      # Typecast
    groq_api_keys = Column(JSON, default=list)          # Groq
    tavily_api_keys = Column(JSON, default=list)        # Tavily
    sambanova_api_keys = Column(JSON, default=list)     # SambaNova
    cerebras_api_keys = Column(JSON, default=list)      # Cerebras
    openrouter_api_keys = Column(JSON, default=list)    # OpenRouter
    nvidia_api_keys = Column(JSON, default=list)        # NVIDIA (Added)
    opencode_api_keys = Column(JSON, default=list)      # OpenCode Zen
    youtube1_api_keys = Column(JSON, default=list)      # YouTube1 (Custom OpenAI-compatible)
    
    # [NEW] Media & Automation Keys
    pexels_api_keys = Column(JSON, default=list)       # Pexels
    pixabay_api_keys = Column(JSON, default=list)      # Pixabay
    fal_api_keys = Column(JSON, default=list)          # fal.ai
    replicate_api_keys = Column(JSON, default=list)    # Replicate
    muapi_api_keys = Column(JSON, default=list)        # Higgsfield / AI Gen
    fal_api_key = Column(String, nullable=True)        # [Legacy Support]
    n8n_base_url = Column(String, default="http://localhost:5678")
    
    # Single Key (Project based)
    supertone_project_key = Column(String, nullable=True) 
    supertone_local_enabled = Column(Boolean, default=False) # [NEW]

    # [NEW] Jina Reader Settings
    jina_reader_endpoint = Column(String, default="http://localhost:20128/v1/web/fetch")
    jina_reader_api_keys = Column(JSON, default=list)

    supertone_model_path = Column(String, default="")
    
    # URLs
    kokoro_tts_url = Column(String, default="https://tts1.gogloo.gleeze.com")
    qwen_tts_url = Column(String, default="https://miscultivated-nonvertically-londa.ngrok-free.dev") # [NEW]
    searxng_url = Column(String, default="https://search.gogloo.gleeze.com/search") # [NEW]
    web_search_engine = Column(String, default="searxng_first") # [NEW] Strategy: searxng_first, tavily_first, searxng_only, tavily_only
    
    # [NEW] Ollama Local Inference
    ollama_api_base_url = Column(String, default="http://127.0.0.1:11434/v1")
    
    # [NEW] iXBrowser
    ixbrowser_api_url = Column(String, default="http://127.0.0.1:4320")
    
    # [NEW] OpenClaw Integration
    openclaw_preferred_provider = Column(String, default="auto")
    openclaw_model = Column(String, nullable=True)
    default_llm_model = Column(String, default="gemini-2.0-flash-exp")
    
    # [NEW] Multi-Hub Granular Control
    paperclip_provider = Column(String, default="google")
    paperclip_model = Column(String, nullable=True)
    openclaude_provider = Column(String, default="google")
    openclaude_model = Column(String, nullable=True)
    
    # Global Configs
    global_auto_download = Column(Boolean, default=True)
    enable_trend_scheduling = Column(Boolean, default=True) # [NEW] Scheduler Toggle
    scan_interval_minutes = Column(Integer, default=60)
    enable_view_stats_collection = Column(Boolean, default=True) # [NEW] Prevent IP block if needed
    auto_delete_mp4_days = Column(Integer, default=7) # [NEW] Delete MP4 files after X days (0 = disabled)
    
    # [NEW] Auto HD Download Thresholds
    auto_hd_viral_threshold = Column(Float, nullable=True)
    auto_hd_velocity_threshold = Column(Float, nullable=True)
    
    # [NEW] Outlier Pre-filtering Thresholds
    outlier_ev_threshold = Column(Float, default=120.0) # For Shorts EV%
    outlier_ratio_threshold = Column(Float, default=1.5) # For Longs Ratio (views/subs)

    default_tts_engine = Column(String, default="google")
    ytdlp_auto_update = Column(Boolean, default=True)
    ytdlp_version = Column(String, nullable=True)
    ytdlp_last_check = Column(DateTime, nullable=True)
    
    # Advanced Rate Limiting
    rate_limit_requests = Column(Integer, default=30)
    rate_limit_window = Column(Integer, default=60)
    circuit_breaker_threshold = Column(Integer, default=5)
    
    # Defaults
    default_model_size = Column(String, default="base")
    default_language = Column(String, default="ko")
    whisper_model_path = Column(String, default="")
    ffmpeg_path = Column(String, nullable=True)
    
    # [NEW] ADB & Browser Configuration
    adb_default_serial = Column(String, nullable=True)
    adb_connection_method = Column(String, default="usb") # usb, wireless
    chrome_path = Column(String, default="/usr/bin/google-chrome")
    headless_mode = Column(Boolean, default=True)
    
    # Legacy fields (Optional)
    openai_api_key = Column(String, nullable=True)
    openrouter_api_key = Column(String, nullable=True)
    groq_api_key = Column(String, nullable=True)
    kie_api_key = Column(String, nullable=True)
    default_model = Column(String, nullable=True)
    script_analysis_provider = Column(String, default="opencode")
    script_analysis_model = Column(String, default="opencode/deepseek-v4-flash-free")

    # [Phase 5: Sovereign Hermes Intelligence]
    hermes_agent_provider = Column(String, default="nvidia")
    hermes_agent_model = Column(String, nullable=True)
    hermes_wisdom_depth = Column(Integer, default=3)
    hermes_reflection_verbosity = Column(String, default="balanced")
    hermes_auto_reflection = Column(Boolean, default=True)
    hermes_auto_update_enabled = Column(Boolean, default=True)
    github_token = Column(String, nullable=True) # [NEW] GitHub Personal Access Token for Updates
    
    # [NEW] Model Caching
    model_cache = Column(JSON, nullable=True)
    model_cache_updated_at = Column(DateTime, nullable=True)


    # [NEW] Multi-Proxy Routing Settings
    proxy_mode = Column(String, default="DIRECT_LTE") # DIRECT_LTE, NETSHARE, ISP_PROXY
    netshare_ip = Column(String, default="192.168.49.1")
    netshare_port = Column(Integer, default=8282)
    isp_proxy_url = Column(String, nullable=True) # e.g. socks5://user:pass@ip:port

    # Distributed AI Grid
    audio_node_url = Column(String, default="https://miscultivated-nonvertically-londa.ngrok-free.dev")
    audio_node_api_key = Column(String, nullable=True)
    visual_node_url = Column(String, default="https://unstalled-eustyle-chet.ngrok-free.dev")
    visual_node_api_key = Column(String, nullable=True)

class StrategicBrief(Base):
    """
    [SOVEREIGN INTELLIGENCE] Autonomous Strategic Documents.
    Stores recursive intelligence reports, market forecasts, and tactical briefs.
    """
    __tablename__ = "strategic_briefs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    niche = Column(String, index=True)
    
    # Content Layers
    summary = Column(String)
    content_markdown = Column(Text)
    strategic_recommendations = Column(JSON) # List of actionable steps
    
    # Recursive Intelligence Tracking
    version = Column(Integer, default=1)
    status = Column(String, default="EVOLVING") # DRAFT, EVOLVING, FINALIZED, SUPERSEDED
    
    # Hierarchy
    parent_brief_id = Column(Integer, ForeignKey("strategic_briefs.id"), nullable=True)
    
    # Metadata
    source_candidates_json = Column(JSON) # List of candidate IDs used for analysis
    raw_intelligence_json = Column(JSON) # Detailed AI findings
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    parent_brief = relationship("StrategicBrief", remote_side=[id], backref="derived_briefs")


class ScoutCandidate(Base):
    __tablename__ = "scout_candidates"

    id = Column(Integer, primary_key=True, index=True)
    channel_url = Column(String, unique=True, index=True)
    channel_name = Column(String)
    niche = Column(String, nullable=True)

    # Intelligence Metrics
    viral_potential_score = Column(Float, default=0.0)
    total_sovereign_score = Column(Float, default=0.0)
    subscriber_growth_7d = Column(Float, default=0.0)
    quality_score = Column(Integer, default=0)
    engagement_score = Column(Integer, default=0)
    recreatability_score = Column(Integer, default=0)

    is_rising_star = Column(Boolean, default=False)
    is_ai_estimated = Column(Boolean, default=True)

    ai_reasoning = Column(Text, nullable=True)
    status = Column(String, default="PENDING")

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class SovereignInterest(Base):
    """사용자가 직접 입력하여 관리하는 핵심 관심 분야 (경제, 역사, 정치 등)"""
    __tablename__ = "sovereign_interests"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

class CustomLink(Base):
    __tablename__ = "custom_links"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    url = Column(String)
    order_index = Column(Integer, default=0)

class ScriptStyle(Base):
    __tablename__ = "script_styles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    system_instruction = Column(String) 
    sample_text = Column(String, nullable=True) 
    created_at = Column(DateTime, default=datetime.utcnow)

class ScriptAnalysis(Base):
    __tablename__ = "script_analyses"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), unique=True, index=True)
    
    # Analysis Data
    viral_score = Column(Integer) # 0-100
    summary_one_line = Column(Text)
    summary_three_lines = Column(Text)
    sentiment_score = Column(Float) # -1.0 to 1.0
    sentiment_label = Column(String) # Positive, Neutral, Negative
    tone = Column(String) # e.g. "Urgent", "Humorous"
    script_content = Column(Text, nullable=True)
    
    # JSON Fields
    keywords = Column(JSON) # ["key1", "key2"]
    hooks = Column(JSON) # [{"text": "...", "type": "visual"}, ...]
    audience_reaction = Column(JSON) # Predicted reaction or analysis of comments
    structure_breakdown = Column(JSON) # {"intro": ..., "body": ..., "conclusion": ...}
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    video = relationship("Video", back_populates="script_analysis")

class StylePreset(Base):
    __tablename__ = "style_presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    positive_prompt = Column(String)
    negative_prompt = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ConfigPreset(Base):
    __tablename__ = "config_presets"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) 
    name = Column(String)
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)



# [NEW] Daily Report System
class DailyReport(Base):
    __tablename__ = "daily_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, default=datetime.now) # Date of report
    
    # Content
    summary_markdown = Column(Text) # The LLM generated report
    raw_stats_json = Column(JSON) # { "videos_dl": 10, "scripts_dl": 5, "errors": 2 ... }
    
    # [NEW] Auto-Fix Logs
    auto_fix_log = Column(JSON, default=list) # [{"timestamp": "...", "message": "..."}]
    
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


# ============================================
# NEW SCHEMA: YouTube Channel Management System
# ============================================

class YouTubeChannel(Base):
    """YouTube 브랜드 채널 정보 (단일 레코드)"""
    __tablename__ = "youtube_channels"
    
    channel_id = Column(String(50), primary_key=True)  # UCxxxxxxxxxx
    channel_name = Column(String(255))
    channel_handle = Column(String(100))  # @channelname
    thumbnail_url = Column(String(500))
    
    # 상태 관리
    status = Column(String(20), default=ChannelStatus.ACTIVE)
    auth_status = Column(String(20), default="PENDING") # PENDING, COMPLETED, FAILED
    quarantine_reason = Column(Text, nullable=True)
    quarantine_until = Column(DateTime, nullable=True)
    
    # [Incubator] Warmup Progress Tracking
    warmup_stage = Column(Integer, default=0) 
    warmup_status = Column(String(20), default="IDLE") # IDLE, RUNNING, COMPLETED, FAILED, PAUSED
    warmup_last_run = Column(DateTime, nullable=True)
    warmup_started_at = Column(DateTime, nullable=True)  # First warmup start time
    warmup_completed_at = Column(DateTime, nullable=True)  # Completion time
    warmup_total_duration = Column(Integer, default=0)  # Total seconds spent
    warmup_error_count = Column(Integer, default=0)  # Error count
    warmup_last_error = Column(Text, nullable=True)  # Last error message
    warmup_config = Column(JSON, nullable=True)  # Custom settings
    
    # [Cultivation] Strategic Scheduler
    cultivation_strategy = Column(String(50), nullable=True) # INITIAL, NICHE_PIVOT, TRAFFIC_HIJACK, DEATH_VALLEY
    cultivation_day = Column(Integer, default=0)
    cultivation_active = Column(Boolean, default=False)
    
    # 프로필 관리
    dedicated_profile_path = Column(String(500), nullable=True)
    
    # IP 추적
    last_used_ip = Column(String(50), nullable=True)
    last_accessed_at = Column(DateTime, nullable=True)
    
    # 메타데이터
    subscriber_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    video_count = Column(Integer, default=0)
    estimated_revenue = Column(Float, default=0.0)
    is_auto_discovered = Column(Boolean, default=False)
    
    # [SAIF] Security & Stealth Control
    engine_mode = Column(String(20), default="standard") # standard, cloak, fox
    stealth_trust_score = Column(Integer, default=0)    # 0-100 from Sentinel Audit
    last_audit_at = Column(DateTime, nullable=True)
    is_network_isolated = Column(Boolean, default=False) # Phase 1 Success flag
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Cache management
    metadata_updated_at = Column(DateTime, nullable=True)  # Last metadata refresh from YouTube API
    
    # Relationships
    accesses = relationship("ChannelAccess", back_populates="youtube_channel", cascade="all, delete-orphan")
    access_logs = relationship("ChannelAccessLog", back_populates="youtube_channel", cascade="all, delete-orphan")
    analytics = relationship("ChannelAnalytics", back_populates="channel", cascade="all, delete-orphan")

class ChannelAccess(Base):
    """채널-프로필 관계 (다대다)"""
    __tablename__ = "channel_access"
    
    id = Column(String(50), primary_key=True)
    channel_id = Column(String(50), ForeignKey("youtube_channels.channel_id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(String(50), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # OWNER, MANAGER
    
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    youtube_channel = relationship(YouTubeChannel, back_populates="accesses")
    profile = relationship("Profile", backref="youtube_channel_access")


class ChannelAccessLog(Base):
    """채널 접근 로그"""
    __tablename__ = "channel_access_logs"
    
    id = Column(String(50), primary_key=True)
    channel_id = Column(String(50), ForeignKey("youtube_channels.channel_id"), nullable=False)
    profile_id = Column(String(50), ForeignKey("profiles.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "login", "upload", "comment", etc.
    timestamp = Column(DateTime, default=datetime.now)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    youtube_channel = relationship(YouTubeChannel, back_populates="access_logs")
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    profile = relationship("Profile", backref="youtube_access_logs")


# [NEW] Channel Analytics Cache Model
class ChannelAnalytics(Base):
    """YouTube Analytics API 데이터 캐시"""
    __tablename__ = "channel_analytics"
    
    id = Column(String, primary_key=True)  # UUID
    channel_id = Column(String, ForeignKey("youtube_channels.channel_id"), nullable=False)
    
    # 기본 통계
    subscriber_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    video_count = Column(Integer, default=0)
    
    # 수익 정보 (USD)
    estimated_revenue = Column(Float, default=0.0)  # 추정 수익
    ad_impressions = Column(Integer, default=0)     # 광고 노출 수
    cpm = Column(Float, default=0.0)                # Cost Per Mille
    
    # 참여도 메트릭
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    watch_time_minutes = Column(Integer, default=0)  # 총 시청 시간 (분)
    
    # 구독자 증감
    subscribers_gained = Column(Integer, default=0)
    subscribers_lost = Column(Integer, default=0)
    
    # 건강 상태
    health_score = Column(Integer, default=100)     # 0-100 점수
    can_upload = Column(Boolean, default=True)      # 업로드 가능 여부
    is_monetized = Column(Boolean, default=False)   # 수익 창출 활성화 여부
    
    # 기간 정보
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    last_updated = Column(DateTime, default=datetime.now)
    
    # Relationship
    channel = relationship(YouTubeChannel, back_populates="analytics")


# ============================================
# NEW: Data Caching Models for Captain Dashboard
# ============================================

class ChannelDailyStats(Base):
    """일일 채널 통계 캐시 (YouTube Data API + yt-dlp 집계)"""
    __tablename__ = "channel_daily_stats"
    
    id = Column(String, primary_key=True)  # UUID
    channel_id = Column(String, ForeignKey("youtube_channels.channel_id"), nullable=False)
    stat_date = Column(DateTime, nullable=False)  # 통계 날짜 (Date only, time=00:00:00)
    
    # YouTube Data API 데이터
    subscriber_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    video_count = Column(Integer, default=0)
    
    # yt-dlp 집계 데이터
    total_likes = Column(Integer, default=0)
    total_comments = Column(Integer, default=0)
    avg_engagement_rate = Column(Float, default=0.0)
    
    # 계산된 메트릭 (전일 대비 증감)
    daily_view_increase = Column(Integer, default=0)
    daily_subscriber_increase = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationship
    channel = relationship(YouTubeChannel, backref="daily_stats")


class VideoMetadataCache(Base):
    """yt-dlp 메타데이터 캐시 (영상별 상세 정보)"""
    __tablename__ = "video_metadata_cache"
    
    video_id = Column(String, primary_key=True)  # YouTube video ID
    channel_id = Column(String, ForeignKey("youtube_channels.channel_id"), nullable=False)
    
    # 기본 정보
    title = Column(String)
    upload_date = Column(DateTime)
    duration = Column(Integer)  # seconds
    thumbnail_url = Column(String)
    
    # 성과 메트릭 (yt-dlp에서 수집)
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    
    # yt-dlp 전용 데이터
    heatmap_json = Column(JSON)  # Retention/engagement heatmap
    tags = Column(JSON)  # List of tags
    categories = Column(JSON)  # List of categories
    
    # 캐시 관리
    last_updated = Column(DateTime, default=datetime.now)
    update_frequency = Column(String, default="daily")  # daily, weekly, never
    
    # Relationship
    channel = relationship("YouTubeChannel", backref="video_cache")


class WarmupLog(Base):
    """Warmup 활동 로그 (상세 추적)"""
    __tablename__ = "warmup_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_id = Column(String(50), ForeignKey("youtube_channels.channel_id", ondelete="CASCADE"), nullable=False)
    stage = Column(Integer, nullable=False)  # 1-7
    action = Column(String(50), nullable=False)  # "watch_video", "search", "like", "comment", "subscribe", "watch_short"
    details = Column(JSON)  # {"video_id": "...", "duration": 120, "search_term": "...", etc.}
    status = Column(String(20), nullable=False)  # "success", "failed", "skipped"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # Use backref instead of back_populates (simpler, auto-creates reverse relationship)
    channel = relationship("YouTubeChannel", backref="warmup_logs")


# ============================================
# NEW SCHEMA: Professional Station Management
# ============================================

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g. "Lofi HipHop Radio"
    description = Column(String, nullable=True)
    
    # Connection Info
    rtmp_url = Column(String) # rtmp://a.rtmp.youtube.com/live2/key
    # Optional: We might map this to a specific `BrandChannel` later, but for now raw URL is flexible.
    
    # Configuration
    current_playlist_id = Column(Integer, ForeignKey("station_playlists.id"), nullable=True)
    background_video_path = Column(String, nullable=True) # Looping background
    layout_config = Column(JSON, nullable=True) # [NEW] Stores full Studio Design JSON
    thumbnail_path = Column(String, nullable=True) #[NEW]
    server_mode = Column(String, default="local") # [NEW] local | external
    
    # State
    status = Column(String, default=StationStatus.OFFLINE)
    pid = Column(Integer, nullable=True) # Process ID if running locally
    last_error = Column(Text, nullable=True)
    
    # Meta
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    playlist = relationship("StationPlaylist", foreign_keys=[current_playlist_id])
    schedules = relationship("StationSchedule", back_populates="station", cascade="all, delete-orphan")


class StationPlaylist(Base):
    __tablename__ = "station_playlists"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    name = Column(String) # e.g. "Morning Jazz"
    
    # Content: List of {path, weight, title, duration}
    # JSON is used for flexibility (Ordering, Weights, disabled status)
    tracks_json = Column(JSON, default=list) 
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class StationSchedule(Base):
    """Time-based rules for Auto-DJ"""
    __tablename__ = "station_schedules"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    playlist_id = Column(Integer, ForeignKey("station_playlists.id"))
    
    # Time Rules
    name = Column(String) # e.g. "Morning Vibes"
    cron_expression = Column(String) # "0 6 * * *"
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    
    station = relationship("Station", back_populates="schedules")
    playlist = relationship("StationPlaylist")

# ============================================
# NEW SCHEMA: Multi-Platform Account Management
# ============================================

class BrowserProfile(Base):
    """
    Common Chrome User Data Profile shared across platforms.
    Acts as a 'Persona' (e.g., 'Gaming Brand', 'Personal').
    """
    __tablename__ = "browser_profiles"

    id = Column(String, primary_key=True) # UUID
    name = Column(String) # e.g. "Gaming Brand"
    user_data_dir = Column(String) # Path: userdata/profiles/{uuid}
    user_agent = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    daily_gen_count = Column(Integer, default=0)
    last_gen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # [NEW] Folder-based Brand UI Integration
    parent_brand_id = Column(String, ForeignKey("profiles.id"), nullable=True)
    parent_brand = relationship("Profile", backref="social_profiles")
    
    # Relationships
    tiktok_channels = relationship("TikTokChannel", back_populates="browser_profile", cascade="all, delete-orphan")
    instagram_channels = relationship("InstagramChannel", back_populates="browser_profile", cascade="all, delete-orphan")
    notebooklm_accounts = relationship("NotebookLMAccount", back_populates="browser_profile", cascade="all, delete-orphan")
    douyin_channels = relationship("DouyinChannel", back_populates="browser_profile", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    name_en = Column(String, nullable=True)
    folder_name = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    level = Column(Integer, default=0)
    is_fixed = Column(Boolean, default=False)
    ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class TikTokChannel(Base):
    """TikTok Account linked to a Browser Profile"""
    __tablename__ = "tiktok_channels"

    id = Column(String, primary_key=True) # Username/Handle (unique)
    nickname = Column(String, nullable=True)
    browser_profile_id = Column(String, ForeignKey("browser_profiles.id"))
    
    status = Column(String, default="ACTIVE") # ACTIVE, SUSPENDED, LOGIN_REQUIRED
    last_uploaded_at = Column(DateTime, nullable=True)
    
    # Metadata
    follower_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    browser_profile = relationship("BrowserProfile", back_populates="tiktok_channels")


class InstagramChannel(Base):
    """Instagram Account linked to a Browser Profile"""
    __tablename__ = "instagram_channels"

    id = Column(String, primary_key=True) # Username (unique)
    nickname = Column(String, nullable=True)
    browser_profile_id = Column(String, ForeignKey("browser_profiles.id"))
    
    status = Column(String, default="ACTIVE")
    last_uploaded_at = Column(DateTime, nullable=True)
    
    # Metadata
    follower_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    browser_profile = relationship("BrowserProfile", back_populates="instagram_channels")


class DouyinChannel(Base):
    """Douyin Account linked to a Browser Profile"""
    __tablename__ = "douyin_channels"

    id = Column(String, primary_key=True) # Username (unique)
    nickname = Column(String, nullable=True)
    browser_profile_id = Column(String, ForeignKey("browser_profiles.id"))
    
    status = Column(String, default="ACTIVE")
    last_uploaded_at = Column(DateTime, nullable=True)
    
    # Metadata
    follower_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    browser_profile = relationship("BrowserProfile", back_populates="douyin_channels")


class NotebookLMAccount(Base):
    """NotebookLM Account linked to a Browser Profile (Google Account)"""
    __tablename__ = "notebooklm_accounts"

    id = Column(String, primary_key=True) # Email or unique nickname
    browser_profile_id = Column(String, ForeignKey("browser_profiles.id"))
    
    status = Column(String, default="ACTIVE")
    last_sync_at = Column(DateTime, nullable=True)
    
    # NotebookLM specific metadata
    notebook_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    browser_profile = relationship("BrowserProfile", back_populates="notebooklm_accounts")


# ============================================
# NEW SCHEMA: OpenClaw Agent Swarm Management
# ============================================

class AgentSwarmSession(Base):
    """에이전트 생산 세션 정보"""
    __tablename__ = "agent_swarm_sessions"
    
    id = Column(String, primary_key=True, index=True) # Session UUID
    topic = Column(String, index=True)               # 제작 주제 (키워드)
    status = Column(String, default="INITIALIZING") # INITIALIZING, RESEARCHING, PLANNING, PRODUCING, COMPLETED, FAILED
    
    # 설정 정보 (JSON)
    config_json = Column(JSON, nullable=True)        # { model: "gpt-4o", aspect_ratio: "9:16", ... }
    
    # 결과물 정보
    output_video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    out_file_path = Column(String, nullable=True)
    
    # 시간 정보
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    completed_at = Column(DateTime, nullable=True)
    
    # 관계
    logs = relationship("AgentLog", back_populates="session", cascade="all, delete-orphan")

class AgentLog(Base):
    """에이전트 상세 활동 로그"""
    __tablename__ = "agent_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("agent_swarm_sessions.id", ondelete="CASCADE"), nullable=False)
    
    level = Column(String, default="INFO")           # INFO, WARNING, ERROR, SUCCESS
    step = Column(String, nullable=True)             # RESEARCH, SCRIPT, ASSET, RENDER
    message = Column(Text, nullable=False)           # 로그 메시지
    data_json = Column(JSON, nullable=True)          # 부가 데이터 (API 응답 등)
    
    timestamp = Column(DateTime, default=datetime.now)
    
    # 관계
    session = relationship("AgentSwarmSession", back_populates="logs")

class GlobalSwarmConfig(Base):
    """중앙 스웜 관제 정보 (전역 설정)"""
    __tablename__ = "global_swarm_config"
    
    id = Column(Integer, primary_key=True)
    max_concurrent_missions = Column(Integer, default=5)
    priority_mode = Column(String, default="PERFORMANCE") # PERFORMANCE, EQUALITY, BALANCED
    swarm_mode = Column(String, default="ADAPTIVE") # [NEW] AUTONOMOUS, CONFIRMATION, EXPERT, ADAPTIVE
    global_kill_switch = Column(Boolean, default=False)
    
    last_automated_run = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    category_id = Column(Integer, ForeignKey("category_tree.id"), nullable=True)
    
    # [NEW] Sovereign Scoring Metrics
    subscriber_growth_7d = Column(Float, default=0.0) # 7-day growth rate
    quality_score = Column(Integer, default=0)        # AI Vision quality (0-100)
    engagement_score = Column(Integer, default=0)     # Reaction/Engagement (0-100)
    recreatability_score = Column(Integer, default=0) # Ease of recreation (0-100)
    total_sovereign_score = Column(Integer, default=0) # Comprehensive score
    
    # [NEW] Feature Flags
    is_rising_star = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    # category = relationship("CategoryTree")

class SwarmWisdom(Base):
    """시행착오를 통해 축적된 에이전트 지식 저장소 (Evolutionary Brain)"""
    __tablename__ = "swarm_wisdom"
    
    id = Column(Integer, primary_key=True, index=True)
    niche = Column(String, index=True)
    category = Column(String, index=True) # SCRIPT, VISUAL, TREND, HOOK
    
    title = Column(String)
    content = Column(Text)              # 정제된 지식 내용 (Pattern/Lesson)
    experience_type = Column(String)    # SUCCESS_PATTERN, FAILURE_POST_MORTEM
    
    # 벡터 검색 및 관리용
    vector_id = Column(String, nullable=True) # LanceDB와 매핑용
    importance_score = Column(Integer, default=50) # 0-100
    
    # 출처 미션
    source_session_id = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class SwarmArtifact(Base):
    """
    미션 단계별 '공요 산출물' 버전 저장소 (Artifact Registry)
    주요 Stage(Script, Media, Render 등)의 스냅샷을 보존하여 타임 트래블(Rollback)을 가능케 함.
    """
    __tablename__ = "swarm_artifacts"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("agent_swarm_sessions.id", ondelete="CASCADE"), nullable=False)
    
    node_id = Column(String, index=True) # Workflow Node ID (e.g. 'writerNode_1')
    stage_label = Column(String)         # 'SCRIPT', 'MEDIA', 'LOCALIZATION'
    version = Column(Integer, default=1)
    
    # 실제 데이터 스냅샷 (StandardDataPacket JSON)
    content_json = Column(JSON, nullable=False)
    
    # 산출물 무결성 해시 (Content Hash)
    checksum = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True) # 현재 활성 버전 여부

class SwarmUsageStats(Base):
    """
    소버린 거버넌스: 에이전트별 리소스(토큰, 비용) 모니터링
    """
    __tablename__ = "swarm_usage_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("agent_swarm_sessions.id", ondelete="CASCADE"), nullable=False)
    
    agent_type = Column(String, index=True) # RESEARCHER, WRITER, EDITOR
    model_name = Column(String)
    
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    
    estimated_cost_usd = Column(Float, default=0.0)
    
    timestamp = Column(DateTime, default=datetime.now)


# ──────────────────────────────────────────────
# AI Research Intelligence Models
# ──────────────────────────────────────────────

class ResearchNiche(Base):
    """
    Niche clusters discovered from trending keywords.
    Each niche represents a high-potential domain for research.
    """
    __tablename__ = "research_niches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, default="")
    category = Column(String, index=True, nullable=True)
    source_trend_ids = Column(JSON, default=list)
    avg_viral_score = Column(Float, default=0.0)
    keyword_count = Column(Integer, default=0)
    status = Column(String, default="active")  # active, deprecated
    discovered_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    topics = relationship("ResearchTopic", back_populates="niche", cascade="all, delete-orphan")


class ResearchTopic(Base):
    """
    Specific research questions/topics generated for a niche.
    These are consumed by the research execution pipeline.
    """
    __tablename__ = "research_topics"

    id = Column(Integer, primary_key=True, index=True)
    niche_id = Column(Integer, ForeignKey("research_niches.id", ondelete="CASCADE"), nullable=False)
    title = Column(String)
    research_question = Column(Text)
    priority = Column(Integer, default=50)  # 0-100
    status = Column(String, default="pending")  # pending, in_progress, completed, dismissed
    created_at = Column(DateTime, default=datetime.now)
    scheduled_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    niche = relationship("ResearchNiche", back_populates="topics")
    report = relationship("ResearchReport", back_populates="topic", uselist=False, cascade="all, delete-orphan")


class ResearchReport(Base):
    """
    Completed research brief stored as knowledge.
    [Research Brain] Now also stores the structured ProductionResearchBrief used
    to drive shorts/longform script generation.
    """
    __tablename__ = "research_reports"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("research_topics.id", ondelete="CASCADE"), nullable=False)
    summary = Column(Text)
    key_findings = Column(Text, default="")
    sources_json = Column(JSON, default=list)
    model_used = Column(String, default="")
    created_at = Column(DateTime, default=datetime.now)
    # [Research Brain] Structured production brief + gate metadata
    brief_json = Column(JSON, nullable=True)          # serialized ProductionResearchBrief
    research_depth = Column(Integer, default=0)        # number of deep-research loops
    production_readiness = Column(Float, default=0.0)  # 0-10 quality score
    gate_status = Column(String, default="")          # pass | review | reject
    topic = relationship("ResearchTopic", back_populates="report")


class ReferenceVideo(Base):
    """
    A publicly-discovered reference video whose FORMAT (not footage) we analyze.
    Stores channel info, link, and metadata + auto-transcript only — never a
    redistributed copy of the source media.
    """
    __tablename__ = "reference_videos"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    platform = Column(String, default="youtube")  # youtube | reddit | tiktok | instagram
    channel_name = Column(String, default="")
    channel_url = Column(String, default="")
    title = Column(String, default="")
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    duration = Column(Integer, default=0)  # seconds
    thumbnail_url = Column(String, default="")
    transcript = Column(Text, default="")
    lang = Column(String, default="")
    niche = Column(String, default="", index=True)
    viral_score = Column(Float, default=0.0)
    format_card_json = Column(JSON, nullable=True)  # extracted FormatCard
    status = Column(String, default="collected")    # collected | analyzed | used
    collected_at = Column(DateTime, default=datetime.now)


class SourceAsset(Base):
    """
    A LEGAL production asset (stock / public-domain) downloaded for reuse.
    Tracks provider, license and attribution per asset.
    """
    __tablename__ = "source_assets"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, default="pexels")  # pexels | pixabay | archive | wikimedia
    source_url = Column(String, default="")
    preview_url = Column(String, default="")
    local_path = Column(String, default="")
    media_type = Column(String, default="video")  # video | image
    license = Column(String, default="")
    attribution = Column(String, default="")
    query = Column(String, default="", index=True)
    brief_id = Column(Integer, ForeignKey("research_reports.id", ondelete="SET NULL"), nullable=True)
    duration = Column(Integer, default=0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    downloaded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

YouTubeChannel = BrandChannel

class DdalkkakDownloadJob(Base):
    __tablename__ = "ddalkkak_downloads"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    status = Column(String, default='pending')  # pending, downloading, completed, failed
    filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    size_bytes = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime, nullable=True)

class DdalkkakSubtitleJob(Base):
    __tablename__ = "ddalkkak_subtitle_jobs"

    id = Column(Integer, primary_key=True, index=True)
    video_filename = Column(String, nullable=True)
    video_path = Column(String, nullable=True)
    style = Column(String, default='shorts')  # shorts, info, japanese
    duration_sec = Column(Float, default=0.0)
    original_urls = Column(Text, nullable=True)  # JSON list
    status = Column(String, default='pending')
    progress = Column(Integer, default=0)
    progress_message = Column(String, nullable=True)
    subtitle_paths = Column(Text, nullable=True)  # JSON
    title_candidates = Column(Text, nullable=True)  # JSON list
    gemini_results = Column(Text, nullable=True)  # JSON
    user_id = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime, nullable=True)

class DdalkkakDubbingJob(Base):
    __tablename__ = "ddalkkak_dubbing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)
    script_text = Column(Text, nullable=True)
    voice_type = Column(String, default='default')
    status = Column(String, default='pending')
    progress = Column(Integer, default=0)
    progress_message = Column(String, nullable=True)
    result_audio_path = Column(String, nullable=True)
    result_video_path = Column(String, nullable=True)
    user_id = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime, nullable=True)

class DdalkkakClipEditJob(Base):
    __tablename__ = "ddalkkak_clipedit_jobs"

    id = Column(Integer, primary_key=True, index=True)
    source_video_path = Column(String, nullable=True)
    status = Column(String, default='pending')
    progress = Column(Integer, default=0)
    progress_message = Column(String, nullable=True)
    result_clips = Column(Text, nullable=True) # JSON list of paths
    user_id = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime, nullable=True)
