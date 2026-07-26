import subprocess
import logging
import platform
import os
import time
from typing import List, Optional
import re
import socket
import sys
import urllib.request

logger = logging.getLogger(__name__)

class ADBService:
    """
    ViraLoop multi-device ADB service
    - Samsung One UI 6+ safe IP rotation (no airplane mode, no PDP race)
    - Single-pass tethering+data toggle — 10s, stable
    """

    def __init__(self):
        legacy_path = r"C:\ViraLoopMedia\bin\adb\adb.exe"
        if os.path.exists(legacy_path):
            self.adb_path = legacy_path
        else:
            from app.config import settings as settings_conf
            self.adb_path = os.path.join(settings_conf.MEDIA_ROOT, "bin", "adb", "adb.exe").replace("\\", "/")
        self.CMD_POWERSHELL = "powershell.exe"

        self._cached_public_ips = {}
        self.default_serial = None
        self.config_connection_method = "usb"

    def refresh_config(self, db_settings=None):
        if not db_settings:
            from app.database import SessionLocal
            db = SessionLocal()
            from app import crud
            db_settings = crud.get_settings(db)
            db.close()
        if db_settings.adb_default_serial:
            self.default_serial = db_settings.adb_default_serial
        if db_settings.adb_connection_method:
            self.config_connection_method = db_settings.adb_connection_method
        logger.info(f"ADB config loaded (serial={self.default_serial})")

    def _ensure_adb(self):
        if not os.path.exists(self.adb_path):
            logger.error(f"ADB not found: {self.adb_path}")
            return False
        return True

    def list_devices(self) -> List[str]:
        if not self._ensure_adb():
            return []
        try:
            result = subprocess.run(
                [self.adb_path, "devices"],
                capture_output=True, text=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            devices = []
            for line in result.stdout.splitlines()[1:]:
                if "device" in line and not "devices" in line:
                    serial = line.split()[0]
                    devices.append(serial)
            return devices
        except Exception as e:
            logger.error(f"Device list failed: {e}")
            return []

    def run_command(self, args: list, serial: Optional[str] = None) -> Optional[str]:
        if not self._ensure_adb():
            return None
        full_cmd = [self.adb_path]
        if serial or self.default_serial:
            full_cmd += ["-s", serial or self.default_serial]
        full_cmd += args
        try:
            result = subprocess.run(
                full_cmd,
                capture_output=True, text=True,
                timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            logger.error(f"ADB timeout: {' '.join(full_cmd)}")
            return None
        except Exception as e:
            logger.error(f"ADB fail: {' '.join(full_cmd)} - {e}")
            return None

    def get_current_ip(self, serial: Optional[str] = None, force: bool = False) -> str:
        """Phone public IP via curl, 5s max"""
        target = serial or "default"
        cached = self._cached_public_ips.get(target)
        last_check = getattr(self, f"_last_check_{target}", 0)
        is_valid = bool(cached and re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', cached))
        if not force and is_valid and (time.time() - last_check < 15):
            return cached

        result = self.run_command(
            ['shell', 'curl', '-s', '--connect-timeout', '2', '--max-time', '3', 'https://api.ipify.org'],
            serial
        )
        if result and re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', result.strip()):
            self._cached_public_ips[target] = result.strip()
            setattr(self, f"_last_check_{target}", time.time())
            return result.strip()

        self._cached_public_ips[target] = "fail"
        return "fail"

    def rotate_ip(self, serial: Optional[str] = None, method: str = 'soft') -> bool:
        """One-pass IP rotation — no airplane mode, no retry loops

        Tethering OFF → mobile-data OFF→ON (PDP reset) → tethering ON
        Carrier typically assigns new IP on PDP re-establish.
        ~10-15s total. One cycle only.
        """
        target = serial or "default"
        logger.info(f"Rotate IP [{target}]")

        # 1. Tethering OFF (detach PC)
        self.run_command(['shell', 'svc', 'tethering', 'disable'], serial)
        time.sleep(2)

        # 2. Mobile-data OFF → wait → ON (PDP teardown + reattach)
        self.run_command(['shell', 'cmd', 'connectivity', 'mobile-data', 'disable'], serial)
        time.sleep(3)
        self.run_command(['shell', 'cmd', 'connectivity', 'mobile-data', 'enable'], serial)
        time.sleep(3)

        # 3. Tethering ON (re-attach PC)
        self.run_command(['shell', 'svc', 'tethering', 'enable'], serial)
        time.sleep(3)

        # 4. Verify IP — one try, no loop
        self._cached_public_ips.pop(target, None)
        ip = self.get_current_ip(serial, force=True)
        if ip != "fail":
            logger.info(f"IP rotated: {ip}")
            return True
        logger.error(f"IP rotation failed — IP unreachable")
        return False

    def disable_wifi(self, serial: Optional[str] = None):
        self.run_command(['shell', 'svc', 'wifi', 'disable'], serial)

    def get_tethering_status(self, force: bool = False) -> dict:
        from app.services import network_monitor
        adb_connected = len(self.list_devices()) > 0
        mobile_ip = self.get_current_ip(force=force) if adb_connected else "Unknown"
        return {
            "adb_connected": adb_connected,
            "mobile_ip": mobile_ip,
            "status": "LTE" if mobile_ip not in ["Unknown", "fail", ""] else "WIFI"
        }


adb_service = ADBService()