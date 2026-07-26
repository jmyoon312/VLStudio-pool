"""
Circuit Breaker 패턴
"""
import asyncio
import time
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "CLOSED"      # 정상
    OPEN = "OPEN"          # 차단
    HALF_OPEN = "HALF_OPEN"  # 테스트

class CircuitBreakerOpenError(Exception):
    """Circuit breaker가 OPEN 상태일 때 발생"""
    pass

class CircuitBreaker:
    """
    연속 실패 시 자동 중단
    """
    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 1800  # 30분
    ):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.lock = asyncio.Lock()
        
        logger.info(f"✅ CircuitBreaker initialized (threshold: {failure_threshold}, timeout: {timeout}s)")
        
    async def call(self, func, *args, **kwargs):
        """
        함수 호출 (Circuit breaker 통과)
        """
        async with self.lock:
            # OPEN 상태 확인
            if self.state == CircuitState.OPEN:
                # 타임아웃 경과 확인
                if time.time() - self.last_failure_time > self.timeout:
                    logger.info("🔄 Circuit breaker: OPEN → HALF_OPEN")
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                else:
                    remaining = self.timeout - (time.time() - self.last_failure_time)
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker is OPEN. Retry after {remaining:.0f}s"
                    )
                    
        # 함수 실행
        try:
            result = await func(*args, **kwargs)
            
            # 성공 처리
            async with self.lock:
                self.failure_count = 0
                
                if self.state == CircuitState.HALF_OPEN:
                    self.success_count += 1
                    if self.success_count >= self.success_threshold:
                        logger.info("✅ Circuit breaker: HALF_OPEN → CLOSED")
                        self.state = CircuitState.CLOSED
                        
            return result
            
        except Exception as e:
            # 실패 처리
            async with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    logger.critical(
                        f"🚨 Circuit breaker: {self.state.value} → OPEN "
                        f"(failures: {self.failure_count})"
                    )
                    self.state = CircuitState.OPEN
                    
            raise
            
    def reset(self):
        """수동 리셋"""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        logger.info("🔄 Circuit breaker manually reset")
        
    def get_state(self) -> CircuitState:
        """현재 상태 반환"""
        return self.state
