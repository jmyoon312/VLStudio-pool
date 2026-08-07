"""
ViraLoop Elite: Redis Task Queue Service
RabbitMQ/Celery를 대체하는 경량 Redis 기반 태스크 큐.

특징:
- 태스크 영속성 (서버 재시작 후에도 데이터 유지)
- 태스크 상태 추적 (PENDING / RUNNING / DONE / FAILED)
- 하위 호환 인터페이스 (Celery 패턴과 유사)
"""

import json
import uuid
import logging
import os
from datetime import datetime
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Redis 클라이언트 — 연결 실패 시 in-memory fallback
_redis_client = None
_in_memory_queue = []
_in_memory_status = {}


def _get_redis():
    """Redis 클라이언트 반환 (lazy init, 실패 시 None)"""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis as redis_lib
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        client = redis_lib.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
        client.ping()
        _redis_client = client
        logger.info(f"[OK] [RedisQueue] Connected to Redis: {redis_url}")
        return _redis_client
    except Exception as e:
        logger.warning(f"[WARN] [RedisQueue] Redis unavailable, using in-memory fallback: {e}")
        return None


class RedisTaskQueue:
    """
    Redis 기반 태스크 큐.
    Redis 미연결 시 in-memory 모드로 자동 폴백.
    """

    QUEUE_KEY = "viraloop:tasks:queue"
    STATUS_PREFIX = "viraloop:tasks:status:"
    TTL_SECONDS = 86400 * 7  # 7일

    @classmethod
    def push(cls, task_data: dict) -> str:
        """
        태스크를 큐에 등록하고 task_id 반환.
        task_data: {"type": "video_production", "item_id": 123, ...}
        """
        task_id = str(uuid.uuid4())
        payload = {
            "task_id": task_id,
            "status": "PENDING",
            "created_at": datetime.utcnow().isoformat(),
            **task_data,
        }

        r = _get_redis()
        if r:
            try:
                r.rpush(cls.QUEUE_KEY, json.dumps(payload))
                cls._set_status_redis(r, task_id, "PENDING", payload)
                logger.info(f"📥 [RedisQueue] Task pushed: {task_id} | type={task_data.get('type')}")
                return task_id
            except Exception as e:
                logger.error(f"[FAIL] [RedisQueue] Push failed, using in-memory: {e}")

        # In-memory fallback
        _in_memory_queue.append(payload)
        _in_memory_status[task_id] = payload
        logger.info(f"📥 [InMemoryQueue] Task pushed: {task_id}")
        return task_id

    @classmethod
    def pop(cls, timeout: int = 5) -> Optional[dict]:
        """
        큐에서 태스크 꺼내기 (blocking pop).
        반환: task_data dict 또는 None
        """
        r = _get_redis()
        if r:
            try:
                result = r.blpop(cls.QUEUE_KEY, timeout=timeout)
                if result:
                    _, raw = result
                    payload = json.loads(raw)
                    cls._set_status_redis(r, payload["task_id"], "RUNNING", payload)
                    return payload
                return None
            except Exception as e:
                logger.error(f"[FAIL] [RedisQueue] Pop failed: {e}")

        # In-memory fallback
        if _in_memory_queue:
            payload = _in_memory_queue.pop(0)
            payload["status"] = "RUNNING"
            _in_memory_status[payload["task_id"]] = payload
            return payload
        return None

    @classmethod
    def set_status(cls, task_id: str, status: str, data: Optional[dict] = None):
        """
        태스크 상태 업데이트.
        status: PENDING | RUNNING | DONE | FAILED
        """
        r = _get_redis()
        if r:
            try:
                cls._set_status_redis(r, task_id, status, data or {})
                return
            except Exception as e:
                logger.error(f"[FAIL] [RedisQueue] set_status failed: {e}")

        # In-memory fallback
        if task_id in _in_memory_status:
            _in_memory_status[task_id]["status"] = status
            if data:
                _in_memory_status[task_id].update(data)

    @classmethod
    def get_status(cls, task_id: str) -> Optional[dict]:
        """태스크 상태 조회"""
        r = _get_redis()
        if r:
            try:
                raw = r.get(f"{cls.STATUS_PREFIX}{task_id}")
                if raw:
                    return json.loads(raw)
                return None
            except Exception as e:
                logger.error(f"[FAIL] [RedisQueue] get_status failed: {e}")

        # In-memory fallback
        return _in_memory_status.get(task_id)

    @classmethod
    def get_queue_length(cls) -> int:
        """현재 대기 중인 태스크 수"""
        r = _get_redis()
        if r:
            try:
                return r.llen(cls.QUEUE_KEY)
            except Exception:
                pass
        return len(_in_memory_queue)

    @classmethod
    def _set_status_redis(cls, r: Any, task_id: str, status: str, data: dict):
        """Redis 상태 저장 (내부 메서드)"""
        payload = {**data, "status": status, "updated_at": datetime.utcnow().isoformat()}
        r.setex(
            f"{cls.STATUS_PREFIX}{task_id}",
            cls.TTL_SECONDS,
            json.dumps(payload)
        )


# Singleton 인스턴스
redis_task_queue = RedisTaskQueue()
