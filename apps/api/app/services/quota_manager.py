"""
Quota and Rate Limiting Utilities for Captain Dashboard

Manages YouTube API quota and yt-dlp rate limiting
"""
import time
import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class QuotaManager:
    """
    YouTube API 쿼타 관리
    
    메모리 기반 간단한 구현 (Redis 없이도 동작)
    """
    
    def __init__(self, daily_limit: int = 10000):
        self.daily_limit = daily_limit
        self.current_usage = 0
        self.reset_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    def _check_reset(self):
        """자정이 지나면 쿼타 리셋"""
        if datetime.now() >= self.reset_time:
            self.current_usage = 0
            self.reset_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            logger.info("YouTube API quota reset")
    
    def check_quota(self, cost: int) -> bool:
        """쿼타 확인"""
        self._check_reset()
        
        if self.current_usage + cost > self.daily_limit:
            logger.warning(f"Quota exceeded: {self.current_usage + cost}/{self.daily_limit}")
            return False
        
        return True
    
    def consume_quota(self, cost: int):
        """쿼타 소비"""
        self._check_reset()
        self.current_usage += cost
        logger.debug(f"Quota consumed: {cost} units (Total: {self.current_usage}/{self.daily_limit})")
    
    def get_remaining_quota(self) -> int:
        """남은 쿼타 조회"""
        self._check_reset()
        return self.daily_limit - self.current_usage
    
    def get_usage_percentage(self) -> float:
        """쿼타 사용률 (%)"""
        self._check_reset()
        return (self.current_usage / self.daily_limit) * 100


class YTDLPRateLimiter:
    """
    yt-dlp Rate Limiter (Token Bucket Algorithm)
    
    YouTube 서버 부하 방지를 위한 Rate Limiting
    """
    
    def __init__(self, bucket_size: int = 30, refill_rate: float = 1.0):
        """
        Args:
            bucket_size: 최대 토큰 수 (burst capacity)
            refill_rate: 초당 토큰 충전 속도
        """
        self.bucket_size = bucket_size
        self.refill_rate = refill_rate
        self.tokens = bucket_size
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def _refill(self):
        """토큰 충전"""
        now = time.time()
        elapsed = now - self.last_refill
        
        # 경과 시간에 비례하여 토큰 충전
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.bucket_size, self.tokens + tokens_to_add)
        self.last_refill = now
    
    async def acquire(self, tokens: int = 1) -> bool:
        """
        토큰 획득 시도
        
        Args:
            tokens: 필요한 토큰 수
            
        Returns:
            성공 여부
        """
        async with self._lock:
            await self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            else:
                return False
    
    async def wait_for_token(self, tokens: int = 1):
        """
        토큰 획득까지 대기
        
        Args:
            tokens: 필요한 토큰 수
        """
        while not await self.acquire(tokens):
            # 토큰이 충전될 때까지 대기
            wait_time = (tokens - self.tokens) / self.refill_rate
            await asyncio.sleep(min(wait_time, 1.0))  # 최대 1초씩 대기
    
    def get_available_tokens(self) -> float:
        """현재 사용 가능한 토큰 수"""
        return self.tokens


async def collect_with_retry(
    collect_func,
    max_retries: int = 3,
    rate_limiter: Optional[YTDLPRateLimiter] = None
):
    """
    지수 백오프로 재시도
    
    Args:
        collect_func: 실행할 함수 (async)
        max_retries: 최대 재시도 횟수
        rate_limiter: Rate limiter (선택)
        
    Returns:
        함수 실행 결과
    """
    for attempt in range(max_retries):
        try:
            # Rate limiting
            if rate_limiter:
                await rate_limiter.wait_for_token()
            
            # Execute function
            return await collect_func()
            
        except Exception as e:
            if attempt == max_retries - 1:
                # 마지막 시도 실패
                raise
            
            # 지수 백오프
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(f"Retry {attempt + 1}/{max_retries} after {wait_time}s: {e}")
            await asyncio.sleep(wait_time)


# Global instances (singleton pattern)
_quota_manager = None
_rate_limiter = None


def get_quota_manager() -> QuotaManager:
    """QuotaManager 싱글톤 인스턴스"""
    global _quota_manager
    if _quota_manager is None:
        _quota_manager = QuotaManager()
    return _quota_manager


def get_rate_limiter() -> YTDLPRateLimiter:
    """YTDLPRateLimiter 싱글톤 인스턴스"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = YTDLPRateLimiter()
    return _rate_limiter
