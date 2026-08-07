"""
Webhook Automation Service

Provides:
1. Webhook registration and management
2. Event-driven automation
3. Webhook triggering and retries
4. Payload transformation
5. Security (signature verification)

Usage:
    webhook = WebhookService()
    
    # Register webhook
    await webhook.register(
        url="https://example.com/webhook",
        events=["video.published", "quality.approved"],
        secret="my_secret"
    )
    
    # Trigger webhook
    await webhook.trigger("video.published", {"video_id": 123})
"""

import os
import asyncio
import logging
import json
import hmac
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class WebhookEvent(Enum):
    """Webhook events"""
    VIDEO_PUBLISHED = "video.published"
    VIDEO_FAILED = "video.failed"
    QUALITY_APPROVED = "quality.approved"
    QUALITY_REJECTED = "quality.rejected"
    UPLOAD_COMPLETE = "upload.complete"
    UPLOAD_FAILED = "upload.failed"
    CHANNEL_SYNC_COMPLETE = "channel.sync.complete"
    AGENT_TASK_COMPLETE = "agent.task.complete"
    SYSTEM_ALERT = "system.alert"


class WebhookStatus(Enum):
    """Webhook status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    PAUSED = "paused"


@dataclass
class Webhook:
    """Webhook definition"""
    webhook_id: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    status: WebhookStatus = WebhookStatus.ACTIVE
    retry_count: int = 3
    timeout: int = 30
    headers: Dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_triggered: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0


@dataclass
class WebhookDelivery:
    """Webhook delivery attempt"""
    delivery_id: str
    webhook_id: str
    event: str
    payload: Dict[str, Any]
    status: str = "pending"  # pending, success, failed
    response_code: int = 0
    response_body: str = ""
    attempts: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    delivered_at: Optional[datetime] = None


class WebhookService:
    """
    Webhook Automation Service
    
    Features:
    - Event-driven webhook triggers
    - Signature verification
    - Retry logic with exponential backoff
    - Payload transformation
    - Delivery tracking
    """
    
    def __init__(self):
        self._webhooks: Dict[str, Webhook] = {}
        self._event_subscriptions: Dict[str, List[str]] = {}  # event -> webhook_ids
        self._deliveries: Dict[str, WebhookDelivery] = {}
        
        # Retry configuration
        self._max_retries = 3
        self._base_delay = 1  # seconds
        
        # Event handlers (local functions)
        self._event_handlers: Dict[str, Callable] = {}
        
        logger.info("WebhookService initialized")
    
    async def register(
        self,
        url: str,
        events: List[str],
        secret: str = None,
        retry_count: int = 3,
        timeout: int = 30,
        headers: Dict[str, str] = None
    ) -> str:
        """
        Register a webhook
        
        Args:
            url: Webhook URL
            events: List of events to subscribe to
            secret: Secret for signature verification
            retry_count: Number of retries on failure
            timeout: Request timeout in seconds
            headers: Custom headers
            
        Returns:
            Webhook ID
        """
        webhook_id = f"wh_{uuid.uuid4().hex[:12]}"
        
        webhook = Webhook(
            webhook_id=webhook_id,
            url=url,
            events=events,
            secret=secret,
            retry_count=retry_count,
            timeout=timeout,
            headers=headers or {}
        )
        
        self._webhooks[webhook_id] = webhook
        
        # Subscribe to events
        for event in events:
            if event not in self._event_subscriptions:
                self._event_subscriptions[event] = []
            self._event_subscriptions[event].append(webhook_id)
        
        logger.info(f"[OK] Webhook registered: {webhook_id} for events: {events}")
        
        return webhook_id
    
    def unregister(self, webhook_id: str) -> bool:
        """Unregister a webhook"""
        if webhook_id not in self._webhooks:
            return False
        
        webhook = self._webhooks[webhook_id]
        
        # Remove from event subscriptions
        for event in webhook.events:
            if event in self._event_subscriptions:
                self._event_subscriptions[event] = [
                    w for w in self._event_subscriptions[event]
                    if w != webhook_id
                ]
        
        del self._webhooks[webhook_id]
        
        logger.info(f"🗑️ Webhook unregistered: {webhook_id}")
        return True
    
    async def trigger(
        self,
        event: str,
        payload: Dict[str, Any],
        synchronous: bool = False
    ) -> List[str]:
        """
        Trigger webhooks for an event
        
        Args:
            event: Event name
            payload: Event payload
            synchronous: Wait for delivery
            
        Returns:
            List of delivery IDs
        """
        delivery_ids = []
        
        # Get subscribed webhooks
        webhook_ids = self._event_subscriptions.get(event, [])
        
        if not webhook_ids:
            logger.debug(f"No webhooks subscribed to event: {event}")
            return delivery_ids
        
        logger.info(f"📡 Triggering {len(webhook_ids)} webhooks for event: {event}")
        
        # Trigger each webhook
        for webhook_id in webhook_ids:
            webhook = self._webhooks.get(webhook_id)
            
            if not webhook or webhook.status != WebhookStatus.ACTIVE:
                continue
            
            # Create delivery
            delivery_id = f"dlv_{uuid.uuid4().hex[:12]}"
            delivery = WebhookDelivery(
                delivery_id=delivery_id,
                webhook_id=webhook_id,
                event=event,
                payload=payload
            )
            
            self._deliveries[delivery_id] = delivery
            delivery_ids.append(delivery_id)
            
            # Deliver asynchronously
            if synchronous:
                await self._deliver_webhook(delivery, webhook)
            else:
                asyncio.create_task(self._deliver_webhook(delivery, webhook))
        
        return delivery_ids
    
    async def _deliver_webhook(self, delivery: WebhookDelivery, webhook: Webhook):
        """Deliver webhook with retry logic"""
        url = webhook.url
        
        # Prepare payload
        payload = {
            "event": delivery.event,
            "timestamp": datetime.now().isoformat(),
            "data": delivery.payload
        }
        
        # Add signature if secret is set
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": delivery.event,
            "X-Webhook-Delivery": delivery.delivery_id,
            **webhook.headers
        }
        
        if webhook.secret:
            payload_str = json.dumps(payload, sort_keys=True)
            signature = hmac.new(
                webhook.secret.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        # Try to deliver
        for attempt in range(webhook.retry_count):
            delivery.attempts += 1
            
            try:
                import httpx
                
                async with httpx.AsyncClient(timeout=webhook.timeout) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers=headers
                    )
                    
                    delivery.response_code = response.status_code
                    delivery.response_body = response.text[:500]  # Limit size
                    
                    if response.status_code < 400:
                        delivery.status = "success"
                        delivery.delivered_at = datetime.now()
                        webhook.success_count += 1
                        webhook.last_triggered = datetime.now()
                        
                        logger.info(f"[OK] Webhook delivered: {delivery.delivery_id}")
                        break
                    else:
                        logger.warning(f"[WARN] Webhook failed ({response.status_code}): {delivery.delivery_id}")
                        
            except Exception as e:
                logger.warning(f"[WARN] Webhook delivery error: {e}")
                delivery.response_body = str(e)[:500]
            
            # Retry with exponential backoff
            if attempt < webhook.retry_count - 1:
                delay = self._base_delay * (2 ** attempt)
                logger.info(f"[WAIT] Retrying in {delay}s...")
                await asyncio.sleep(delay)
        
        # All retries failed
        if delivery.status != "success":
            delivery.status = "failed"
            webhook.failure_count += 1
            logger.error(f"[FAIL] Webhook delivery failed after {webhook.retry_count} attempts: {delivery.delivery_id}")
    
    def get_webhook(self, webhook_id: str) -> Optional[Webhook]:
        """Get webhook by ID"""
        return self._webhooks.get(webhook_id)
    
    def get_delivery(self, delivery_id: str) -> Optional[WebhookDelivery]:
        """Get delivery by ID"""
        return self._deliveries.get(delivery_id)
    
    def list_webhooks(self, event: str = None, status: WebhookStatus = None) -> List[Dict]:
        """List webhooks"""
        webhooks = list(self._webhooks.values())
        
        if event:
            webhooks = [w for w in webhooks if event in w.events]
        
        if status:
            webhooks = [w for w in webhooks if w.status == status]
        
        return [
            {
                "webhook_id": w.webhook_id,
                "url": w.url,
                "events": w.events,
                "status": w.status.value,
                "success_count": w.success_count,
                "failure_count": w.failure_count,
                "last_triggered": w.last_triggered.isoformat() if w.last_triggered else None
            }
            for w in webhooks
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get webhook statistics"""
        total_webhooks = len(self._webhooks)
        active_webhooks = sum(
            1 for w in self._webhooks.values()
            if w.status == WebhookStatus.ACTIVE
        )
        
        total_deliveries = len(self._deliveries)
        successful = sum(
            1 for d in self._deliveries.values()
            if d.status == "success"
        )
        
        return {
            "total_webhooks": total_webhooks,
            "active_webhooks": active_webhooks,
            "total_deliveries": total_deliveries,
            "successful_deliveries": successful,
            "failed_deliveries": total_deliveries - successful,
            "success_rate": (successful / total_deliveries * 100) if total_deliveries > 0 else 0,
            "subscribed_events": list(self._event_subscriptions.keys())
        }
    
    def pause_webhook(self, webhook_id: str) -> bool:
        """Pause webhook"""
        if webhook_id in self._webhooks:
            self._webhooks[webhook_id].status = WebhookStatus.PAUSED
            return True
        return False
    
    def resume_webhook(self, webhook_id: str) -> bool:
        """Resume webhook"""
        if webhook_id in self._webhooks:
            self._webhooks[webhook_id].status = WebhookStatus.ACTIVE
            return True
        return False


# Global singleton
_webhook_service = None

def get_webhook_service() -> WebhookService:
    """Get global WebhookService instance"""
    global _webhook_service
    if _webhook_service is None:
        _webhook_service = WebhookService()
    return _webhook_service