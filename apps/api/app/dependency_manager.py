import os
import shutil
import platform
import sys
import subprocess

import logging

logger = logging.getLogger(__name__)

class DependencyManager:
    @staticmethod
    def ensure_curl_impersonate():
        """
        Checks for curl_cffi and installs it if missing.
        Required for yt-dlp impersonation to avoid bot detection.
        """
        try:
            import curl_cffi
            logger.info("[OK] curl-cffi is installed.")
            return True
        except ImportError:
            logger.warning("[WARN] curl-cffi not found. Auto-installing for better evasion...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "curl-cffi"])
                logger.info("[OK] curl-cffi installed successfully.")
                return True
            except Exception as e:
                logger.error(f"[FAIL] Failed to install curl-cffi: {e}")
                return False

    @staticmethod
    def ensure_node_path():
        """
        Checks if 'node' is in PATH. If not, looks in common directories
        and adds it to the runtime PATH environment variable.
        [FIX] Cross-platform support for Linux/WSL2
        """
        if shutil.which('node'):
            logger.info("[OK] Node.js found in system PATH.")
            return True
        
        # Cross-platform detection
        import platform
        system = platform.system()
        
        if system == "Windows":
            # Common Windows Install Paths
            common_paths = [
                r"C:\Program Files\nodejs",
                r"C:\Program Files (x86)\nodejs",
                os.path.expanduser(r"~\AppData\Roaming\npm")
            ]
        else:
            # Linux/WSL2 common paths
            common_paths = [
                "/usr/local/bin",
                "/usr/bin",
                os.path.expanduser("~/.nvm/versions/node"),
                os.path.expanduser("~/.local/bin"),
            ]
        
        for path in common_paths:
            node_exe = os.path.join(path, "node.exe" if system == "Windows" else "node")
            if os.path.exists(node_exe):
                logger.info(f"[OK] Found Node.js at {path}. Adding to PATH.")
                os.environ["PATH"] += os.pathsep + path
                return True
            
            # Check for nvm versioned node
            if system != "Windows" and os.path.isdir(path):
                for item in os.listdir(path):
                    node_path = os.path.join(path, item, "bin", "node")
                    if os.path.exists(node_path):
                        nvm_bin = os.path.join(path, item, "bin")
                        logger.info(f"[OK] Found Node.js (nvm) at {nvm_bin}. Adding to PATH.")
                        os.environ["PATH"] += os.pathsep + nvm_bin
                        return True
        
        logger.warning("[WARN] Node.js not found. yt-dlp performance may be degraded.")
        return False
    @staticmethod
    def get_ffmpeg_path() -> str:
        """
        Returns the path to the FFmpeg executable.
        Priority:
        1. FFMPEG_BINARY environment variable
        2. System PATH (Global FFmpeg, preferred for hardware acceleration)
        3. WinGet Gyan.FFmpeg package bin folder
        4. User Profile Local AppData media bin folder (Primary Bundled)
        5. C:\ViraLoopMedia\bin backup path (Secondary Bundled)
        """
        # 1. Check environment variable
        env_ffmpeg = os.environ.get("FFMPEG_BINARY")
        if env_ffmpeg and os.path.exists(env_ffmpeg):
            return env_ffmpeg

        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            local_app_data = os.path.join(os.path.expanduser("~"), "AppData", "Local")

        # Ensure venv/Scripts is in PATH
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        root_dir = os.path.dirname(os.path.dirname(base_dir))
        venv_scripts = os.path.join(root_dir, "venv", "Scripts")
        if os.path.exists(venv_scripts) and venv_scripts not in os.environ["PATH"]:
            os.environ["PATH"] = venv_scripts + os.pathsep + os.environ["PATH"]

        # Ensure WinGet Gyan.FFmpeg is in PATH if present
        if local_app_data:
            winget_packages = os.path.join(local_app_data, "Microsoft", "WinGet", "Packages")
            if os.path.exists(winget_packages):
                try:
                    for item in os.listdir(winget_packages):
                        if "Gyan.FFmpeg" in item:
                            for sub in os.listdir(os.path.join(winget_packages, item)):
                                if sub.startswith("ffmpeg-"):
                                    ffmpeg_bin = os.path.join(winget_packages, item, sub, "bin")
                                    if os.path.exists(ffmpeg_bin) and ffmpeg_bin not in os.environ["PATH"]:
                                        os.environ["PATH"] = ffmpeg_bin + os.pathsep + os.environ["PATH"]
                except Exception:
                    pass

        # 2. Check system PATH (includes WinGet added above) - Highly preferred for HW Acceleration
        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg:
            # Prevent picking up a dummy or non-working one if possible, but generally trust system PATH
            return system_ffmpeg

        # 3. Check User Local AppData media bin folder (Primary Bundled Fallback)
        local_ffmpeg = os.path.join(local_app_data, "ViraLoop Studio", "media", "bin", "ffmpeg", "bin", "ffmpeg.exe")
        if os.path.exists(local_ffmpeg):
            return local_ffmpeg

        # 4. Check backup path at C:\ViraLoopMedia\bin (Secondary Bundled Fallback)
        backup_ffmpeg = r"C:\ViraLoopMedia\bin\ffmpeg\bin\ffmpeg.exe"
        if os.path.exists(backup_ffmpeg):
            return backup_ffmpeg

        # 5. Fallback
        return "ffmpeg"

    @staticmethod
    def get_ffprobe_path() -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Ensure PATH includes venv/Scripts and WinGet Gyan.FFmpeg (triggers side effects from get_ffmpeg_path)
        DependencyManager.get_ffmpeg_path()

        local_bin = os.path.join(base_dir, "bin", "ffprobe.exe" if platform.system() == "Windows" else "ffprobe")
        if os.path.exists(local_bin):
            return local_bin
        
        system_ffprobe = shutil.which("ffprobe")
        if system_ffprobe:
            return system_ffprobe
            
        return "ffprobe"

    @staticmethod
    def get_media_duration(file_path: str) -> float:
        """
        Calculates the duration of a media file using ffprobe.
        Returns duration in seconds (float).
        """
        import subprocess
        import json
        
        ffprobe_path = DependencyManager.get_ffprobe_path()
        
        try:
            cmd = [
                ffprobe_path,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json",
                file_path
            ]
            
            # Run ffprobe
            # Use creationflags=0x08000000 to prevent console window popping up on Windows
            creationflags = 0
            if platform.system() == "Windows":
                creationflags = 0x08000000
                
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                creationflags=creationflags
            )
            
            if result.returncode != 0:
                print(f"FFprobe error: {result.stderr}")
                return 0.0
                
            data = json.loads(result.stdout)
            duration = float(data['format']['duration'])
            return duration
            
        except Exception as e:
            print(f"Error calculating duration: {e}")
            return 0.0

    @staticmethod
    def check_ffmpeg() -> bool:
        """
        Verifies that FFmpeg is available and executable.
        """
        ffmpeg_path = DependencyManager.get_ffmpeg_path()
        try:
            subprocess.run(
                [ffmpeg_path, "-version"], 
                capture_output=True, 
                check=True,
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            logger.info(f"[OK] FFmpeg check passed: {ffmpeg_path}")
            return True
        except Exception as e:
            logger.error(f"[FAIL] FFmpeg check failed: {e}")
            return False

    @staticmethod
    def configure_pydub():
        """
        Configures pydub's AudioSegment to use the specific FFmpeg path 
        detected by DependencyManager.
        This suppresses RuntimeWarnings about missing ffmpeg/avconv.
        """
        try:
            # 1. Ensure FFmpeg is in PATH before importing pydub
            ffmpeg_path = DependencyManager.get_ffmpeg_path()
            
            # 2. Now import pydub (it will check PATH)
            from pydub import AudioSegment
            
            if os.path.exists(ffmpeg_path):
                AudioSegment.converter = ffmpeg_path
                # Also set ffprobe if pydub uses it (mostly for utils.mediainfo)
                # But pydub usually just calls ffmpeg for conversion.
                # Just in case:
                # AudioSegment.ffprobe = DependencyManager.get_ffprobe_path() 
                logger.info(f"[OK] Pydub configured to use: {ffmpeg_path}")
            else:
                logger.warning(f"[WARN] Pydub configuration skipped: FFmpeg not found at {ffmpeg_path}")
        except Exception as e:
            logger.error(f"[FAIL] Failed to configure pydub: {e}")

# Call this on startup
# Helper for manual run
# DependencyManager.ensure_curl_impersonate()

