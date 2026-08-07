
import os
import sys
from app.database import SessionLocal

def get_standardized_download_path(settings=None) -> str:
    """
    Returns the standardized absolute download root: {MEDIA_ROOT}/downloads
    """
    from app.config import settings as app_config_settings

    if not settings:
        # settings 미전달 시 config에서 가져옴
        return app_config_settings.DOWNLOADS_DIR
    elif settings and settings.root_download_path:
        return os.path.abspath(settings.root_download_path)
    else:
        # DB Settings 객체에는 MEDIA_ROOT가 없으므로 app.config에서 가져옴
        return app_config_settings.DOWNLOADS_DIR

def get_channel_download_path(settings, category_name: str = None, channel_name: str = None) -> str:
    """
    Constructs the strictly standardized path: {MEDIA_ROOT}/07_Downloads/{Category}/{Channel}
    """
    import logging
    downloads_path = get_standardized_download_path(settings)
    
    safe_channel = sanitize_folder_name(channel_name) if channel_name else "Unknown_Channel"
    
    if category_name:
        safe_category = sanitize_folder_name(category_name)
        full_path = os.path.join(downloads_path, safe_category, safe_channel)
    else:
        full_path = os.path.join(downloads_path, "_temp_storage", safe_channel)
        
    resolved_path = full_path.replace("\\", "/").replace("//", "/")
    
    try:
        os.makedirs(resolved_path, exist_ok=True)
    except Exception as e:
        logging.warning(f"[WARN] Failed to create channel download path {resolved_path}: {e}")
        
    return resolved_path


def get_operations_path() -> str:
    """
    Returns the root path for mission-specific operation workspaces.
    """
    from app.config import settings
    ops_path = settings.OPERATIONS_DIR
    
    os.makedirs(ops_path, exist_ok=True)
    return ops_path

def ensure_project_workspace(video_id: int, title: str) -> str:
    """
    Ensures the physical workspace folder exists for a project and returns the path.
    """
    base_ops = get_operations_path()
    safe_title = sanitize_folder_name(title[:30] or "Untitled")
    folder_name = f"OP-{video_id:04d}_{safe_title}"
    workspace_root = os.path.join(base_ops, folder_name)
    
    os.makedirs(workspace_root, exist_ok=True)
    return workspace_root

def sanitize_folder_name(name: str) -> str:
    """Sanitizes a string to be used as a safe folder name."""
    import re
    return re.sub(r'[\\/*?:"<>|]', "", name).replace(" ", "_")

def get_base_dir():
    """Returns the backend root directory."""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_temp_dir():
    """
    Returns the configured temporary directory.
    ALWAYS returns 'ShortsArchiver/temp_storage' to ensure consistency 
    between server startup (StaticFiles mount) and runtime (File Uploads).
    """
    try:
        from app.config import settings
        temp_dir = settings.TEMP_DIR
        os.makedirs(temp_dir, exist_ok=True)
        return temp_dir
    except Exception as e:
        print(f"Error determining temp dir: {e}")
        return os.path.join(os.getcwd(), "temp")

def get_absolute_path(path: str) -> str:
    """
    Ensures a path is absolute. If relative, resolves against the backend root.
    Useful for background tasks that might run from different working directories.
    """
    if not path:
        return ""
    
    if os.path.isabs(path):
        return path
    
    # Resolve relative to backend root (backend/app/utils/path_utils.py -> backend/)
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Candidate 1: Direct Join
    abs_path = os.path.abspath(os.path.join(backend_root, path))
    if os.path.exists(abs_path):
        return abs_path
        
    # Candidate 2: Try with "07_Downloads" prefix (common for DB paths)
    if not path.startswith("07_Downloads"):
        dl_path = os.path.abspath(os.path.join(backend_root, "07_Downloads", path))
        if os.path.exists(dl_path):
            return dl_path
            
    return abs_path
def normalize_path(path: str) -> str:
    if not path:
        return path
    
    import platform
    is_windows = platform.system() == "Windows"
    
    # Handle Windows paths in WSL (e.g., F:\download -> /mnt/f/download)
    # ONLY if we are actually running on Linux/WSL
    if not is_windows and len(path) >= 2 and path[1] == ':' and path[0].isalpha():
        drive = path[0].lower()
        rest = path[2:].replace('\\', '/')
        if rest and not rest.startswith('/'):
            rest = '/' + rest
        wsl_path = f"/mnt/{drive}{rest}"
        
        if os.path.exists(f"/mnt/{drive}"):
            return wsl_path
            
    # For native Windows or if conversion skipped, just clean slashes
    return path.replace('\\', '/')
def get_related_files(file_path: str) -> list[str]:
    """
    Returns a list of related files (subtitles, thumbnails) based on the video file path.
    """
    if not file_path:
        return []
    
    related = []
    base, _ = os.path.splitext(file_path)
    
    # Common subtitle and metadata extensions
    extensions = [
        '.jpg', '.png', '.webp', # Thumbnails
        '.vtt', '.srt', '.txt', # Subtitles/Scripts
        '.ko.vtt', '.en.vtt', '.ja.vtt', # Lang specific
        '.info.json' # yt-dlp metadata
    ]
    
    for ext in extensions:
        potential_file = base + ext
        if os.path.exists(potential_file):
            related.append(potential_file)
            
    return related

import re

def clean_transcript(text: str) -> str:
    """
    Removes SRT/VTT timestamps, line numbers, and extra metadata.
    """
    if not text:
        return ""
    
    # 1. Remove VTT header
    text = re.sub(r'^WEBVTT.*\n', '', text)
    
    # 2. Remove timestamps (SRT & VTT)
    # 00:00:00,000 --> 00:00:00,000 or 00:00:00.000 --> 00:00:00.000
    text = re.sub(r'\d{1,2}:\d{2}:\d{2}[,.]\d{3} --> \d{1,2}:\d{2}:\d{2}[,.]\d{3}', '', text)
    
    # 3. Remove line numbers (at start of line, followed by newline)
    text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
    
    # 4. Remove HTML-like tags (e.g., <i>, <c.color>)
    text = re.sub(r'<[^>]+>', '', text)
    
    # 5. Clean up extra whitespace and newlines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n'.join(lines)
