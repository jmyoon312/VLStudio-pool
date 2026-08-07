import subprocess
import logging
import platform
import os
import time
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

class ADBService:
    """
    ViraLoop 다중 장치 지원 ADB 서비스
    - 여러 대의 안드로이드 폰을 시리얼 번호로 개별 제어
    - LTE IP 로테이션 (비행기 모드 토글)
    - WSL2/리눅스 환경 호환성 확보
    """
    def __init__(self):
        # [FIX] Prioritize root-level path to bypass Antivirus DLL profile heuristic blocks (STATUS_DLL_NOT_FOUND 0xC0000135)
        legacy_path = r"C:\ViraLoopMedia\bin\adb\adb.exe"
        if os.path.exists(legacy_path):
            self.adb_path = legacy_path
        else:
            from app.config import settings as settings_conf
            self.adb_path = os.path.join(settings_conf.MEDIA_ROOT, "09_System", "bin", "adb", "adb.exe").replace("\\", "/")
        self.CMD_POWERSHELL = "powershell.exe"
        
        # 장치별 캐시
        self._cached_public_ips = {} # {serial: ip}
        self.default_serial = None

        # [Perf] 시스템 공인 IP 캐시 (30초 TTL) — get_system_public_ip() 블로킹 방지
        self._system_ip_cache = ""
        self._system_ip_last_check = 0.0
        self._system_ip_refreshing = False  # 중복 백그라운드 요청 방지

        # [NEW] Settings Cache
        self.config_connection_method = "usb"

    def refresh_config(self, db_settings=None):
        """DB 설정을 서비스에 반영"""
        if not db_settings:
            try:
                from app.database import SessionLocal
                from app import crud
                db = SessionLocal()
                db_settings = crud.get_settings(db)
                db.close()
            except:
                return

        if db_settings:
            if db_settings.adb_default_serial:
                self.default_serial = db_settings.adb_default_serial
            if db_settings.adb_connection_method:
                self.config_connection_method = db_settings.adb_connection_method
            logger.info(f"[REFRESH] ADB Service config refreshed from DB (Serial: {self.default_serial})")

    def list_devices(self) -> List[str]:
        """연결된 모든 ADB 장치 시리얼 목록 반환"""
        try:
            # 윈도우에서 ADB 실행파일 존재 확인
            if not os.path.exists(self.adb_path):
                logger.error(f"[FAIL] ADB executable not found at: {self.adb_path}")
                return []

            # [NEW] Try to connect via wireless if configured
            if self.config_connection_method == 'wireless' and self.default_serial:
                if ":" in self.default_serial:
                     subprocess.run([self.adb_path, "connect", self.default_serial], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)

            result = subprocess.run([self.adb_path, "devices"], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
            devices = []
            for line in result.stdout.splitlines()[1:]:
                if "device" in line and not "devices" in line:
                    serial = line.split()[0]
                    devices.append(serial)
            
            if devices:
                # [Fix] Every Proxy(8080 포트) 사용으로 USB 테더링 강제 불필요
                # 구형 기기에서 USB 테더링 명령 시 커널 패닉(무한 재부팅) 발생 방지
                pass

            return devices
        except Exception as e:
            logger.error(f"[FAIL] 장치 목록 조회 실패: {e}")
            return []

    def ensure_tethering_active(self, serial: Optional[str] = None):
        """[Deprecated] Every Proxy 전환으로 인해 사용 안 함. 구형 기기 무한 재부팅 방지용"""
        pass

    def run_command(self, cmd_list: List[str], serial: Optional[str] = None) -> str:
        """특정 시리얼 장치에 대해 ADB 명령 실행"""
        target_serial = serial or self.default_serial
        
        full_cmd = [self.adb_path]
        if target_serial:
            full_cmd += ["-s", target_serial]
        full_cmd += cmd_list
        
        try:
            result = subprocess.run(
                full_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if result.stderr and "error" in result.stderr.lower():
                logger.warning(f"[WARN] ADB Error ({target_serial}): {result.stderr.strip()}")
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            logger.error(f"[FAIL] ADB 명령 타임아웃: {' '.join(full_cmd)}")
            return ""
        except Exception as e:
            logger.error(f"[FAIL] ADB 명령 실패: {' '.join(full_cmd)} - {e}")
            return ""

    def get_current_ip(self, serial: Optional[str] = None, force: bool = False) -> str:
        """핸드폰 내부에서 공인 IP 확인 (최적화 버전)"""
        target = serial or "default"
        
        # 너무 잦은 폴링 부하 방지: 강제 갱신이 아니고 유효한 IP가 있다면 15초간 캐시 유지
        cached = self._cached_public_ips.get(target)
        last_check = getattr(self, f"_last_check_{target}", 0)
        
        # [Bug Fix] "갱신 중..." 같은 상태 메시지가 마침표(.)를 포함하여 유효한 IP 캐시로 오인되는 것 방지
        is_valid_ip = False
        if cached:
            is_valid_ip = bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', cached))
            
        if not force and is_valid_ip and (time.time() - last_check < 15):
            return cached
            
        providers = ["https://api.ipify.org", "https://ifconfig.me/ip"]
        
        # Every Proxy 포트 포워딩 보장
        self.run_command(['forward', 'tcp:8080', 'tcp:8080'], serial)
        import requests
        proxies = {"http": "http://127.0.0.1:8080", "https": "http://127.0.0.1:8080"}

        for url in providers:
            try:
                # 1차: PC에서 Every Proxy를 거쳐 조회 (curl 없는 구형 기기 지원)
                resp = requests.get(url, proxies=proxies, timeout=3)
                res = resp.text.strip()
                if res and len(res) > 6 and "." in res:
                    self._cached_public_ips[target] = res
                    setattr(self, f"_last_check_{target}", time.time())
                    return res
            except Exception as e:
                # 2차: Fallback으로 adb shell curl 시도
                res = self.run_command(['shell', 'curl', '-s', '--connect-timeout', '2', '--max-time', '3', url], serial)
                if res and len(res) > 6 and "." in res:
                    self._cached_public_ips[target] = res
                    setattr(self, f"_last_check_{target}", time.time())
                    return res
        
        # [FALLBACK] 통신 실패 시 절대 시스템 IP(Wi-Fi)로 덮어쓰지 않음 -> UI Flickering(깜빡임) 방지
        return cached if is_valid_ip else "오프라인 (연결 안됨)"

    def _fetch_system_ip_blocking(self) -> str:
        """[Internal] 실제 시스템 공인 IP 조회 (블로킹). 캐시 갱신용 내부 메서드."""
        import socket
        import sys
        try:
            from .network_monitor import network_monitor
            status = network_monitor.get_status()

            bind_ip = ""
            wired_ip = status.get("wired", {}).get("ip", "")
            wifi_ip = status.get("wifi", {}).get("ip", "")

            if wired_ip and "169.254" not in wired_ip and wired_ip not in ["Not Detected", "Error", ""]:
                bind_ip = wired_ip
            elif wifi_ip and "169.254" not in wifi_ip and wifi_ip not in ["Not Detected", "Error", ""]:
                bind_ip = wifi_ip

            if bind_ip:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(4.0)
                s.bind((bind_ip, 0))
                s.connect(("api.ipify.org", 80))
                s.sendall(b"GET / HTTP/1.1\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n")
                response = b""
                while True:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    response += chunk
                s.close()
                parts = response.split(b"\r\n\r\n")
                if len(parts) >= 2:
                    ip = parts[1].decode('utf-8').strip()
                    if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip):
                        return ip
        except Exception as e:
            logger.debug(f"System public IP fetch failed: {e}")

        if sys.platform != 'win32':
            import urllib.request
            try:
                with urllib.request.urlopen("https://api.ipify.org", timeout=4) as resp:
                    return resp.read().decode('utf-8').strip()
            except Exception:
                pass
        return ""

    def get_system_public_ip(self) -> str:
        """윈도우 호스트 공인 IP (캐시 30초 TTL, 비블로킹).

        - 캐시가 유효하면 즉시 반환 (0ms).
        - 캐시 만료 시 백그라운드 스레드로 갱신 후 기존 캐시 반환.
        - 최초 호출이거나 캐시가 없으면 블로킹 조회 1회 수행.
        """
        import threading
        CACHE_TTL = 30  # 초
        now = time.time()

        # 캐시 유효: 즉시 반환
        if self._system_ip_cache and (now - self._system_ip_last_check) < CACHE_TTL:
            return self._system_ip_cache

        # 캐시 있지만 만료 → 백그라운드 갱신, 기존 값 즉시 반환
        if self._system_ip_cache and not self._system_ip_refreshing:
            self._system_ip_refreshing = True
            def _refresh():
                try:
                    ip = self._fetch_system_ip_blocking()
                    if ip:
                        self._system_ip_cache = ip
                        self._system_ip_last_check = time.time()
                finally:
                    self._system_ip_refreshing = False
            threading.Thread(target=_refresh, daemon=True).start()
            return self._system_ip_cache

        # 최초 호출: 1회 블로킹 (캐시 없음)
        ip = self._fetch_system_ip_blocking()
        if ip:
            self._system_ip_cache = ip
            self._system_ip_last_check = now
            return ip
        return ""

    def rotate_ip(self, serial: Optional[str] = None, method: str = 'hard') -> bool:
        """IP 로테이션 실행 (비행기 모드 토글) — [Bug 10] USB 테더링 재활성화 보장"""
        target = serial or "default"
        logger.info(f"[REFRESH] [{target}] IP 로테이션 시작 (방식: {method})")

        try:
            self._cached_public_ips[target] = "갱신 중..."
            setattr(self, f"_last_check_{target}", time.time())

            if method == 'soft':
                self.run_command(['shell', 'svc', 'data', 'disable'], serial)
                time.sleep(1)
                self.run_command(['shell', 'svc', 'data', 'enable'], serial)
                time.sleep(3)
            else:
                # 비행기 ON
                self.run_command(['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable'], serial)
                time.sleep(5)
                # 비행기 OFF
                self.run_command(['shell', 'cmd', 'connectivity', 'airplane-mode', 'disable'], serial)

                # [Bug 10] 비행기 해제 후 ADB 기기가 다시 응답할 때까지 대기 (최대 15초)
                device_ready = False
                for wait_i in range(15):
                    time.sleep(1)
                    result = subprocess.run(
                        [self.adb_path, 'devices'],
                        capture_output=True, text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        timeout=5
                    )
                    device_lines = [l for l in result.stdout.splitlines()[1:] if 'device' in l and 'devices' not in l]
                    if device_lines:
                        device_ready = True
                        logger.info(f"[Bug 10] ADB device ready after {wait_i+1}s")
                        break

                # [Fix] Every Proxy 사용으로 인해 더 이상 USB 테더링을 강제 활성화하지 않습니다.
                # (구형 기기에서 USB 테더링 명령 시 커널 패닉 및 무한 재부팅 발생)
                if device_ready:
                    logger.error("[Bug 10] ADB device did not come back online within 15s after airplane-off")

            setattr(self, f"_last_check_{target}", 0)  # 캐시 무효화
            new_ip = self.get_current_ip(serial, force=True)
            
            # [Bug Fix] 로테이션 완료 후 새 IP 조회가 실패하거나 정상 포맷이 아닌 경우, 캐시의 "갱신 중..."을 확실하게 지워 무한 갱신 루프를 차단함
            if not new_ip or not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', new_ip):
                self._cached_public_ips.pop(target, None)
                
            logger.info(f"[OK] [{target}] IP 갱신 완료: {new_ip}")
            return True
        except Exception as e:
            logger.error(f"[FAIL] [{target}] 로테이션 실패: {e}")
            return False

    def enable_wifi(self, serial: Optional[str] = None):
        self.run_command(['shell', 'svc', 'wifi', 'enable'], serial)

    def disable_wifi(self, serial: Optional[str] = None):
        self.run_command(['shell', 'svc', 'wifi', 'disable'], serial)

    def _find_tethering_interface(self) -> Optional[str]:
        """윈도우에서 테더링 인터페이스 이름 찾기 — Connected 또는 Isolated 상태 모두 수용"""
        try:
            from .network_monitor import network_monitor
            status = network_monitor.get_status()
            lte = status.get('lte', {})
            # [Bug 3] 'Isolated' 상태 (라우팅 메트릭 9000으로 낮춰진 LTE)도 유효한 인터페이스로 처리
            if lte.get('status') in ('Connected', 'Isolated'):
                name = lte.get('name', '')
                # [Bug 4] 괄호 접미사 제거 (예: "Realtek USB (IP-Match)" → "Realtek USB")
                clean_name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
                return clean_name if clean_name else None
            return None
        except Exception:
            return None

    def get_tethering_interface_ip(self, use_cache: bool = True) -> str:
        """테더링 인터페이스의 로컬 IP 주소 반환.
        
        Args:
            use_cache: True이면 network_monitor 메모리 캐시를 우선 조회하여
                       PowerShell 호출 없이 0ms 반환. False이면 강제 PS 조회.
        """
        # [Bug 6] 캐시 우선 조회 — PS 호출 오버헤드 제거
        if use_cache:
            try:
                from .network_monitor import network_monitor
                cached_ip = network_monitor.current_status.get('lte', {}).get('ip', '')
                if cached_ip and '169.254' not in cached_ip and cached_ip not in ('', 'Error', 'Not Detected'):
                    return cached_ip
            except Exception:
                pass

        iface = self._find_tethering_interface()
        if not iface:
            return "Not Detected"

        try:
            cmd = f"Get-NetIPAddress -InterfaceAlias '{iface}' -AddressFamily IPv4 | Select-Object -ExpandProperty IPAddress"
            res = subprocess.run(
                ["powershell.exe", "-Command", cmd],
                capture_output=True, text=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
                timeout=5
            )
            if res.returncode == 0 and res.stdout.strip():
                ip = res.stdout.strip().splitlines()[0]
                # 조회 결과를 monitor 캐시에 반영
                try:
                    from .network_monitor import network_monitor
                    network_monitor.current_status.setdefault('lte', {})['ip'] = ip
                except Exception:
                    pass
                return ip
            return "Not Detected"
        except Exception:
            return "Error"

    def get_network_status_detail(self, force: bool = False) -> dict:
        """프론트엔드용 네트워크 상세 상태 반환"""
        try:
            from .network_monitor import network_monitor
            
            devices = self.list_devices()
            adb_connected = len(devices) > 0
            tethering_ip = self.get_tethering_interface_ip()
            
            # 기본 상태 정보 (network_monitor에서 가져옴)
            monitor_status = network_monitor.get_status()
            system_ip = self.get_system_public_ip()
            
            # Refresh Mobile IP if adb is connected
            mobile_ip = "Unknown"
            if adb_connected:
                 mobile_ip = self.get_current_ip(force=force) # Actual adb check
            
            # Determine status_detail for frontend logic
            mode = monitor_status.get("system_gateway_mode", "WIFI")
            
            # [FIX] Bridge-mode friendly detection
            # If we have an LTE IP via ADB, we ARE connected to LTE regardless of interface visibility
            is_lte_active = adb_connected and mobile_ip != "Unknown" and mobile_ip != "확인 실패"
            
            if is_lte_active:
                status_detail = "LTE_MODE" if mode == "LTE" else "DUAL_MODE"
                # Update monitor status for UI consistency
                if monitor_status["lte"]["status"] != "Connected":
                    monitor_status["lte"].update({
                        "status": "Connected",
                        "name": "ADB-Tether",
                        "metric": monitor_status["lte"].get("metric", 9000)
                    })
            else:
                status_detail = "WIFI_MODE"

            return {
                "status_detail": status_detail,
                "adb_connected": adb_connected,
                "device_count": len(devices),
                "tethering_ip": tethering_ip if tethering_ip != "Not Detected" else ("ADB-Linked" if adb_connected else "Not Detected"),
                "mobile_data_enabled": True,
                "public_ip": mobile_ip if is_lte_active else system_ip,
                "system_public_ip": system_ip,
                "mobile_public_ip": mobile_ip,
                "monitor": monitor_status,
                "interface_ip": tethering_ip,
                "current_ip": mobile_ip if is_lte_active else system_ip
            }
        except Exception as e:
            logger.error(f"Failed to get network status detail: {e}")
            return {"status": "ERROR", "detail": str(e), "adb_connected": False}

    def perform_rotation_check(self) -> str:
        """로테이션 후 IP 변경 확인"""
        old_ip = self._cached_public_ips.get("default")
        if self.rotate_ip(method='soft'):
            new_ip = self.get_current_ip()
            if new_ip != old_ip:
                return new_ip
        return "Verification Failed"


# 싱글톤 인스턴스
adb_service = ADBService()