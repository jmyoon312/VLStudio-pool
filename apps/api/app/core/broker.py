import json
import logging
import asyncio
import aio_pika
from typing import Dict, Any

from ..config import settings

logger = logging.getLogger(__name__)

class MissionBroker:
    _instance = None
    _connection = None
    _channel = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MissionBroker, cls).__new__(cls)
        return cls._instance

    async def get_connection(self):
        if self._connection is None or self._connection.is_closed:
            logger.info(f"🔗 [Broker] Connecting to RabbitMQ at {settings.RABBITMQ_URL}")
            try:
                self._connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            except Exception as e:
                logger.error(f"❌ [Broker] Failed to connect to RabbitMQ: {e}")
                raise e
        return self._connection

    async def get_channel(self):
        conn = await self.get_connection()
        if self._channel is None or self._channel.is_closed:
            self._channel = await conn.channel()
            
            # --- Phase C-2: Dead Letter Exchange (DLX) Setup ---
            # Ensures that failed or unprocessable missions are captured for self-healing
            dlx_name = f"{settings.AGENT_QUEUE_NAME}.dlx"
            dlq_name = f"{settings.AGENT_QUEUE_NAME}.dead"
            
            await self._channel.declare_exchange(dlx_name, type="direct", durable=True)
            dlq = await self._channel.declare_queue(dlq_name, durable=True)
            await dlq.bind(dlx_name, routing_key="failed")
            
            # Declare main queue with DLX configuration
            await self._channel.declare_queue(
                settings.AGENT_QUEUE_NAME, 
                durable=True,
                arguments={
                    "x-dead-letter-exchange": dlx_name,
                    "x-dead-letter-routing-key": "failed"
                }
            )
            logger.info(f"📁 [Broker] Multi-Agent Queues declared with DLX: {settings.AGENT_QUEUE_NAME}")
        return self._channel

    async def publish_mission(self, session_id: str, topic: str, config: Dict[str, Any]):
        """
        Publish a mission to the RabbitMQ queue for a worker to pick up.
        """
        try:
            channel = await self.get_channel()
            
            payload = {
                "session_id": session_id,
                "topic": topic,
                "config": config,
                "timestamp": str(asyncio.get_event_loop().time())
            }
            
            message_body = json.dumps(payload).encode()
            
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=message_body,
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=settings.AGENT_QUEUE_NAME
            )
            
            logger.info(f"🚀 [Broker] Mission published for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"❌ [Broker] Failed to publish mission: {e}")
            return False

    async def close(self):
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("🔌 [Broker] Connection closed")

broker = MissionBroker()
