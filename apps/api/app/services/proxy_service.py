import logging
import threading
import socket
import select
from socketserver import ThreadingMixIn, TCPServer, StreamRequestHandler
from app.services.adb_service import adb_service

def proxy_print(msg):
    print(f"🔵 [PROXY_DEBUG] {msg}")
    try:
        with open("proxy_debug.log", "a", encoding="utf-8") as f:
            f.write(f"🔵 [PROXY_DEBUG] {msg}\n")
    except: pass

logger = logging.getLogger("ProxyService")

class ThreadingTCPServer(ThreadingMixIn, TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def recvall(sock, n):
    data = b''
    while len(data) < n:
        packet = sock.recv(n - len(data))
        if not packet: return None
        data += packet
    return data

class Socks5Handler(StreamRequestHandler):
    def handle(self):
        try:
            proxy_print(f"새로운 연결 요청 들어옴: {self.client_address}")
            
            header = recvall(self.connection, 2)
            if not header:
                proxy_print("❌ Handshake Fail: Empty Initial Header (Client disconnected or sent 0 bytes)")
                return
            if header[0] != 5:
                proxy_print(f"❌ Handshake Fail: Invalid SOCKS Version {header[0]}")
                return
            self.connection.send(b"\x05\x00")
            
            header = recvall(self.connection, 4)
            if not header or header[1] != 1:
                proxy_print("❌ Handshake Fail: Invalid Request Header")
                return 
            
            addr_type = header[3]
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

            # --- 바인딩 로직 (Network Core Strategy: Soft Bind) ---
            remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            remote.settimeout(10) 

            # ADB 서비스에게 IP를 물어봄
            lte_ip = adb_service.get_tethering_interface_ip(use_cache=True)
            
            is_bound = False
            if lte_ip and "169.254" not in lte_ip and lte_ip not in ["Not Detected", "Error"]:
                try:
                    proxy_print(f"⚡ LTE 바인딩 시도: {lte_ip} -> {addr}:{port}")
                    remote.bind((lte_ip, 0))
                    is_bound = True
                    proxy_print("  -> 바인딩 성공! (Tunnel Established)")
                except Exception as e:
                    # [Soft Fail] network_core.py 처럼 실패해도 진행
                    proxy_print(f"⚠️ 바인딩 실패 (Wifi로 우회됨): {e}")
            else:
                proxy_print(f"⚠️ LTE IP 없음 ({lte_ip}) - Wifi로 진행")

            remote.connect((addr, port))
            bind_addr, bind_port = remote.getsockname()
            addr_ip = socket.inet_aton(bind_addr)
            self.connection.send(b"\x05\x00\x00\x01" + addr_ip + int(bind_port).to_bytes(2, 'big'))
            self.pipe(self.connection, remote)
            
        except Exception as e:
            proxy_print(f"핸들러 에러: {e}")
        finally:
            # self.connection might be closed already, but check safe ensure
            try: self.connection.close() 
            except: pass

    def pipe(self, client, remote):
        try:
            while True:
                r, _, _ = select.select([client, remote], [], [], 30)
                if client in r:
                    data = client.recv(4096)
                    if not data: break
                    remote.sendall(data)
                if remote in r:
                    data = remote.recv(4096)
                    if not data: break
                    client.sendall(data)
        except: pass
        finally:
            client.close()
            remote.close()

class ProxyService:
    def __init__(self):
        self.host = '127.0.0.1'
        self.port = 10800
        self.server = None

    def start(self):
        if self.server: return
        try:
            proxy_print("프록시 서버 시작 시도...")
            self.server = ThreadingTCPServer((self.host, self.port), Socks5Handler)
            self.thread = threading.Thread(target=self.server.serve_forever)
            self.thread.daemon = True
            self.thread.start()
            proxy_print(f"✅ SOCKS5 서버 가동 중 (Port: {self.port})")
        except Exception as e:
            proxy_print(f"❌ 서버 시작 실패: {e}")

proxy_service = ProxyService()