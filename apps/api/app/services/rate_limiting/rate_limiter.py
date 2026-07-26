"""
지능형 Rate Limiter
"""
import asyncio
import time
import random
from collections import deque
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class IntelligentRateLimiter:
    """
    YouTube API 호출을 지능적으로 제한
    """
    
    # Rate limit 모드별 설정
    MODES = {
        'SAFE': {
            'requests_per_minute': 20,
            'requests_per_hour': 800,
            'requests_per_day': 10000,
            'min_delay': 3.0,
            'max_delay': 6.0
        },
        'BALANCED': {
            'requests_per_minute': 30,
            'requests_per_hour': 1200,
            'requests_per_day': 15000,
            'min_delay': 2.0,
            'max_delay': 4.0
        },
        'AGGRESSIVE': {
            'requests_per_minute': 50,
            'requests_per_hour': 2000,
            'requests_per_day': 20000,
            'min_delay': 1.0,
            'max_delay': 2.0
        }
    }
    
    def __init__(self, mode: str = 'SAFE'):
        """
        Args:
            mode: 'SAFE', 'BALANCED', 'AGGRESSIVE'
        """
        self.mode = mode
        self.config = self.MODES.get(mode, self.MODES['SAFE'])
        
        # 요청 타임스탬프 추적
        self.request_times = {
            'minute': deque(maxlen=1000),
            'hour': deque(maxlen=10000),
            'day': deque(maxlen=100000)
        }
        
        # 동적 조정
        self.backoff_multiplier = 1.0
        self.consecutive_429_count = 0
        self.last_429_time = None
        
        # 락
        self.lock = asyncio.Lock()
        
        # [NEW] Dynamic Config Override
        self.custom_config = None
        
        logger.info(f"✅ RateLimiter initialized in {mode} mode")
        
    def update_config(self, requests: int, window: int, threshold: int):
        """설정 동적 업데이트"""
        new_config = {
            'requests_per_minute': requests,
            'requests_per_hour': requests * 60, # Approximation for now
            'circuit_breaker_threshold': threshold,
            'min_delay': 1.0, 
            'max_delay': 2.0
        }
        self.config = new_config
        logger.info(f"🔄 RateLimiter config updated: {requests} RPM, Threshold {threshold}")
        
    async def acquire(self, task_type: str = 'default'):
        """
        요청 전 대기
        
        Args:
            task_type: 작업 유형 (향후 확장용)
        """
        async with self.lock:
            # 1. Rate limit 확인
            await self._check_limits()
            
            # 2. 기본 딜레이 적용
            base_delay = random.uniform(
                self.config['min_delay'],
                self.config['max_delay']
            )
            
            # 3. Backoff 적용
            actual_delay = base_delay * self.backoff_multiplier
            
            # 4. 대기
            await asyncio.sleep(actual_delay)
            
            # 5. 요청 기록
            now = time.time()
            self.request_times['minute'].append(now)
            self.request_times['hour'].append(now)
            self.request_times['day'].append(now)
            
            logger.debug(f"Rate limiter: waited {actual_delay:.2f}s (backoff: {self.backoff_multiplier:.2f}x)")
            
    async def _check_limits(self):
        """Rate limit 확인 및 대기"""
        now = time.time()
        
        # 분당 제한 확인
        minute_ago = now - 60
        recent_requests = [t for t in self.request_times['minute'] if t > minute_ago]
        
        if len(recent_requests) >= self.config['requests_per_minute']:
            # 1분 대기
            wait_time = 60 - (now - recent_requests[0])
            logger.warning(f"⏱️ Rate limit reached (minute), waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
            
        # 시간당 제한 확인
        hour_ago = now - 3600
        recent_requests = [t for t in self.request_times['hour'] if t > hour_ago]
        
        if len(recent_requests) >= self.config['requests_per_hour']:
            # 1시간 대기
            wait_time = 3600 - (now - recent_requests[0])
            logger.warning(f"⏱️ Rate limit reached (hour), waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
            
    def report_429(self):
        """429 에러 보고"""
        self.consecutive_429_count += 1
        self.last_429_time = time.time()
        
        # Backoff 증가
        self.backoff_multiplier = min(5.0, self.backoff_multiplier * 1.5)
        
        logger.error(f"🚨 429 Error! Backoff: {self.backoff_multiplier:.2f}x (count: {self.consecutive_429_count})")
        
        # 3회 연속 429 → 긴급 중단
        if self.consecutive_429_count >= 3:
            logger.critical("🚨 CRITICAL: 3 consecutive 429 errors! Emergency pause recommended")
            
    def report_success(self):
        """성공 보고"""
        # 점진적 회복
        if self.consecutive_429_count > 0:
            self.consecutive_429_count = max(0, self.consecutive_429_count - 1)
            
        if self.backoff_multiplier > 1.0:
            self.backoff_multiplier = max(1.0, self.backoff_multiplier * 0.95)
            
    def get_stats(self) -> dict:
        """통계 반환"""
        now = time.time()
        
        return {
            'mode': self.mode,
            'backoff_multiplier': self.backoff_multiplier,
            'consecutive_429': self.consecutive_429_count,
            'requests_last_minute': len([t for t in self.request_times['minute'] if t > now - 60]),
            'requests_last_hour': len([t for t in self.request_times['hour'] if t > now - 3600]),
            'requests_today': len([t for t in self.request_times['day'] if t > now - 86400])
        }

# 전역 인스턴스 (싱글톤)
_rate_limiter_instance = None

def get_rate_limiter(mode: str = 'SAFE') -> IntelligentRateLimiter:
    """Rate limiter 싱글톤 인스턴스 반환"""
    global _rate_limiter_instance
    if _rate_limiter_instance is None:
        _rate_limiter_instance = IntelligentRateLimiter(mode)
    return _rate_limiter_instance
