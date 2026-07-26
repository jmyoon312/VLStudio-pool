"""
ViraLoop Elite: Task Queue Configuration

Standalone(로컬) 모드에서는 Celery/Redis가 불필요합니다.
In-memory job_queue.py가 모든 태스크를 처리합니다.
Docker(프로덕션) 모드에서만 Redis 브로커를 사용합니다.
"""
import os
import logging

logger = logging.getLogger(__name__)

celery_app = None  # Default: disabled (standalone/local mode)

# Celery는 선택적 의존성 — 없으면 graceful하게 None 유지
try:
    from celery import Celery

    REDIS_URL = os.getenv("REDIS_URL", "")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)

    # Redis URL이 비어있거나 명시적으로 비활성화된 경우 Celery 스킵
    if not CELERY_BROKER_URL or CELERY_BROKER_URL.strip() == "":
        logger.info("ℹ️ [Celery] No broker URL configured — using in-memory queue (standalone mode)")
    else:
        celery_app = Celery(
            'viraloop',
            broker=CELERY_BROKER_URL,
            backend=None
        )

        celery_app.conf.update(
            task_serializer='json',
            result_serializer='json',
            accept_content=['json'],
            timezone='Asia/Seoul',
            enable_utc=True,
            task_track_started=True,
            broker_connection_retry=False,
            broker_connection_retry_on_startup=False,
            broker_connection_max_retries=0,
            broker_transport_options={
                'socket_timeout': 3.0,
                'socket_connect_timeout': 3.0,
            }
        )

        celery_app.autodiscover_tasks(['app.tasks'])
        logger.info(f"✅ [Celery] Initialized with broker: {CELERY_BROKER_URL[:30]}...")

except ImportError:
    logger.info("ℹ️ [Celery] celery package not installed — using in-memory queue (standalone mode)")

except Exception as e:
    logger.warning(f"⚠️ [Celery] Init failed (non-critical): {e}")
