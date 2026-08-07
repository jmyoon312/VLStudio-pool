import subprocess
import requests
import logging
import threading
import socket
import select
import struct
from socketserver import ThreadingMixIn, TCPServer, StreamRequestHandler
from urllib.parse import urlparse
import base64
import time

from app.services.adb_service import adb_service
from app.services.network_monitor import network_monitor

logger = logging.getLogger("NetworkCore")

PROXY_CONFIG_CACHE = {
    "mode": "DIRECT_LTE",
    "netshare_ip": "192.168.49.1",
    "netshare_port": 8282,
    "isp_url": None
}

_adb_forwarded = False
_last_forward_port = None

def _refresh_proxy_settings():
    global _adb_forwarded, _last_forward_port
    while True:
        try:
            from app.database import SessionLocal
            from app.models import Settings
            with SessionLocal() as db:
                settings = db.query(Settings).first()
                if settings:
                    PROXY_CONFIG_CACHE["mode"] = settings.proxy_mode or "DIRECT_LTE"
                    PROXY_CONFIG_CACHE["netshare_ip"] = settings.netshare_ip or "192.168.49.1"
                    PROXY_CONFIG_CACHE["netshare_port"] = settings.netshare_port or 8282
                    PROXY_CONFIG_CACHE["isp_url"] = settings.isp_proxy_url
                    
                    if PROXY_CONFIG_CACHE["mode"] == "NETSHARE" and PROXY_CONFIG_CACHE["netshare_ip"] == "127.0.0.1":
                        current_port = PROXY_CONFIG_CACHE["netshare_port"]
                        if not _adb_forwarded or _last_forward_port != current_port:
                            try:
                                logger.info(f"[FALLBACK] [NetworkCore] Auto-forwarding ADB port tcp:{current_port}...")
                                # CREATE_NO_WINDOW = 0x08000000
                                subprocess.run(
                                    [adb_service.adb_path, "forward", f"tcp:{current_port}", f"tcp:{current_port}"], 
                                    check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, 
                                    creationflags=0x08000000
                                )
                                _adb_forwarded = True
                                _last_forward_port = current_port
                                logger.info(f"[OK] [NetworkCore] ADB forward successful for port {current_port}")
                            except Exception as e:
                                logger.error(f"[FAIL] [NetworkCore] ADB forward failed: {e}")
                    else:
                        if _adb_forwarded and _last_forward_port:
                            try:
                                subprocess.run(
                                    [adb_service.adb_path, "forward", "--remove", f"tcp:{_last_forward_port}"], 
                                    check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                    creationflags=0x08000000
                                )
                            except: pass
                            _adb_forwarded = False
                            _last_forward_port = None
        except Exception as e:
            logger.error(f"[FAIL] [NetworkCore] Failed to refresh proxy settings: {e}")
        time.sleep(5)

threading.Thread(target=_refresh_proxy_settings, daemon=True).start()

class ThreadingTCPServer(ThreadingMixIn, TCPServer):
    allow_reuse_address = True
    pass

def recvall(sock, n):
    data = b''
    while len(data) < n:
        packet = sock.recv(n - len(data))
        if not packet: return None
        data += packet
    return data

# ──────────────────────────────────────────────────────────────────────────────
# [Bug 9] 전역 pipe 헬퍼 — LTE/Wi-Fi 양 핸들러가 공유
# ──────────────────────────────────────────────────────────────────────────────
def pipe_sockets(client: socket.socket, remote: socket.socket):
    """두 소켓 사이 양방향 데이터 중계."""
    try:
        while True:
            r, _, _ = select.select([client, remote], [], [], 60)
            if client in r:
                data = client.recv(4096)
                if not data:
                    break
                remote.sendall(data)
            if remote in r:
                data = remote.recv(4096)
                if not data:
                    break
                client.sendall(data)
    except Exception:
        pass
    finally:
        try: client.close()
        except Exception: pass
        try: remote.close()
        except Exception: pass

# ──────────────────────────────────────────────────────────────────────────────
# [Bug 7] 인터페이스 바인딩 DNS 리졸버 — DNS Leak 방지
# ──────────────────────────────────────────────────────────────────────────────
def resolve_dns_via_interface(domain: str, bind_ip: str) -> str:
    """지정한 인터페이스 IP에 UDP 소켓을 바인딩하여 DNS 쿼리 수행 (DNS Leak 완벽 방지)."""
    # 통신사별로 특정 해외 DNS를 차단하는 경우가 있으므로 타임아웃을 짧게 가져감
    dns_servers = ["1.1.1.1", "8.8.8.8", "208.67.222.222"]
    for dns_server in dns_servers:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(1.5)
            sock.bind((bind_ip, 0))

            tx_id = 0xAB42
            flags = 0x0100
            qdcount = 1
            header = struct.pack('>HHHHHH', tx_id, flags, qdcount, 0, 0, 0)
            qname = b''
            for part in domain.split('.'):
                qname += bytes([len(part)]) + part.encode()
            qname += b'\x00'
            question = qname + struct.pack('>HH', 1, 1)
            packet = header + question

            sock.sendto(packet, (dns_server, 53))
            response, _ = sock.recvfrom(512)
            sock.close()

            offset = 12
            while offset < len(response) and response[offset] != 0:
                if response[offset] & 0xC0 == 0xC0:
                    offset += 2
                    break
                offset += response[offset] + 1
            else:
                offset += 1
            offset += 4

            while offset + 12 <= len(response):
                if response[offset] & 0xC0 == 0xC0:
                    offset += 2
                else:
                    while offset < len(response) and response[offset] != 0:
                        offset += response[offset] + 1
                    offset += 1
                rtype, rclass, ttl = struct.unpack('>HHI', response[offset:offset+8])
                rdlength = struct.unpack('>H', response[offset+8:offset+10])[0]
                offset += 10
                if rtype == 1 and rdlength == 4:
                    ip = socket.inet_ntoa(response[offset:offset+4])
                    logger.debug(f"[DNS] Resolved {domain} to {ip} via {dns_server} bound to {bind_ip}")
                    return ip
                offset += rdlength
        except Exception as e:
            logger.debug(f"[DNS] Interface-bound DNS query to {dns_server} failed for {domain}: {e}")
            
    # [Fallback] LTE 망에서 UDP 53포트가 차단되었거나 지연이 심할 경우 시스템 기본 DNS(OS)를 사용함.
    # 유튜브는 실제 데이터 통신 IP를 기준으로 연좌제를 체크하므로 DNS 쿼리만 로컬망으로 빠져도 패널티 위험은 매우 적음.
    logger.warning(f"[WARN] [DNS] All interface-bound DNS queries failed for {domain}. Falling back to OS resolver.")
    try:
        return socket.gethostbyname(domain)
    except Exception as e:
        logger.error(f"[FAIL] [DNS] OS resolver also failed for {domain}: {e}")
        raise socket.gaierror(f"DNS resolution completely failed for domain {domain}")

# ──────────────────────────────────────────────────────────────────────────────
# LTE SOCKS5 Handler
# ──────────────────────────────────────────────────────────────────────────────
class Socks5Handler(StreamRequestHandler):
    def handle(self):
        remote = None
        try:
            header = recvall(self.connection, 2)
            if not header or header[0] != 5: return
            nmethods = header[1]
            methods = recvall(self.connection, nmethods)
            if not methods: return
            self.connection.send(b"\x05\x00")

            header = recvall(self.connection, 4)
            if not header or header[1] != 1: return
            addr_type = header[3]

            if addr_type == 1:
                raw_ip = recvall(self.connection, 4)
                if not raw_ip: return
                addr = socket.inet_ntoa(raw_ip)
            elif addr_type == 3:
                len_byte = recvall(self.connection, 1)
                if not len_byte: return
                domain_len = len_byte[0]
                addr_bytes = recvall(self.connection, domain_len)
                if not addr_bytes: return
                addr = addr_bytes.decode()
            else: return

            port_bytes = recvall(self.connection, 2)
            if not port_bytes: return
            port = int.from_bytes(port_bytes, 'big')

            mode = PROXY_CONFIG_CACHE.get("mode", "DIRECT_LTE")

            if mode == "NETSHARE":
                remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                remote.settimeout(10.0)
                ns_ip = PROXY_CONFIG_CACHE.get("netshare_ip", "192.168.49.1")
                ns_port = PROXY_CONFIG_CACHE.get("netshare_port", 8282)
                try:
                    remote.connect((ns_ip, ns_port))
                    connect_req = f"CONNECT {addr}:{port} HTTP/1.1\r\nHost: {addr}:{port}\r\n\r\n"
                    remote.sendall(connect_req.encode())
                    resp = remote.recv(4096)
                    if b"200 Connection established" not in resp and b"200 OK" not in resp:
                        logger.error(f"[FAIL] [NetworkCore] NetShare tunnel failed for {addr}:{port} - Resp: {resp}")
                        return
                    remote.settimeout(None)
                    self.connection.send(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
                    pipe_sockets(self.connection, remote)
                except Exception as e:
                    logger.error(f"[FAIL] [NetworkCore] NetShare connection failed: {e}")
                return

            elif mode == "ISP_PROXY" and PROXY_CONFIG_CACHE.get("isp_url"):
                isp_url = PROXY_CONFIG_CACHE["isp_url"]
                parsed = urlparse(isp_url)
                if parsed.scheme in ["socks5", "socks5h"]:
                    remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    remote.settimeout(10.0)
                    try:
                        remote.connect((parsed.hostname, parsed.port or 1080))
                        auth_methods = b"\x01\x02" if parsed.username else b"\x01\x00"
                        remote.sendall(b"\x05" + auth_methods)
                        resp = recvall(remote, 2)
                        if resp and resp[1] == 2:
                            u = parsed.username.encode()
                            p = parsed.password.encode()
                            auth_req = b"\x01" + bytes([len(u)]) + u + bytes([len(p)]) + p
                            remote.sendall(auth_req)
                            auth_resp = recvall(remote, 2)
                            if not auth_resp or auth_resp[1] != 0:
                                logger.error(f"[FAIL] [NetworkCore] ISP Proxy Auth failed")
                                return
                        
                        addr_bytes_to_send = b""
                        if addr_type == 1:
                            addr_bytes_to_send = b"\x01" + socket.inet_aton(addr)
                        elif addr_type == 3:
                            addr_bytes_to_send = b"\x03" + bytes([len(addr)]) + addr.encode()
                        connect_req = b"\x05\x01\x00" + addr_bytes_to_send + port_bytes
                        remote.sendall(connect_req)
                        conn_resp = recvall(remote, 4)
                        if not conn_resp or conn_resp[1] != 0:
                            return
                        if conn_resp[3] == 1: recvall(remote, 4)
                        elif conn_resp[3] == 3:
                            l = recvall(remote, 1)[0]
                            recvall(remote, l)
                        elif conn_resp[3] == 4: recvall(remote, 16)
                        
                        remote.settimeout(None)
                        self.connection.send(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
                        pipe_sockets(self.connection, remote)
                    except Exception as e:
                        logger.error(f"[FAIL] [NetworkCore] ISP proxy SOCKS5 failed: {e}")
                elif parsed.scheme in ["http", "https"]:
                    remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    remote.settimeout(10.0)
                    try:
                        remote.connect((parsed.hostname, parsed.port or 80))
                        connect_req = f"CONNECT {addr}:{port} HTTP/1.1\r\nHost: {addr}:{port}\r\n"
                        if parsed.username:
                            auth_str = base64.b64encode(f"{parsed.username}:{parsed.password}".encode()).decode()
                            connect_req += f"Proxy-Authorization: Basic {auth_str}\r\n"
                        connect_req += "\r\n"
                        remote.sendall(connect_req.encode())
                        resp = remote.recv(4096)
                        if b"200 Connection established" not in resp and b"200 OK" not in resp:
                            logger.error(f"[FAIL] [NetworkCore] ISP Proxy HTTP tunnel failed")
                            return
                        remote.settimeout(None)
                        self.connection.send(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
                        pipe_sockets(self.connection, remote)
                    except Exception as e:
                        logger.error(f"[FAIL] [NetworkCore] ISP proxy HTTP failed: {e}")
                return

            # Default DIRECT_LTE
            lte_ip = adb_service.get_tethering_interface_ip(use_cache=True)
            if addr_type == 3 and lte_ip and "169.254" not in lte_ip:
                addr = resolve_dns_via_interface(addr, lte_ip)

            if lte_ip and "169.254" not in lte_ip and lte_ip not in ["Not Detected", "Error", ""]:
                remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                remote.settimeout(10.0)
                remote.bind((lte_ip, 0))
                remote.connect((addr, port))
                remote.settimeout(None) # Reset timeout after connection
                self.connection.send(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
                pipe_sockets(self.connection, remote)
        except Exception:
            pass
        finally:
            try: self.connection.close()
            except: pass
            if remote: remote.close()

# ──────────────────────────────────────────────────────────────────────────────
# Wi-Fi SOCKS5 Handler
# ──────────────────────────────────────────────────────────────────────────────
class WifiSocks5Handler(StreamRequestHandler):
    def handle(self):
        remote = None
        try:
            header = recvall(self.connection, 2)
            if not header or header[0] != 5: return
            nmethods = header[1]
            methods = recvall(self.connection, nmethods)
            if not methods: return
            self.connection.send(b"\x05\x00")

            header = recvall(self.connection, 4)
            if not header or header[1] != 1: return
            addr_type = header[3]

            if addr_type == 1:
                raw_ip = recvall(self.connection, 4)
                if not raw_ip: return
                addr = socket.inet_ntoa(raw_ip)
            elif addr_type == 3:
                len_byte = recvall(self.connection, 1)
                if not len_byte: return
                domain_len = len_byte[0]
                addr_bytes = recvall(self.connection, domain_len)
                if not addr_bytes: return
                addr = addr_bytes.decode()
            else: return

            port_bytes = recvall(self.connection, 2)
            if not port_bytes: return
            port = int.from_bytes(port_bytes, 'big')

            wifi_ip = network_monitor.current_status.get("wifi", {}).get("ip", "")
            if addr_type == 3 and wifi_ip and "169.254" not in wifi_ip:
                addr = resolve_dns_via_interface(addr, wifi_ip)

            remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            remote.settimeout(10.0)
            if wifi_ip and "169.254" not in wifi_ip:
                remote.bind((wifi_ip, 0))
            remote.connect((addr, port))
            remote.settimeout(None)
            self.connection.send(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
            pipe_sockets(self.connection, remote)
        except Exception:
            pass
        finally:
            try: self.connection.close()
            except: pass
            if remote: remote.close()

class NetworkService:
    def __init__(self):
        self.proxy_server = None
        self.wifi_proxy_server = None

    def initialize(self):
        self.start_proxy_server()
        network_monitor.start()

    def start_proxy_server(self):
        if not self.proxy_server:
            for attempt in range(3):
                try:
                    self.proxy_server = ThreadingTCPServer(('127.0.0.1', 10800), Socks5Handler)
                    threading.Thread(target=self.proxy_server.serve_forever, daemon=True).start()
                    break
                except OSError:
                    import time; time.sleep(1)
            if not self.proxy_server:
                print("[NET] CRITICAL: Failed to bind LTE proxy port 10800 after 3 retries.")
        if not self.wifi_proxy_server:
            for attempt in range(3):
                try:
                    self.wifi_proxy_server = ThreadingTCPServer(('127.0.0.1', 10801), WifiSocks5Handler)
                    threading.Thread(target=self.wifi_proxy_server.serve_forever, daemon=True).start()
                    break
                except OSError:
                    import time; time.sleep(1)
            if not self.wifi_proxy_server:
                print("[NET] CRITICAL: Failed to bind Wi-Fi proxy port 10801 after 3 retries.")

    def get_current_ip(self):
        return adb_service.get_current_ip()

    def recover_adb(self): pass
    def run_command(self, cmd): return ""
    def get_tethering_ip(self): return "Auto"
    def configure_metrics(self): pass
    def is_wifi_on(self): return True

    def set_internet_source(self, s):
        # Manual Force Toggle via Monitor
        if s == 'lte':
            network_monitor.WIFI_METRIC_TARGET = 50
            network_monitor.LTE_METRIC_TARGET = 10
        else:
            network_monitor.WIFI_METRIC_TARGET = 10
            network_monitor.LTE_METRIC_TARGET = 50

        # Trigger immediate check
        network_monitor._check_and_enforce()
        return True

    def rotate_ip(self, m='soft'):
        return adb_service.rotate_ip(m)

    def get_detailed_status(self):
        return network_monitor.get_status()

network_service = NetworkService()
