"""
API Gateway Service

Provides:
1. Request routing
2. Rate limiting
3. Authentication
4. Request/response transformation
5. Circuit breaker

Usage:
    gateway = APIGateway()
    
    # Add route
    gateway.add_route(
        path="/api/videos",
        backend="http://localhost:8001",
        methods=["GET", "POST"]
    )
    
    # Handle request
    response = await gateway.handle(request)
"""

import os
import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)


class RouteMethod(Enum):
    """HTTP methods"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class RateLimitStrategy(Enum):
    """Rate limiting strategies"""
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"


@dataclass
class Route:
    """API route definition"""
    path: str
    backend: str
    methods: List[str]
    auth_required: bool = False
    rate_limit: int = 100  # requests per window
    rate_window: int = 60  # seconds
    timeout: int = 30
    retry_count: int = 3
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: int = 60


@dataclass
class APIRequest:
    """API request"""
    request_id: str
    method: str
    path: str
    headers: Dict[str, str]
    body: Any = None
    query_params: Dict[str, str] = field(default_factory=dict)
    client_ip: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class APIResponse:
    """API response"""
    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    body: Any = None
    duration_ms: int = 0


class RateLimiter:
    """Rate limiter"""
    
    def __init__(self, strategy: RateLimitStrategy = RateLimitStrategy.FIXED_WINDOW):
        self._requests: Dict[str, List[datetime]] = {}
        self.strategy = strategy
    
    def check_limit(self, key: str, limit: int, window: int) -> bool:
        """Check if request is within rate limit"""
        now = datetime.now()
        cutoff = now - timedelta(seconds=window)
        
        # Get requests for key
        if key not in self._requests:
            self._requests[key] = []
        
        # Filter to current window
        self._requests[key] = [
            t for t in self._requests[key]
            if t > cutoff
        ]
        
        # Check limit
        if len(self._requests[key]) >= limit:
            return False
        
        # Add current request
        self._requests[key].append(now)
        
        return True
    
    def get_remaining(self, key: str, limit: int, window: int) -> int:
        """Get remaining requests"""
        now = datetime.now()
        cutoff = now - timedelta(seconds=window)
        
        if key not in self._requests:
            return limit
        
        count = len([
            t for t in self._requests[key]
            if t > cutoff
        ])
        
        return max(0, limit - count)


class CircuitBreaker:
    """Circuit breaker for backend failures"""
    
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self._failure_count = 0
        self._failure_threshold = failure_threshold
        self._timeout = timeout
        self._circuit_open_time: Optional[datetime] = None
        self._state = "closed"  # closed, open, half-open
    
    def can_proceed(self) -> bool:
        """Check if request can proceed"""
        if self._state == "closed":
            return True
        
        if self._state == "open":
            if self._circuit_open_time:
                elapsed = (datetime.now() - self._circuit_open_time).seconds
                if elapsed >= self._timeout:
                    self._state = "half-open"
                    return True
            return False
        
        # half-open - allow one request
        return True
    
    def record_success(self):
        """Record successful request"""
        self._failure_count = 0
        self._state = "closed"
    
    def record_failure(self):
        """Record failed request"""
        self._failure_count += 1
        
        if self._failure_count >= self._failure_threshold:
            self._state = "open"
            self._circuit_open_time = datetime.now()
            logger.warning(f"🔴 Circuit breaker opened after {self._failure_count} failures")
    
    def get_state(self) -> str:
        """Get circuit state"""
        return self._state


class APIGateway:
    """
    API Gateway Service
    
    Features:
    - Request routing
    - Rate limiting
    - Authentication
    - Circuit breaker
    - Request/response transformation
    """
    
    def __init__(self):
        self._routes: Dict[str, Route] = {}
        self._rate_limiters: Dict[str, RateLimiter] = {}
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._auth_handlers: Dict[str, Callable] = {}
        
        # Stats
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "rate_limited": 0
        }
        
        logger.info("APIGateway initialized")
    
    def add_route(
        self,
        path: str,
        backend: str,
        methods: List[str],
        auth_required: bool = False,
        rate_limit: int = 100,
        rate_window: int = 60,
        timeout: int = 30
    ):
        """Add route"""
        route = Route(
            path=path,
            backend=backend,
            methods=methods,
            auth_required=auth_required,
            rate_limit=rate_limit,
            rate_window=rate_window,
            timeout=timeout
        )
        
        self._routes[path] = route
        
        # Initialize rate limiter
        self._rate_limiters[path] = RateLimiter()
        
        # Initialize circuit breaker
        self._circuit_breakers[path] = CircuitBreaker(
            failure_threshold=route.circuit_breaker_threshold,
            timeout=route.circuit_breaker_timeout
        )
        
        logger.info(f"✅ Route added: {path} -> {backend}")
    
    def register_auth(self, path: str, handler: Callable):
        """Register auth handler for route"""
        self._auth_handlers[path] = handler
    
    async def handle(self, request: APIRequest) -> APIResponse:
        """Handle API request"""
        start_time = time.time()
        request.request_id = f"req_{uuid.uuid4().hex[:12]}"
        
        self._stats["total_requests"] += 1
        
        try:
            # Find route
            route = self._routes.get(request.path)
            
            if not route:
                return APIResponse(
                    status_code=404,
                    body={"error": "Route not found"},
                    duration_ms=int((time.time() - start_time) * 1000)
                )
            
            # Check method
            if request.method not in route.methods:
                return APIResponse(
                    status_code=405,
                    body={"error": "Method not allowed"},
                    duration_ms=int((time.time() - start_time) * 1000)
                )
            
            # Check circuit breaker
            circuit = self._circuit_breakers.get(request.path)
            if circuit and not circuit.can_proceed():
                self._stats["failed_requests"] += 1
                return APIResponse(
                    status_code=503,
                    body={"error": "Service temporarily unavailable"},
                    duration_ms=int((time.time() - start_time) * 1000)
                )
            
            # Check rate limit
            rate_limiter = self._rate_limiters.get(request.path)
            if rate_limiter:
                client_key = request.client_ip or "default"
                if not rate_limiter.check_limit(
                    client_key,
                    route.rate_limit,
                    route.rate_window
                ):
                    self._stats["rate_limited"] += 1
                    
                    remaining = rate_limiter.get_remaining(
                        client_key,
                        route.rate_limit,
                        route.rate_window
                    )
                    
                    return APIResponse(
                        status_code=429,
                        body={"error": "Rate limit exceeded"},
                        headers={"X-RateLimit-Remaining": str(remaining)},
                        duration_ms=int((time.time() - start_time) * 1000)
                    )
            
            # Check authentication
            if route.auth_required:
                auth_handler = self._auth_handlers.get(request.path)
                if auth_handler:
                    auth_result = await auth_handler(request)
                    if not auth_result:
                        return APIResponse(
                            status_code=401,
                            body={"error": "Unauthorized"},
                            duration_ms=int((time.time() - start_time) * 1000)
                        )
            
            # Forward to backend
            response = await self._forward_request(request, route)
            
            # Record success
            if circuit:
                circuit.record_success()
            
            self._stats["successful_requests"] += 1
            
            return response
            
        except Exception as e:
            logger.error(f"❌ Request failed: {e}")
            
            # Record failure
            if circuit:
                circuit.record_failure()
            
            self._stats["failed_requests"] += 1
            
            return APIResponse(
                status_code=500,
                body={"error": "Internal server error"},
                duration_ms=int((time.time() - start_time) * 1000)
            )
    
    async def _forward_request(self, request: APIRequest, route: Route) -> APIResponse:
        """Forward request to backend"""
        import httpx
        
        url = f"{route.backend}{request.path}"
        
        try:
            async with httpx.AsyncClient(timeout=route.timeout) as client:
                response = await client.request(
                    method=request.method,
                    url=url,
                    headers=request.headers,
                    json=request.body,
                    params=request.query_params
                )
                
                return APIResponse(
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body=response.json() if response.text else None,
                    duration_ms=0  # Will be set by caller
                )
                
        except httpx.TimeoutException:
            raise Exception("Backend timeout")
        except Exception as e:
            raise Exception(f"Backend error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get gateway statistics"""
        total = self._stats["total_requests"]
        
        return {
            "total_requests": total,
            "successful": self._stats["successful_requests"],
            "failed": self._stats["failed_requests"],
            "rate_limited": self._stats["rate_limited"],
            "success_rate": (
                self._stats["successful_requests"] / total * 100
                if total > 0 else 0
            ),
            "routes": len(self._routes),
            "circuit_breakers": {
                path: cb.get_state()
                for path, cb in self._circuit_breakers.items()
            }
        }


# Global singleton
_api_gateway = None

def get_api_gateway() -> APIGateway:
    """Get global APIGateway instance"""
    global _api_gateway
    if _api_gateway is None:
        _api_gateway = APIGateway()
    return _api_gateway