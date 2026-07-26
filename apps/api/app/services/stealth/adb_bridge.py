import subprocess
import logging
import time
import os
from ...config import settings as app_settings

logger = logging.getLogger(__name__)

class ADBBridge:
    """
    Physical Mobile Device Control Bridge via ADB.
    Handles IP rotation (LTE), network checks, and stealth operations.
    """
    def __init__(self, settings=None):
        self.settings = settings
        self.adb_path = "adb"
        # Absolute paths to avoid environment/PATH issues
        self.CMD_POWERSHELL = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
        self._cached_ip = None
        self._cached_time = 0

    def rotate_ip(self, method='soft'):
        """
        Rotates high-anonymity mobile IP.
        Soft: Fast Data Toggle.
        Hard: Deeper Airplane Mode Reset.
        """
        logger.info(f"🔄 [Stealth] IP Rotation Triggered (Method: {method})")
        try:
            if method == 'soft':
                self._run_adb(['shell', 'svc', 'data', 'disable'])
                time.sleep(0.5)
                self._run_adb(['shell', 'svc', 'data', 'enable'])
            else:
                self._run_adb(['shell', 'svc', 'data', 'disable'])
                time.sleep(2)
                self._run_adb(['shell', 'svc', 'data', 'enable'])
            
            logger.info("✅ [Stealth] IP Rotation Complete")
            return True
        except Exception as e:
            logger.error(f"❌ [Stealth] IP Rotation Failed: {e}")
            return False

    def get_mobile_public_ip(self) -> str:
        """Fetches the mobile device's public IP via ADB shell curl."""
        providers = ["https://api.ipify.org", "https://ifconfig.me/ip"]
        for url in providers:
            result = self._run_adb(['shell', 'curl', '-s', '--connect-timeout', '5', url])
            if result and "." in result:
                return result.strip()
        return "Unknown"

    def _run_adb(self, cmd_list):
        """Internal ADB executor with Windows-safe flags."""
        try:
            full_cmd = [self.adb_path] + cmd_list
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
            result = subprocess.run(
                full_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                startupinfo=startupinfo
            )
            return result.stdout.strip()
        except Exception as e:
            logger.error(f"ADB Exec Error: {e}")
            return None
