import os
import sys
import platform
import subprocess
import logging
import json
from typing import Optional, List

logger = logging.getLogger(__name__)

class NetworkStealthManager:
    """
    ViraLoop Sovereign Stealth Manager (v2026)
    - Phase 1: Full-Tunnel Stealth (Total Isolation)
    """
    
    def __init__(self):
        self.is_windows = platform.system() == "Windows"
        self.lte_gateway: Optional[str] = None
        self.last_captain_id: Optional[str] = None
        self.original_wifi_metric: int = 25
        self.active_lte_iface: Optional[str] = None

    def _get_windows_lte_info(self) -> dict:
        """윈도우 호스트에서 LTE 어댑터 정보(Index, Name, Gateway) 추출"""
        import time
        for attempt in range(2):
            try:
                # 1. Get Adapter Details first
                ps_adp = "Get-NetAdapter | Where-Object { $_.InterfaceDescription -like '*SAMSUNG*' -or $_.InterfaceDescription -like '*Remote NDIS*' } | Select-Object Name, InterfaceIndex | ConvertTo-Json"
                adp_res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_adp], capture_output=True, text=True, encoding='utf-8', errors='ignore')
                
                if adp_res.returncode != 0 or not adp_res.stdout.strip():
                    time.sleep(1)
                    continue
                    
                try:
                    adp = json.loads(adp_res.stdout)
                except:
                    adp = {}
                    
                if isinstance(adp, list):
                    adp = adp[0]
                    
                idx = adp.get("InterfaceIndex")
                name = adp.get("Name")
                
                if not idx:
                    time.sleep(1)
                    continue
                    
                # 2. Get Gateway using the InterfaceIndex
                ps_gw = f"Get-NetRoute -DestinationPrefix '0.0.0.0/0' -InterfaceIndex {idx} | Select-Object -ExpandProperty NextHop"
                gw_res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_gw], capture_output=True, text=True, encoding='utf-8', errors='ignore')
                gw = gw_res.stdout.strip().splitlines()[0] if gw_res.returncode == 0 and gw_res.stdout.strip() else None
                
                if gw:
                    return {
                        "gateway": gw,
                        "index": idx,
                        "name": name
                    }
                logger.info(f"LTE Gateway not yet assigned (Attempt {attempt+1}/2), waiting...")
            except Exception as e:
                logger.error(f"❌ LTE 정보 획득 실패: {e}")
            
            time.sleep(1)
        return {}

    def prepare_upload_session(self, serial: Optional[str], captain_id: str):
        """[SAIF Phase 1] 업로드 세션 완전 격리 준비"""
        logger.info(f"🛡️ [SAIF-P1] Hardening network for Captain: {captain_id}")
        
        from app.services.adb_service import adb_service
        
        # 1. IP Rotation (선행 필수)
        success = adb_service.rotate_ip(serial)
        if not success:
            logger.error("❌ [SAIF-P1] IP Rotation failed. Safety breach risk. Aborting.")
            return False
            
        self.last_captain_id = captain_id
        
        # 2. Full-Tunnel Stealth 적용
        return self.apply_full_tunnel_stealth()

    def apply_full_tunnel_stealth(self):
        """[Windows Native] 전 영역 LTE 강제 터널링 및 IPv6 차단"""
        info = self._get_windows_lte_info()
        gw = info.get("gateway")
        idx = info.get("index")
        name = info.get("name")

        if not gw or not idx:
            logger.error("❌ LTE 인터페이스가 활성화되지 않아 보안 강화를 수행할 수 없습니다.")
            return False
            
        self.lte_gateway = gw
        self.active_lte_iface = name
        
        # Check if already isolated
        try:
            check_cmd = f"Get-NetIPInterface -InterfaceIndex {idx} -AddressFamily IPv4 | Select-Object -ExpandProperty InterfaceMetric"
            res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", check_cmd], capture_output=True, text=True, timeout=5)
            current_metric = int(res.stdout.strip())
            if current_metric == 1:
                logger.info(f"✅ [SAIF-P1] LTE (idx:{idx}) is already isolated (Metric=1). Skipping UAC elevation.")
                return True
        except Exception as e:
            logger.debug(f"Metric check failed: {e}")

        logger.info(f"🚀 [SAIF-P1] Activating Full-Tunnel on {name} (GW: {gw})")
        
        try:
            import base64
            import os
            
            cmds = []
            
            # A. IPv6 완전 차단 (Leakage 방지)
            cmds.append(f"Disable-NetAdapterBinding -Name '{name}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue")
            
            # B. Default Gateway Metric 조정 (LTE를 최우선으로)
            # 중요: vEthernet (WSL/Docker)은 제외해야 에이전트 통신이 유지됨
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {idx} -InterfaceMetric 1")
            cmds.append(f"Get-NetIPInterface | Where-Object {{ $_.InterfaceIndex -ne {idx} -and $_.InterfaceAlias -notlike '*vEthernet*' }} | Set-NetIPInterface -InterfaceMetric 1000")
            
            # C. DNS 고정 (구글 보안 DNS)
            cmds.append(f"Set-DnsClientServerAddress -InterfaceIndex {idx} -ServerAddresses ('8.8.8.8', '8.8.4.4')")
            
            raw_cmd = "; ".join(cmds)
            encoded_cmd = base64.b64encode(raw_cmd.encode('utf-16le')).decode('utf-8')
            elevate_cmd = f"Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded_cmd}' -Verb RunAs -WindowStyle Hidden -Wait"
            
            logger.info("Executing network configuration...")
            subprocess.run(["powershell.exe", "-NoProfile", "-Command", elevate_cmd], capture_output=True)
                
            logger.info("✅ [SAIF-P1] Full-Tunnel Isolation Command Issued. (Internal Comm Preserved)")
            return True
        except Exception as e:
            logger.error(f"❌ [SAIF-P1] 보안 강화 중 오류 발생: {e}")
            return False

    def reset_routing(self):
        """세션 종료 후 네트워크 원복"""
        if not self.active_lte_iface:
            return
            
        # Check if we should even reset (if it's already automatic, we don't need UAC)
        try:
            # We don't want to reset if it's managed by global network manager, but for safety we can just skip if we don't need it.
            # We'll just run it with UAC for now since session close is rare, or we can check metric first.
            pass
        except:
            pass

        logger.info("♻️ [SAIF-P1] 네트워크 복구 (WiFi 우선순위 환원 및 IPv6 복구)")
        try:
            import base64
            import os
            
            cmds = []
            
            # 1. IPv6 복구
            cmds.append(f"Enable-NetAdapterBinding -Name '{self.active_lte_iface}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue")
            
            # 2. 메트릭 원복 (LTE 50, 나머지 기본 25)
            idx_cmd = f"(Get-NetAdapter -Name '{self.active_lte_iface}').InterfaceIndex"
            cmds.append(f"Set-NetIPInterface -InterfaceIndex {idx_cmd} -InterfaceMetric 50")
            cmds.append(f"Get-NetIPInterface | Where-Object {{ $_.InterfaceIndex -ne {idx_cmd} -and $_.InterfaceAlias -notlike '*vEthernet*' }} | Set-NetIPInterface -InterfaceMetric 25")
            
            # 3. DNS 초기화
            cmds.append(f"Set-DnsClientServerAddress -InterfaceIndex (Get-NetAdapter -Name '{self.active_lte_iface}').InterfaceIndex -ResetServerAddresses")
            
            raw_cmd = "; ".join(cmds)
            encoded_cmd = base64.b64encode(raw_cmd.encode('utf-16le')).decode('utf-8')
            elevate_cmd = f"Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded_cmd}' -Verb RunAs -WindowStyle Hidden -Wait"
            
            logger.info("Executing network reset...")
            subprocess.run(["powershell.exe", "-NoProfile", "-Command", elevate_cmd], capture_output=True)
                
            logger.info("✅ [SAIF-P1] Network Reset Command Issued.")
            
        except Exception as e:
            logger.error(f"❌ [SAIF-P1] 네트워크 복구 중 오류 발생: {e}")
        
        self.lte_gateway = None
        self.active_lte_iface = None

# 싱글톤 인스턴스
network_stealth_manager = NetworkStealthManager()
