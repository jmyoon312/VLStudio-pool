import logging
import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

from ...config import settings
from ...database import SessionLocal
from ... import models

logger = logging.getLogger(__name__)

class OpenClawOrchestrator:
    """
    Orchestrator for managing OpenClaw agent missions.
    Decoupled from local process execution to support distributed scaling via RabbitMQ.
    """
    def __init__(self):
        # Resolve project root
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
        self.openclaw_root = os.path.join(project_root, "openclaw")
        
        self.active_sessions: Dict[str, Any] = {}
        # [REMOVED] Hardcoded agent_model. Now fetched dynamically from DB in spawn_agent.

    async def spawn_agent(self, topic: str, config: Optional[Dict[str, Any]] = None) -> str:
        """
        Queues a new autonomous video production mission.
        Actual execution is handled by a distributed Worker.
        """
        import uuid
        
        session_id = str(uuid.uuid4())[:8]
        logger.info(f"🤖 [Orchestrator] Queuing agent for topic: {topic} (Session: {session_id})")
        
        # 1. Initialize DB Session and Fetch Dynamic Config
        with SessionLocal() as db:
            from ... import crud
            db_settings = crud.get_settings(db)
            provider = db_settings.hermes_agent_provider or "nvidia"
            model = db_settings.hermes_agent_model or "llama-3.3-70b-versatile"
            
            if "/" not in model and provider != "auto":
                effective_agent_model = f"{provider}/{model}"
            else:
                effective_agent_model = model
            
            swarm_config = db.query(models.GlobalSwarmConfig).first()
            global_mode = swarm_config.swarm_mode if swarm_config else "CONFIRMATION"
            
            channel_id = config.get("channel_id") if config else None
            channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first() if channel_id else None
            
            if global_mode == "ADAPTIVE":
                effective_mode = channel.autonomy_status if channel else "CONFIRMATION"
            else:
                effective_mode = global_mode

            new_session = models.AgentSwarmSession(
                id=session_id,
                topic=topic,
                status="INITIALIZING",
                config_json={**(config or {}), "swarm_mode": effective_mode, "agent_model": effective_agent_model}
            )
            db.add(new_session)
            db.commit()

        # 2. Publish to RabbitMQ
        try:
            from ...core.broker import broker
            
            enriched_config = {
                **(config or {}),
                "swarm_mode": effective_mode,
                "agent_model": effective_agent_model,
                "quality_mode": str(config.get("quality_mode", "auto")) if config else "auto"
            }

            success = await broker.publish_mission(
                session_id=session_id,
                topic=topic,
                config=enriched_config
            )
            
            if not success:
                raise Exception("Failed to publish mission to RabbitMQ")

            with SessionLocal() as db:
                session = db.query(models.AgentSwarmSession).filter(models.AgentSwarmSession.id == session_id).first()
                if session:
                    session.status = "QUEUED"
                    db.commit()
            
            logger.info(f"✅ [Orchestrator] Mission successfully queued: {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"❌ [Orchestrator] Failed to queue mission: {e}")
            with SessionLocal() as db:
                session = db.query(models.AgentSwarmSession).filter(models.AgentSwarmSession.id == session_id).first()
                if session:
                    session.status = "FAILED"
                    session.config_json = {**(session.config_json or {}), "error": str(e)}
                    db.commit()
            raise e

    def get_status(self, session_id: str) -> Dict[str, Any]:
        """Returns the current status of a mission from the database."""
        with SessionLocal() as db:
            session = db.query(models.AgentSwarmSession).filter(models.AgentSwarmSession.id == session_id).first()
            if not session: return {"status": "not_found"}
            return {
                "id": session.id,
                "topic": session.topic,
                "status": session.status,
                "created_at": session.created_at,
                "completed_at": session.completed_at
            }

orchestrator = OpenClawOrchestrator()
