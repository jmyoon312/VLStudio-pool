
import threading
import time
import logging
import subprocess
import os
import json
from datetime import datetime
import base64
import sys
import tempfile
import platform

logger = logging.getLogger("NetworkMonitor")

class NetworkMonitor:
    def __init__(self):
        # [FIX] Cross-platform admin check
        is_admin = False
        if platform.system() == "Windows":
            try:
                import ctypes
                is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
            except:
                logger.warning("Could not verify Admin privileges (Windows).")
        else:
            # Linux/WSL2 - check via os.geteuid()
            try:
                is_admin = os.geteuid() == 0
            except:
                pass
        
        self.is_admin = is_admin
        logger.info(f"NetworkMonitor Initialized. Admin Privileges: {is_admin}")

        self._stop_event = threading.Event()
        self._thread = None
        self.interval = 60  # Check every 60 seconds to prevent CPU spikes and resource waste
        self.last_elevation_request = 0  # [NEW] Cooldown for UAC popups
        
        # Target Metrics
        self.WIFI_METRIC_TARGET = 10
        self.WIRED_METRIC_TARGET = 10
        self.WIFI_SECONDARY_METRIC_TARGET = 20
        self.LTE_METRIC_TARGET = 50
        
        # State
        self.current_status = {
            "wifi": {"name": "Unknown", "metric": -1, "status": "Unknown"},
            "lte": {"name": "Unknown", "metric": -1, "status": "Unknown"},
            "last_check": None,
            "enforcement_active": True, # User toggle
            "system_gateway_mode": "WIFI" # WIFI or LTE
        }

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        logger.info("✅ NetworkMonitor Started")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()

    def _monitor_loop(self):
        try:
            import psutil
        except ImportError:
            psutil = None
            
        last_interfaces = set()
        last_heavy_check = 0
        
        while not self._stop_event.is_set():
            try:
                now = time.time()
                needs_heavy_check = False
                
                if psutil:
                    current_interfaces = set(psutil.net_if_addrs().keys())
                    if current_interfaces != last_interfaces:
                        needs_heavy_check = True
                        last_interfaces = current_interfaces
                
                if needs_heavy_check or (now - last_heavy_check) >= 60:
                    if needs_heavy_check:
                        logger.info("🔄 Network adapter change detected! Instantly triggering routing enforcement.")
                    self._check_and_enforce()
                    last_heavy_check = now
            except Exception as e:
                logger.error(f"Network Monitor Error: {e}")
            
            time.sleep(2) # Fast, zero-CPU poll

    def _run_ps(self, cmd, silence_errors=False):
        # [FIX] Use Absolute Path with env override for total portability
        PS_PATH = os.getenv("POWERSHELL_PATH", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
        try:
            full_cmd = [PS_PATH, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd]
            
            # [FIX] STARTUPINFO is Windows-only
            kwargs = {
                "stdout": subprocess.PIPE,
                "stderr": subprocess.PIPE,
                "timeout": 15
            }
            
            if sys.platform == 'win32':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                kwargs["startupinfo"] = startupinfo
            
            result = subprocess.run(full_cmd, **kwargs)
            
            # [FIX] Robust Decoding for Korean Windows (CP949/BOM)
            stdout_txt = ""
            stderr_txt = ""
            try:
                stdout_txt = result.stdout.decode('utf-8').strip()
            except:
                try: stdout_txt = result.stdout.decode('cp949').strip()
                except: stdout_txt = result.stdout.decode('mbcs', errors='ignore').strip()
                
                
            if result.returncode != 0:
                try:
                    stderr_txt = result.stderr.decode('cp949', errors='ignore').strip()
                except:
                    stderr_txt = result.stderr.decode('utf-8', errors='ignore').strip()
                
                # Check for Access Denied specifically to return it without screaming ERROR
                if "AccessDenied" in stderr_txt or "액세스가 거부" in stderr_txt:
                     logger.debug(f"PS Authorization Error (Code {result.returncode}): Access Denied (Silenced)")
                elif silence_errors:
                     logger.debug(f"PS Error (Code {result.returncode}): {stderr_txt} (Silenced)")
                else:
                     logger.error(f"PS Error (Code {result.returncode}): {stderr_txt}")
                     
                return stdout_txt, False, stderr_txt
                
            return stdout_txt, True, ""
        except Exception as e:
            logger.error(f"PowerShell Execution Failed: {e}")
            return "", False, str(e)

    def _get_ip_info(self, index):
        """Helper to get IPv4 address for a specific interface index (Windows)"""
        cmd = f"Get-NetIPAddress -InterfaceIndex {index} -AddressFamily IPv4 | Select-Object -ExpandProperty IPAddress"
        out, success, _ = self._run_ps(cmd, silence_errors=True)
        if success and out:
            # Handle multiple IPs if returned
            return out.splitlines()[0] if "\n" in out else out
        return ""

    def _check_and_enforce(self):
        if sys.platform != 'win32':
            self._check_and_enforce_linux()
            return
            
        # Strategy (Windows): 
        # 1. Use Get-NetAdapter to reliably find the InterfaceIndex (Stable Descriptions)
        # 2. Use Get-NetIPInterface to get the Metric using the Index
        
        # Step 1: Identify Interfaces via NetAdapter
        # [NEW] Added BusType for Smart Hybrid Detection
        cmd_adapter = "Get-NetAdapter | Select-Object Name, InterfaceDescription, InterfaceIndex, Status, BusType | ConvertTo-Json -Compress"
        out_adapter, success, _ = self._run_ps(cmd_adapter)
        
        wifi_idx = None
        wired_idx = None # [NEW] Wired LAN (PCI)
        lte_idx = None
        
        wifi_name = "Unknown"
        wired_name = "Unknown"
        lte_name = "Unknown"

        if out_adapter:
            try:
                adapters = json.loads(out_adapter)
                if not isinstance(adapters, list): adapters = [adapters]
                
                # Candidates for Fallback
                generic_candidates = []

                for adp in adapters:
                    desc = (adp.get('InterfaceDescription') or '').lower()
                    name = (adp.get('Name') or '').lower()
                    status = (adp.get('Status') or '').lower() # Up/Down
                    idx = adp.get('InterfaceIndex')
                    bus = adp.get('BusType') # 5=PCI, 15=USB
                    
                    # Skip disconnected adapters
                    if status != 'up': continue

                    # 1. Identify Wi-Fi (Wireless)
                    if ('wi-fi' in name or 'wireless' in desc or '무선' in name or '무선' in desc) and 'virtual' not in desc:
                        wifi_idx = idx
                        wifi_name = adp.get('Name')
                        continue 

                    # [Bug 5] 2. Identify Wired LAN (Physical Ethernet, NOT tethering)
                    # Excludes known tethering keywords. BusType=5 is PCI (physical NIC)
                    is_physical_wired = False
                    if bus == 5 and not any(k in desc for k in ['samsung', 'apple', 'rndis', 'remote ndis', 'mobile', 'tether', 'ndis']):
                        # PCI adapter with no tethering fingerprint = Wired LAN
                        if any(k in desc for k in ['realtek', 'intel', 'ethernet', 'gigabit', 'lan', 'pcie']):
                            is_physical_wired = True
                    if is_physical_wired:
                        wired_idx = idx
                        wired_name = adp.get('Name')
                        logger.debug(f"✅ Identified Wired LAN (PCI): {wired_name} ({desc})")
                        continue

                    # 3. Identify LTE/Tethering (Priority: USB or Known Driver)
                    is_known_lte = False
                    if any(k in desc for k in ['samsung', 'apple', 'rndis', 'remote ndis', 'mobile', 'remote', 'ndis', 'tether']):
                        is_known_lte = True
                    elif bus == 15: # USB 
                        is_known_lte = True
                    elif '이더넷' in adp.get('Name') or 'ethernet' in name:
                        # If it's a secondary Ethernet, it might be the phone
                        generic_candidates.append((idx, adp.get('Name')))
                        
                    if is_known_lte:
                        lte_idx = idx
                        # [Bug 4] lte_name에 실제 OS Alias만 저장 (접미사 오염 금지)
                        lte_name = adp.get('Name')
                        logger.debug(f"✅ Identified LTE via Driver/Bus: {lte_name} ({desc})")
                        continue

                    # 4. Generic active adapters (Potential LTE if unidentified)
                    generic_candidates.append((idx, adp.get('Name')))

                # Fallback: IP Signature Matching
                if lte_idx is None and generic_candidates:
                    for cand in generic_candidates:
                        c_idx, c_name = cand
                        ip_res = self._get_ip_info(c_idx)
                        # [Bug 5] 192.168.1. 제거 (공유기 대역과 충돌 방지)
                        if ip_res and any(p in ip_res for p in ["192.168.42.", "172.20.10.", "192.168.43.", "192.168.49.", "192.168.100."]):
                            lte_idx = c_idx
                            # [Bug 4] 실제 Alias만 저장, 디버그 정보는 로그로
                            lte_name = c_name
                            logger.debug(f"🎯 IP-Match Identified LTE: {lte_name} (ip={ip_res})")
                            break
                    
                # Final fallback: If still nothing, pick the first active non-wifi/non-wired
                if lte_idx is None and generic_candidates:
                    lte_idx, lte_name = generic_candidates[0]
                    # [Bug 4] Fallback에서도 실제 Alias만 저장 (접미사 붙이지 않음)
                    logger.debug(f"[⚠️ Fallback] 실리주의: Active-Fallback LTE: {lte_name}")
            
            except Exception as e:
                logger.error(f"Adapter Parse Error: {e}")

        # Step 2: Get Route Metrics (Actual active metrics)
        # [FIX] Use portable temp directory
        temp_dir = tempfile.gettempdir()
        dump_file = os.path.join(temp_dir, f"net_routes_{os.getpid()}.json")
        
        # [FIX] Skip PowerShell logic if not on Windows
        if sys.platform != 'win32':
            # logger.debug("Skipping Windows-specific Network Enforcement on Linux.")
            return

        safe_route_cmd = f"Get-NetRoute | Select-Object InterfaceIndex, DestinationPrefix, RouteMetric | ConvertTo-Json -Compress | Out-File -FilePath '{dump_file}' -Encoding UTF8"
        
        # Execute via PowerShell
        ps_path = os.getenv("POWERSHELL_PATH", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
        route_map = {} # Index -> {Metric_v4, Metric_v6}
        
        try:
             subprocess.run([ps_path, "-Command", safe_route_cmd], check=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=5)
             
             # Read the Dump (Verify Path First)
             if os.path.exists(dump_file):
                with open(dump_file, 'r', encoding='utf-8-sig') as f:
                    content = f.read().strip()
                    if content:
                        data = json.loads(content)
                        if not isinstance(data, list): data = [data]
                        for r in data:
                            idx = r.get('InterfaceIndex')
                            met = r.get('RouteMetric')
                            pfx = r.get('DestinationPrefix')
                            
                            if idx not in route_map: route_map[idx] = {'v4': -1, 'v6': -1}
                            if '0.0.0.0' in pfx: route_map[idx]['v4'] = met
                            elif '::' in pfx: route_map[idx]['v6'] = met
                            
        except (subprocess.TimeoutExpired, Exception) as e:
             logger.warning(f"Route Dump Failed ({e}). Falling back to Interface Metrics.")
             # Fallback: Get Configured Interface Metrics
             try:
                 fb_cmd = "Get-NetIPInterface | Select-Object InterfaceIndex, InterfaceMetric | ConvertTo-Json -Compress"
                 fb_res = subprocess.run([ps_path, "-Command", fb_cmd], capture_output=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW)
                 if fb_res.returncode == 0:
                     fb_data = json.loads(fb_res.stdout.decode('utf-8', errors='ignore'))
                     if not isinstance(fb_data, list): fb_data = [fb_data]
                     for r in fb_data:
                         idx = r.get('InterfaceIndex')
                         met = r.get('InterfaceMetric')
                         # Treat configured metric as both v4/v6 estimate
                         route_map[idx] = {'v4': met, 'v6': met}
             except Exception as fb_e:
                 logger.error(f"Fallback Parse Error: {fb_e}")

        # Update State with REAL (or Fallback) metrics
        now_str = datetime.now().strftime("%H:%M:%S")

        # Update current_status for Wi-Fi
        if wifi_idx:
            wifi_metric_v4 = route_map.get(wifi_idx, {}).get('v4', -1)
            wifi_metric_v6 = route_map.get(wifi_idx, {}).get('v6', -1)
            
            # If both are -1, it might be isolated or no route.
            if wifi_metric_v4 == -1 and wifi_metric_v6 == -1:
                wifi_status = "Isolated"
                wifi_metric = "Isolated" # Store string for display
            else:
                # Prioritize v4 metric, fallback to v6 if v4 is -1
                wifi_metric = wifi_metric_v4 if wifi_metric_v4 != -1 else wifi_metric_v6
                wifi_status = "Connected" if wifi_metric != -1 else "No-Route"
            
            # Retrieve IP address for cache
            wifi_ip = self._get_ip_info(wifi_idx)
            
            self.current_status['wifi'] = {
                "name": wifi_name,
                "index": wifi_idx,
                "metric": wifi_metric,
                "status": wifi_status,
                "ip": wifi_ip
            }
        else:
            self.current_status['wifi'] = {"name": "Disconnected", "index": None, "metric": -1, "status": "Disconnected", "ip": ""}

        # Update current_status for Wired LAN
        if wired_idx:
            wired_metric_v4 = route_map.get(wired_idx, {}).get('v4', -1)
            wired_metric_v6 = route_map.get(wired_idx, {}).get('v6', -1)

            if wired_metric_v4 == -1 and wired_metric_v6 == -1:
                wired_status = "Isolated"
                wired_metric = "Isolated"
            else:
                wired_metric = wired_metric_v4 if wired_metric_v4 != -1 else wired_metric_v6
                wired_status = "Connected" if wired_metric != -1 else "No-Route"

            wired_ip = self._get_ip_info(wired_idx)

            self.current_status['wired'] = {
                "name": wired_name,
                "index": wired_idx,
                "metric": wired_metric,
                "status": wired_status,
                "ip": wired_ip
            }
        else:
            self.current_status['wired'] = {"name": "Disconnected", "index": None, "metric": -1, "status": "Disconnected", "ip": ""}

        # Update current_status for LTE
        if lte_idx:
            lte_metric_v4 = route_map.get(lte_idx, {}).get('v4', -1)
            lte_metric_v6 = route_map.get(lte_idx, {}).get('v6', -1)

            if lte_metric_v4 == -1 and lte_metric_v6 == -1:
                lte_status = "Isolated"
                lte_metric = "Isolated"
            else:
                lte_metric = lte_metric_v4 if lte_metric_v4 != -1 else lte_metric_v6
                lte_status = "Connected" if lte_metric != -1 else "No-Route"

            lte_ip = self._get_ip_info(lte_idx)

            self.current_status['lte'] = {
                "name": lte_name,
                "index": lte_idx,
                "metric": lte_metric,
                "status": lte_status,
                "ip": lte_ip
            }
        else:
            self.current_status['lte'] = {"name": "Disconnected", "index": None, "metric": -1, "status": "Disconnected", "ip": ""}

        self.current_status['last_check'] = now_str
        
        logger.debug(f"Current Status: {self.current_status}")

        # Enforcement Logic
        if self.current_status['enforcement_active'] and getattr(self, 'is_admin', False):
            self._enforce_rules(wifi_idx, wired_idx, lte_idx)
        elif self.current_status['enforcement_active'] and not getattr(self, 'is_admin', False):
            logger.debug("Skipping routing enforcement because process is running with standard privileges.")

    def _enforce_rules(self, wifi_idx, wired_idx, lte_idx):
        # Rule: System Main = 10 (Wired priority), Secondary System = 20, LTE = 50
        
        # 1. Wired LAN (Priority 1)
        if wired_idx:
             # Wired is always King if present
             target = 10
             cur = self.current_status['wired']['metric']
             name = self.current_status['wired']['name']
             
             # Enforce if wrong OR if we just want to be sure (since "0" or "256" persists)
             if cur != -1: # Always enforce if active
                 logger.debug(f"🔧 Enforcing Wired Metric: 10 (via PS + netsh)")
                 # PowerShell Method
                 _, success, err = self._run_ps(f"Set-NetIPInterface -InterfaceIndex {wired_idx} -InterfaceMetric {target} -AutomaticMetric Disabled")
                 if not success and ("AccessDenied" in err or "액세스가 거부" in err):
                     self.fix_metrics_elevated(is_automatic=True)
                     return
                 # NETSH Method (Backup for robustness)
                 if name and name != "Not Found":
                      NETSH_PATH = os.getenv("NETSH_PATH", r"C:\Windows\System32\netsh.exe")
                      netsh_cmd = f'{NETSH_PATH} interface ip set interface "{name}" metric={target}'
                      self._run_ps(netsh_cmd)

        # 2. Wi-Fi (Priority 2)
        if wifi_idx:
             # If Wired exists, Wi-Fi gets 20. Else 10.
             target = 20 if wired_idx else 10
             cur = self.current_status['wifi']['metric']
             name = self.current_status['wifi']['name']
             
             if cur != -1: 
                  logger.debug(f"🔧 Enforcing Wi-Fi Metric: {target} (via PS + netsh) on {name}")
                  # PowerShell Method
                  _, success, err = self._run_ps(f"Set-NetIPInterface -InterfaceIndex {wifi_idx} -InterfaceMetric {target} -AutomaticMetric Disabled")
                  if not success and ("AccessDenied" in err or "액세스가 거부" in err):
                      self.fix_metrics_elevated(is_automatic=True)
                      return

                  # NETSH Method
                  if name and name != "Not Found":
                       NETSH_PATH = os.getenv("NETSH_PATH", r"C:\Windows\System32\netsh.exe")
                       netsh_cmd = f'{NETSH_PATH} interface ip set interface "{name}" metric={target}'
                       self._run_ps(netsh_cmd)


        # 3. LTE 
        cur_l = self.current_status['lte']['metric']
        # Only fix if it exists (not isolated) and is wrong
        is_isolated = (isinstance(cur_l, str) and cur_l in ["Isolated", "No-Route"])
        
        # [Safety] If LTE is 0 or -1 (Unknown), don't touch it to avoid disconnect.
        if lte_idx and not is_isolated and cur_l != self.LTE_METRIC_TARGET and str(cur_l) != "0":
             logger.debug(f"🔧 Fixing LTE Metric: {cur_l} -> {self.LTE_METRIC_TARGET}")
             
             # Force Metric 50. DO NOT DELETE ROUTES.
             cmds = [
                 f"Set-NetIPInterface -InterfaceIndex {lte_idx} -InterfaceMetric {self.LTE_METRIC_TARGET} -AutomaticMetric Disabled"
             ]
             _, success, err = self._run_ps("; ".join(cmds))
             if not success and ("AccessDenied" in err or "액세스가 거부" in err):
                 self.fix_metrics_elevated(is_automatic=True)

    def toggle_enforcement(self, enable: bool):
        self.current_status['enforcement_active'] = enable
        return self.current_status

    def _check_and_enforce_linux(self):
        """Linux implementation using 'ip route' and 'ip addr'"""
        try:
            from .adb_service import adb_service
            lte_iface = adb_service._find_tethering_interface()
            wifi_iface = "eth0" # Common default for WSL2/Docker
            
            # 1. Get current default routes and metrics
            result = subprocess.run(["ip", "route", "show", "default"], capture_output=True, text=True)
            routes = result.stdout.splitlines()
            
            status = {
                "wifi": {"name": wifi_iface, "metric": -1, "status": "Disconnected"},
                "lte": {"name": lte_iface or "Disconnected", "metric": -1, "status": "Disconnected"},
                "last_check": datetime.now().strftime("%H:%M:%S"),
                "enforcement_active": self.current_status.get("enforcement_active", True),
                "system_gateway_mode": self.current_status.get("system_gateway_mode", "WIFI")
            }
            
            gateways = {} # iface -> gateway_ip
            
            for line in routes:
                # Example: default via 172.26.112.1 dev eth0 proto kernel metric 100
                parts = line.split()
                if "dev" in parts:
                    idx = parts.index("dev")
                    iface = parts[idx+1]
                    gw = parts[parts.index("via")+1] if "via" in parts else None
                    metric = int(parts[parts.index("metric")+1]) if "metric" in parts else 0
                    
                    gateways[iface] = gw
                    if iface == wifi_iface:
                        status["wifi"].update({"metric": metric, "status": "Connected"})
                    elif iface == lte_iface:
                        status["lte"].update({"metric": metric, "status": "Connected"})

            self.current_status.update(status)
            
            # 2. Enforcement & Mode Detection (Bridge-mode Friendly)
            # If public IP is from a mobile carrier (223.x, 211.x, 1.x etc), it's LTE
            is_lte_ip = False
            adb_devices = adb_service.list_devices()
            adb_connected = len(adb_devices) > 0
            
            if adb_connected:
                mobile_ip = adb_service.get_current_ip()
                # 간단한 통신사 IP 대역 필터 (한국 기준)
                if mobile_ip.startswith(("223.", "211.", "1.", "14.", "117.", "114.")):
                    is_lte_ip = True
            
            if status["enforcement_active"]:
                wifi_target = self.WIFI_METRIC_TARGET
                lte_target = self.LTE_METRIC_TARGET
                
                # ... (Routing logic remains for host-mode compatibility) ...
                if wifi_iface in gateways and status["wifi"]["metric"] != wifi_target:
                    gw = gateways[wifi_iface]
                    subprocess.run(["ip", "route", "replace", "default", "via", gw, "dev", wifi_iface, "metric", str(wifi_target)])
                
                # Update system_gateway_mode state based on REAL IP detection
                if is_lte_ip:
                    self.current_status["system_gateway_mode"] = "LTE"
                else:
                    self.current_status["system_gateway_mode"] = "WIFI"

        except Exception as e:
            logger.error(f"Linux Network Monitor Error: {e}")

    def fix_metrics_elevated(self, is_automatic=False):
        """Elevated fix for both Windows and Linux"""
        if sys.platform != 'win32':
            logger.info("🛡️ [Linux] Triggering Network Fix (Enforcement Loop)")
            self._check_and_enforce_linux()
            return True, "Linux Network Fix Triggered"
            
        # If running automatically in the background and we are not admin,
        # DO NOT spam UAC elevation prompts! Only do it on explicit user interaction.
        if is_automatic and not getattr(self, 'is_admin', False):
            import time as pytime
            now = pytime.time()
            if now - getattr(self, 'last_elevation_request', 0) < 1800: # 30 mins
                return False, "Access Denied (Non-Admin & Cooldown)"
            self.last_elevation_request = now
            logger.debug("Access Denied: Enforcing network metrics requires administrator privileges. Skipping automatic UAC prompt in background.")
            return False, "Access Denied (Non-Admin)"

        # [Windows Native Turbo Fix]
        cmds = []
        
        # 1. Policy Fix: Prevent Windows from auto-disconnecting Wi-Fi when Ethernet (Tethering) is plugged in
        policy_path = 'HKLM:\\Software\\Policies\\Microsoft\\Windows\\WcmSvc\\GroupPolicy'
        cmds.append(f"if (-not (Test-Path '{policy_path}')) {{ New-Item '{policy_path}' -Force }}")
        cmds.append(f"New-ItemProperty -Path '{policy_path}' -Name 'fMinimizeConnections' -PropertyType DWord -Value 0 -Force -ErrorAction SilentlyContinue")
        
        # 2. Priority Fix (Metric)
        # Identify adapters again to be sure
        wifi = self.current_status.get('wifi')
        wired = self.current_status.get('wired')
        lte = self.current_status.get('lte')

        # Main Internet (Wired/Wi-Fi) -> Priority 10
        if wired and wired.get('index'):
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {wired['index']} -InterfaceMetric {self.WIRED_METRIC_TARGET} -AutomaticMetric Disabled")
        
        if wifi and wifi.get('index'):
            # Re-enable just in case
            cmds.append(f"Enable-NetAdapter -Name '{wifi['name']}' -Confirm:$false -ErrorAction SilentlyContinue")
            target = self.WIFI_SECONDARY_METRIC_TARGET if (wired and wired.get('index')) else self.WIFI_METRIC_TARGET
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {wifi['index']} -InterfaceMetric {target} -AutomaticMetric Disabled")
            # [Bug 8] Wi-Fi IPv6 비활성화 — IPv6를 통한 IP 누수 원천 차단
            if wifi.get('name'):
                cmds.append(f"Disable-NetAdapterBinding -Name '{wifi['name']}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue")
        
        # Wired LAN IPv6 비활성화
        if wired and wired.get('index') and wired.get('name'):
            cmds.append(f"Disable-NetAdapterBinding -Name '{wired['name']}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue")

        # 3. LTE -> Priority 50 (Last)
        if lte and lte.get('index'):
            if lte.get('name'):
                cmds.append(f"Enable-NetAdapter -Name '{lte['name']}' -Confirm:$false -ErrorAction SilentlyContinue")
                cmds.append(f"Disable-NetAdapterBinding -Name '{lte['name']}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue")
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {lte['index']} -AddressFamily IPv4 -InterfaceMetric {self.LTE_METRIC_TARGET} -AutomaticMetric Disabled -ErrorAction SilentlyContinue")
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {lte['index']} -AddressFamily IPv6 -InterfaceMetric {self.LTE_METRIC_TARGET} -AutomaticMetric Disabled -ErrorAction SilentlyContinue")
             
        if not cmds:
            return False, "No active interfaces to configure"

        # Join commands and execute via Elevated PowerShell
        raw_cmd = "; ".join(cmds)
        logger.info(f"🛡️ Triggering Elevated Network Fix: {raw_cmd}")
        
        # Base64 Encode for PowerShell safety
        encoded_cmd = base64.b64encode(raw_cmd.encode('utf-16le')).decode('utf-8')
        launcher_cmd = f"Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -EncodedCommand {encoded_cmd}' -Wait"
        
        ps_path = os.getenv("POWERSHELL_PATH", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
        try:
             subprocess.run([ps_path, "-Command", launcher_cmd], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
             return True, "UAC Prompt Triggered"
        except Exception as e:
             logger.error(f"Elevation Failed: {e}")
             return False, str(e)

    def get_status(self):
        return self.current_status

network_monitor = NetworkMonitor()
