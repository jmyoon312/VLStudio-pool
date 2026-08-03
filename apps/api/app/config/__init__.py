import os
import platform
from pydantic_settings import BaseSettings
from typing import Optional

# Detection for Native Windows
IS_WINDOWS = platform.system() == "Windows"

def get_default_media_root() -> str:
    if IS_WINDOWS:
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            local_app_data = os.path.join(os.path.expanduser("~"), "AppData", "Local")
        return os.path.join(local_app_data, "ViraLoop Studio", "media").replace("\\", "/")
    return "/app/media"

DEFAULT_MEDIA_ROOT = get_default_media_root()
DEFAULT_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DEFAULT_DB_HOST = "127.0.0.1" if IS_WINDOWS else "postgres"
DEFAULT_REDIS_HOST = "127.0.0.1" if IS_WINDOWS else "redis"

# [FFmpeg Discovery for Windows]
def discover_ffmpeg() -> str:
    if not IS_WINDOWS: return "ffmpeg"
    import shutil
    import os
    
    # 1. Check User Local AppData media bin folder (Primary)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        local_app_data = os.path.join(os.path.expanduser("~"), "AppData", "Local")
    local_ffmpeg_path = os.path.join(local_app_data, "ViraLoop Studio", "media", "bin", "ffmpeg", "bin", "ffmpeg.exe")
    if os.path.exists(local_ffmpeg_path):
        return local_ffmpeg_path
        
    # 2. Check bundled / backup ViraLoop FFmpeg at C:\ViraLoopMedia\bin (Secondary)
    backup_path = r"C:\ViraLoopMedia\bin\ffmpeg\bin\ffmpeg.exe"
    if os.path.exists(backup_path):
        return backup_path
        
    # 3. Check system PATH
    if shutil.which("ffmpeg"): return "ffmpeg"
    
    # 4. Check Playwright's bundled FFmpeg
    pw_path: str = os.path.expanduser("~\\AppData\\Local\\ms-playwright")
    if os.path.exists(pw_path):
        for root, dirs, files in os.walk(pw_path):
            if "ffmpeg.exe" in files:
                return os.path.join(root, "ffmpeg.exe")
    return "ffmpeg"

class Settings(BaseSettings):
    # Base Directories
    PROJECT_NAME: str = "ViraLoop"
    PROJECT_ROOT: str = os.getenv("VIRALOOP_PROJECT_ROOT", DEFAULT_PROJECT_ROOT)
    APPS_ROOT: str = os.path.join(PROJECT_ROOT, "apps")
    
    # Media Storage Configuration (Unified)
    MEDIA_ROOT: str = os.getenv("VIRALOOP_MEDIA_ROOT", DEFAULT_MEDIA_ROOT)
    TEMP_DIR: str = os.path.join(MEDIA_ROOT, "02_Operations", "Temp")
    DOWNLOADS_DIR: str = os.path.join(MEDIA_ROOT, "downloads")
    ASSETS_DIR: str = os.path.join(MEDIA_ROOT, "03_Assets")
    OPERATIONS_DIR: str = os.path.join(MEDIA_ROOT, "02_Operations")
    INBOX_DIR: str = os.path.join(MEDIA_ROOT, "01_Inbox")
    EXPORTS_DIR: str = os.path.join(MEDIA_ROOT, "05_Exports")
    
    # Legacy Path Support
    root_download_path: str = os.path.join(MEDIA_ROOT, "downloads")
    
    # Path for Cookies
    COOKIES_PATH: Optional[str] = os.getenv("VIRALOOP_COOKIES_PATH", None)
    
    # Database — Standalone(Windows)에서는 SQLite, Docker에서는 PostgreSQL
    # Electron main.js가 DATABASE_URL=sqlite:///./viral_loop.db 를 환경변수로 주입함
    def get_default_db_url(self) -> str:
        if IS_WINDOWS:
            local_app_data = os.environ.get("LOCALAPPDATA")
            if not local_app_data:
                local_app_data = os.path.join(os.path.expanduser("~"), "AppData", "Local")
            storage_dir = os.path.join(local_app_data, "ViraLoop Studio").replace("\\", "/")
            raw_db_path = os.path.join(os.getenv('VIRALOOP_STORAGE_DIR', storage_dir), 'viral_loop.db')
            normalized_db_path = raw_db_path.replace('\\\\', '/')
            return f"sqlite:///{normalized_db_path}"
        return f"postgresql://viraloop:viraloop@{DEFAULT_DB_HOST}:5432/viraloop"

    @property
    def DATABASE_URL(self) -> str:
        return os.getenv("DATABASE_URL", self.get_default_db_url())

    
    # LLM Provider Keys (Multi-key Rotation Support)
    gemini_api_keys: list[str] = []
    groq_api_keys: list[str] = []
    openrouter_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    sambanova_api_keys: list[str] = []
    cerebras_api_keys: list[str] = []
    
    # Video Generation Keys
    kie_api_key: Optional[str] = None
    muapi_api_key: Optional[str] = None
    kling_api_key: Optional[str] = None
    luma_api_key: Optional[str] = None
    
    # TTS Keys
    typecast_api_keys: list[str] = []
    elevenlabs_keys: list[str] = []
    supertone_project_key: Optional[str] = None
    supertone_model_path: Optional[str] = None
    
    # AI Models (Schema definition only, actual values driven by DB)
    whisper_model_path: Optional[str] = None
    agent_model: Optional[str] = None
    agent_research_limit: Optional[int] = None
    default_llm_model: Optional[str] = "gemini-1.5-flash"
    
    # Hermes Intelligence
    hermes_agent_provider: str = "opencode"
    hermes_agent_model: str = "deepseek-v4-flash-free"
    hermes_wisdom_depth: int = 3
    hermes_reflection_verbosity: str = "balanced"
    hermes_auto_reflection: bool = True
    hermes_auto_update_enabled: bool = True
    
    # Rendering & Swarm Management
    MAX_CONCURRENT_RENDERS: int = 2 
    ENABLE_SWARM_MODE: bool = True
    
    # Legacy / Single Key Fallbacks (For backward compatibility)
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    
    # [Redis Routing]
    REDIS_URL: str = os.getenv("REDIS_URL", f"redis://{DEFAULT_REDIS_HOST}:6379/0")

    # [Media Tools Discovery]
    FFMPEG_PATH: str = discover_ffmpeg()
    FFPROBE_PATH: str = os.getenv("FFPROBE_PATH", "ffprobe")
    
    # Advanced Features
    ENABLE_RATE_LIMITER: bool = True
    ENABLE_CIRCUIT_BREAKER: bool = True
    RATE_LIMIT_MODE: str = "BALANCED"
    
    # Task Queue (Redis — replaces RabbitMQ)
    TASK_QUEUE_NAME: str = "viraloop_tasks"

    # External n8n Integration
    N8N_EXTERNAL_URL: Optional[str] = os.getenv("N8N_EXTERNAL_URL", None)

    # Legacy RabbitMQ — kept as no-op fallbacks to avoid NameError in old code
    RABBITMQ_HOST: str = os.getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    AGENT_QUEUE_NAME: str = "openclaw_missions"
    
    class Config:
        case_sensitive = True
        extra = "ignore"

settings = Settings()

# Ensure critical directories exist
def initialize_directories():
    for path in [settings.MEDIA_ROOT, settings.TEMP_DIR, settings.DOWNLOADS_DIR, settings.ASSETS_DIR, settings.OPERATIONS_DIR, settings.INBOX_DIR, settings.EXPORTS_DIR]:
        if not os.path.exists(path):
            try:
                os.makedirs(path, exist_ok=True)
                print(f"[OK] Created directory: {path}")
            except Exception as e:
                print(f"[WARN] Failed to create directory {path}: {str(e)}")

# Initialize on import
initialize_directories()
