"""
.env 파일 업데이트 유틸리티
"""
import os
from typing import Dict

def update_env_file(updates: Dict[str, str], env_path: str = None):
    """
    .env 파일 업데이트
    
    Args:
        updates: 업데이트할 키-값 쌍
        env_path: .env 파일 경로 (기본: backend/.env)
    """
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    
    # 기존 .env 파일 읽기
    existing_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    existing_vars[key.strip()] = value.strip()
    
    # 업데이트 적용
    existing_vars.update(updates)
    
    # .env 파일 쓰기
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write("# ViraLoop Environment Configuration\n")
        f.write("# Auto-generated - Do not edit manually\n\n")
        
        # Rate Limiting 섹션
        if any(k.startswith('ENABLE_') or k == 'RATE_LIMIT_MODE' for k in existing_vars.keys()):
            f.write("# Rate Limiting System\n")
            for key in ['ENABLE_RATE_LIMITER', 'ENABLE_CIRCUIT_BREAKER', 'RATE_LIMIT_MODE']:
                if key in existing_vars:
                    f.write(f"{key}={existing_vars[key]}\n")
            f.write("\n")
        
        # 기타 변수
        other_vars = {k: v for k, v in existing_vars.items() 
                     if not k.startswith('ENABLE_') and k != 'RATE_LIMIT_MODE'}
        for key, value in other_vars.items():
            f.write(f"{key}={value}\n")
    
    return True

def read_env_file(env_path: str = None) -> Dict[str, str]:
    """
    .env 파일 읽기
    
    Returns:
        환경 변수 딕셔너리
    """
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    
    return env_vars
