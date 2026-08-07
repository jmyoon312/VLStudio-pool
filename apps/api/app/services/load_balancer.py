"""
Load Balancer Service

Provides:
1. Multiple balancing algorithms
2. Health checking
3. Auto-scaling support
4. Session persistence
5. Failover handling

Usage:
    lb = LoadBalancer()
    
    # Add backend
    lb.add_backend("video-service", "http://localhost:8001", weight=10)
    lb.add_backend("video-service", "http://localhost:8002", weight=10)
    
    # Get backend
    backend = await lb.get_backend("video-service")
"""

import os
import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class LoadBalanceAlgorithm(Enum):
    """Load balancing algorithms"""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED = "weighted"
    IP_HASH = "ip_hash"
    RANDOM = "random"


class BackendStatus(Enum):
    """Backend status"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DRAINING = "draining"
    UNKNOWN = "unknown"


@dataclass
class Backend:
    """Backend server"""
    backend_id: str
    url: str
    weight: int = 1
    status: BackendStatus = BackendStatus.HEALTHY
    current_connections: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    avg_response_time: float = 0.0
    last_health_check: Optional[datetime] = None
    health_check_url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class HealthChecker:
    """Backend health checker"""
    
    def __init__(self, check_interval: int = 30):
        self._check_interval = check_interval
        self._running = False
    
    async def start(self, backends: Dict[str, Backend], callback: Callable):
        """Start health checking"""
        self._running = True
        
        while self._running:
            for backend_id, backend in backends.items():
                if backend.status == BackendStatus.DRAINING:
                    continue
                
                is_healthy = await self._check_health(backend)
                
                old_status = backend.status
                
                if is_healthy:
                    backend.status = BackendStatus.HEALTHY
                else:
                    backend.status = BackendStatus.UNHEALTHY
                
                backend.last_health_check = datetime.now()
                
                if old_status != backend.status:
                    await callback(backend_id, backend.status)
            
            await asyncio.sleep(self._check_interval)
    
    async def _check_health(self, backend: Backend) -> bool:
        """Check backend health"""
        import httpx
        
        try:
            url = backend.health_check_url or backend.url
            
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{url}/health")
                return response.status_code < 400
                
        except:
            return False
    
    def stop(self):
        """Stop health checking"""
        self._running = False


class LoadBalancer:
    """
    Load Balancer Service
    
    Features:
    - Multiple balancing algorithms
    - Health checking
    - Automatic failover
    - Session persistence
    - Metrics collection
    """
    
    def __init__(self):
        self._services: Dict[str, Dict[str, Backend]] = {}  # service -> backend_id -> Backend
        self._algorithm: LoadBalanceAlgorithm = LoadBalanceAlgorithm.ROUND_ROBIN
        self._counters: Dict[str, int] = {}  # service -> counter for round_robin
        
        # Health checker
        self._health_checker = HealthChecker()
        
        # Stats
        self._stats: Dict[str, Dict[str, Any]] = {}
        
        logger.info("LoadBalancer initialized")
    
    def add_backend(
        self,
        service: str,
        backend_id: str,
        url: str,
        weight: int = 1,
        health_check_url: str = ""
    ):
        """Add backend to service"""
        if service not in self._services:
            self._services[service] = {}
            self._counters[service] = 0
        
        backend = Backend(
            backend_id=backend_id,
            url=url,
            weight=weight,
            health_check_url=health_check_url
        )
        
        self._services[service][backend_id] = backend
        
        logger.info(f"[OK] Backend added: {service}/{backend_id} -> {url} (weight: {weight})")
    
    def remove_backend(self, service: str, backend_id: str) -> bool:
        """Remove backend from service"""
        if service in self._services and backend_id in self._services[service]:
            del self._services[service][backend_id]
            logger.info(f"🗑️ Backend removed: {service}/{backend_id}")
            return True
        return False
    
    def set_algorithm(self, algorithm: LoadBalanceAlgorithm):
        """Set load balancing algorithm"""
        self._algorithm = algorithm
        logger.info(f"⚖️ Load balancing algorithm set to: {algorithm.value}")
    
    async def get_backend(
        self,
        service: str,
        client_ip: str = None
    ) -> Optional[Backend]:
        """Get backend for request"""
        if service not in self._services:
            logger.warning(f"Service not found: {service}")
            return None
        
        backends = self._services[service]
        
        # Filter healthy backends
        healthy = [b for b in backends.values() if b.status == BackendStatus.HEALTHY]
        
        if not healthy:
            logger.error(f"No healthy backends for service: {service}")
            return None
        
        # Select backend based on algorithm
        if self._algorithm == LoadBalanceAlgorithm.ROUND_ROBIN:
            return self._round_robin(service, healthy)
        
        elif self._algorithm == LoadBalanceAlgorithm.LEAST_CONNECTIONS:
            return min(healthy, key=lambda b: b.current_connections)
        
        elif self._algorithm == LoadBalanceAlgorithm.WEIGHTED:
            return self._weighted(healthy)
        
        elif self._algorithm == LoadBalanceAlgorithm.IP_HASH and client_ip:
            return self._ip_hash(client_ip, healthy)
        
        else:
            return random.choice(healthy)
    
    def _round_robin(self, service: str, backends: List[Backend]) -> Backend:
        """Round robin selection"""
        self._counters[service] = (self._counters.get(service, 0) + 1) % len(backends)
        return backends[self._counters[service]]
    
    def _weighted(self, backends: List[Backend]) -> Backend:
        """Weighted selection"""
        total_weight = sum(b.weight for b in backends)
        
        if total_weight == 0:
            return random.choice(backends)
        
        rand = random.randint(1, total_weight)
        
        for backend in backends:
            rand -= backend.weight
            if rand <= 0:
                return backend
        
        return backends[0]
    
    def _ip_hash(self, client_ip: str, backends: List[Backend]) -> Backend:
        """IP hash selection"""
        hash_value = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        return backends[hash_value % len(backends)]
    
    async def record_request(
        self,
        service: str,
        backend_id: str,
        success: bool,
        response_time: float
    ):
        """Record request metrics"""
        if service in self._services and backend_id in self._services[service]:
            backend = self._services[service][backend_id]
            
            backend.total_requests += 1
            backend.current_connections += 1
            
            # Update average response time
            backend.avg_response_time = (
                (backend.avg_response_time * (backend.total_requests - 1) + response_time)
                / backend.total_requests
            )
            
            if not success:
                backend.failed_requests += 1
    
    def release_connection(self, service: str, backend_id: str):
        """Release connection (called after request completes)"""
        if service in self._services and backend_id in self._services[service]:
            backend = self._services[service][backend_id]
            backend.current_connections = max(0, backend.current_connections - 1)
    
    def get_service_stats(self, service: str) -> Dict[str, Any]:
        """Get service statistics"""
        if service not in self._services:
            return {}
        
        backends = self._services[service]
        
        total_requests = sum(b.total_requests for b in backends.values())
        total_failures = sum(b.failed_requests for b in backends.values())
        
        return {
            "service": service,
            "algorithm": self._algorithm.value,
            "total_backends": len(backends),
            "healthy_backends": sum(
                1 for b in backends.values()
                if b.status == BackendStatus.HEALTHY
            ),
            "total_requests": total_requests,
            "total_failures": total_failures,
            "failure_rate": (total_failures / total_requests * 100) if total_requests > 0 else 0,
            "backends": [
                {
                    "backend_id": b.backend_id,
                    "url": b.url,
                    "status": b.status.value,
                    "weight": b.weight,
                    "current_connections": b.current_connections,
                    "total_requests": b.total_requests,
                    "avg_response_time": round(b.avg_response_time, 2)
                }
                for b in backends.values()
            ]
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Get all services statistics"""
        return {
            service: self.get_service_stats(service)
            for service in self._services.keys()
        }
    
    async def start_health_checks(self):
        """Start backend health checking"""
        async def on_status_change(backend_id: str, status: BackendStatus):
            logger.info(f"[SEARCH] Backend {backend_id} status changed to: {status.value}")
        
        await self._health_checker.start(self._services, on_status_change)
    
    def stop_health_checks(self):
        """Stop health checking"""
        self._health_checker.stop()


# Global singleton
_load_balancer = None

def get_load_balancer() -> LoadBalancer:
    """Get global LoadBalancer instance"""
    global _load_balancer
    if _load_balancer is None:
        _load_balancer = LoadBalancer()
    return _load_balancer