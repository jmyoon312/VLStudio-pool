"""
Feature Flag 시스템
환경변수 또는 DB로 제어 가능
"""
import os
from typing import Dict, Any

class FeatureFlags:
    """
    기능별 활성화 플래그
    """
    def __init__(self):
        # 기본값: 모두 비활성화 (안전)
        self._flags = {
            # Rate Limiting
            'ENABLE_RATE_LIMITER': self._get_bool('ENABLE_RATE_LIMITER', False),
            'ENABLE_PRIORITY_QUEUE': self._get_bool('ENABLE_PRIORITY_QUEUE', False),
            'ENABLE_CIRCUIT_BREAKER': self._get_bool('ENABLE_CIRCUIT_BREAKER', False),
            
            # Caching
            'ENABLE_METADATA_CACHE': self._get_bool('ENABLE_METADATA_CACHE', False),
            
            # Performance
            'ENABLE_BATCH_PROCESSING': self._get_bool('ENABLE_BATCH_PROCESSING', False),
            'ENABLE_SMART_SCHEDULING': self._get_bool('ENABLE_SMART_SCHEDULING', False),
            
            # Monitoring
            'ENABLE_ADVANCED_MONITORING': self._get_bool('ENABLE_ADVANCED_MONITORING', False),
            
            # Rate Limit 설정
            'RATE_LIMIT_MODE': os.getenv('RATE_LIMIT_MODE', 'SAFE'),  # SAFE, BALANCED, AGGRESSIVE
        }
        
    def _get_bool(self, key: str, default: bool) -> bool:
        """환경변수에서 bool 값 읽기"""
        value = os.getenv(key)
        if value is None:
            return default
        return value.lower() in ('true', '1', 'yes', 'on')
        
    def is_enabled(self, flag_name: str) -> bool:
        """플래그 활성화 여부 확인"""
        return self._flags.get(flag_name, False)
        
    def get_mode(self) -> str:
        """Rate limit 모드 반환"""
        return self._flags['RATE_LIMIT_MODE']
        
    def enable(self, flag_name: str):
        """플래그 활성화 (런타임)"""
        if flag_name in self._flags:
            self._flags[flag_name] = True
            print(f"✅ Feature enabled: {flag_name}")
            
    def disable(self, flag_name: str):
        """플래그 비활성화 (런타임)"""
        if flag_name in self._flags:
            self._flags[flag_name] = False
            print(f"❌ Feature disabled: {flag_name}")
            
    def get_all_flags(self) -> Dict[str, Any]:
        """모든 플래그 상태 반환"""
        return self._flags.copy()

# 전역 인스턴스
feature_flags = FeatureFlags()

def get_llm_client(preferred_provider: str = None, preferred_model: str = None):
    """
    [Factory] Returns a configured LLMClient based on system settings.
    Allows specifying preferred providers/models (e.g., for high-intelligence distillation).
    """
    from app.config import settings
    from app.llm_manager import LLMClient
    
    client = LLMClient(settings)
    # Note: In a more complex setup, we could override model_name here 
    # based on feature flags or performance requirements.
    return client
