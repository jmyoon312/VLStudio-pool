import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


async def notify_quality_alert(
    mission_id: str,
    quality_score: float,
    status: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Send quality alert notification
    
    Args:
        mission_id: Mission/session ID
        quality_score: Quality score (0-100)
        status: Status type (ROLLBACK, REVIEW_NEEDED, APPROVED, REJECTED)
        details: Additional details
    """
    try:
        # Get notification settings
        from app.config import settings
        
        # Build message
        status_emoji = {
            "ROLLBACK": "🔄",
            "REVIEW_NEEDED": "⚠️",
            "APPROVED": "✅",
            "REJECTED": "❌"
        }
        
        emoji = status_emoji.get(status, "📋")
        
        message = f"""
{emoji} **ViraLoop 품질 알림**

**Mission:** {mission_id}
**Quality Score:** {quality_score}/100
**Status:** {status}
"""
        
        if details:
            message += f"\n**Details:**"
            for key, value in details.items():
                message += f"\n- {key}: {value}"
        
        # Try to send to n8n webhook
        webhook_url = getattr(settings, 'n8n_webhook_url', None)
        
        if webhook_url:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={
                        "text": message,
                        "mission_id": mission_id,
                        "quality_score": quality_score,
                        "status": status
                    },
                    timeout=10.0
                )
                logger.info(f"📨 Quality alert sent to n8n webhook for mission {mission_id}")
        
        # Also try Discord webhook if configured
        discord_webhook = getattr(settings, 'discord_webhook_url', None)
        
        if discord_webhook:
            async with httpx.AsyncClient() as client:
                await client.post(
                    discord_webhook,
                    json={
                        "content": message
                    },
                    timeout=10.0
                )
                logger.info(f"📨 Quality alert sent to Discord for mission {mission_id}")
        
        # Log locally
        logger.info(f"📋 Quality Alert: {status} - Mission {mission_id} - Score {quality_score}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send quality alert: {e}")
        return False


async def notify_mission_status(
    mission_id: str,
    phase: int,
    status: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Send mission status notification
    
    Args:
        mission_id: Mission/session ID
        phase: Current phase (1-10)
        status: Status (STARTED, COMPLETED, FAILED, ROLLED_BACK)
        details: Additional details
    """
    try:
        from app.config import settings
        
        status_emoji = {
            "STARTED": "🚀",
            "COMPLETED": "✅",
            "FAILED": "❌",
            "ROLLED_BACK": "🔄",
            "PAUSED": "⏸️"
        }
        
        emoji = status_emoji.get(status, "📋")
        
        message = f"""
{emoji} **ViraLoop 미션 상태**

**Mission:** {mission_id}
**Phase:** {phase}/10
**Status:** {status}
"""
        
        if details:
            message += "\n**Details:**"
            for key, value in details.items():
                message += f"\n- {key}: {value}"
        
        # Send to webhook if configured
        webhook_url = getattr(settings, 'n8n_webhook_url', None) or getattr(settings, 'discord_webhook_url', None)
        
        if webhook_url:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={"content": message},
                    timeout=10.0
                )
        
        logger.info(f"📋 Mission Status: {status} - Phase {phase} - Mission {mission_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send mission status notification: {e}")
        return False


async def notify_error(
    mission_id: str,
    error_type: str,
    error_message: str,
    phase: Optional[int] = None
):
    """
    Send error notification
    
    Args:
        mission_id: Mission/session ID
        error_type: Type of error
        error_message: Error message
        phase: Phase where error occurred
    """
    try:
        from app.config import settings
        
        phase_info = f" (Phase {phase})" if phase else ""
        
        message = f"""
❌ **ViraLoop 오류 알림**

**Mission:** {mission_id}{phase_info}
**Error Type:** {error_type}
**Message:** {error_message}
"""
        
        webhook_url = getattr(settings, 'n8n_webhook_url', None) or getattr(settings, 'discord_webhook_url', None)
        
        if webhook_url:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={
                        "content": message,
                        "mission_id": mission_id,
                        "error_type": error_type,
                        "phase": phase
                    },
                    timeout=10.0
                )
        
        logger.error(f"❌ Error Alert: {error_type} - Mission {mission_id}{phase_info}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send error notification: {e}")
        return False


# Singleton instance for easy access
_notification_service = None

def get_notification_service():
    """Get notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service

class NotificationService:
    """Notification service wrapper"""
    
    async def quality_alert(self, mission_id: str, quality_score: float, status: str, details: dict = None):
        return await notify_quality_alert(mission_id, quality_score, status, details)
    
    async def mission_status(self, mission_id: str, phase: int, status: str, details: dict = None):
        return await notify_mission_status(mission_id, phase, status, details)
    
    async def error(self, mission_id: str, error_type: str, error_message: str, phase: int = None):
        return await notify_error(mission_id, error_type, error_message, phase)

def send_notification(message: str):
    """
    Send a general notification message (synchronous).
    """
    try:
        from app.config import settings
        import requests
        webhook_url = getattr(settings, 'n8n_webhook_url', None) or getattr(settings, 'discord_webhook_url', None)
        
        if webhook_url:
            requests.post(
                webhook_url,
                json={"content": message},
                timeout=10.0
            )
        logger.info(f"📨 Notification sent: {message}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send notification: {e}")
        return False