import logging
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime

from .services.video.orchestrator import VideoOrchestrator
from .services.creative import CreativeService
from .services.intelligence import IntelligenceService
from .services.stealth import StealthService
from .services.persona import PersonaService
from .services.openclaw.orchestrator import OpenClawOrchestrator
from .database import SessionLocal
from . import models
from .services.sop_orchestrator import SOPOrchestrator
from .llm_manager import LLMClient

logger = logging.getLogger(__name__)

class SwarmCoordinator:
    """
    Central Brain of the OpenClaw Agent Swarm.
    Orchestrates high-level missions by coordinating specialized services.
    [UPGRADE] Multi-agent parallel processing and batch operations.
    """
    def __init__(self, settings):
        self.settings = settings
        self.db = SessionLocal()
        
        # Initialize Sub-Services
        self.video = VideoOrchestrator(settings)
        self.creative = CreativeService(None)
        self.intelligence = IntelligenceService(settings)
        self.stealth = StealthService(settings)
        self.persona = PersonaService(self.db, settings)
        
        # [NEW] OpenClaw Orchestrator for multi-agent management
        self.openclaw = OpenClawOrchestrator()
        self.sop = SOPOrchestrator(settings, LLMClient(settings))
        
        # [NEW] Batch configuration
        self.max_concurrent_agents = settings.MAX_CONCURRENT_RENDERS or 2

    async def execute_mission_factory_run(self, channel_id: int, format: str = "shorts", quality_mode: str = "auto"):
        """
        MISSION: FULL PRODUCTION RUN (OpenClaw Autonomous Agent Powered)
        Spawns the new LLM-based coordinator agent for a given channel.
        """
        logger.info(f"🚩 [Swarm] MISSION START: Full Factory Run for Channel #{channel_id} | format={format} | quality={quality_mode}")
        
        try:
            with SessionLocal() as db:
                channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
                topic = getattr(channel, 'niche', None) or getattr(channel, 'title', None) or f"Channel_{channel_id}_Viral_Shorts"
            
            session_id = await self.openclaw.spawn_agent(
                topic=topic,
                config={
                    "channel_id":   channel_id,
                    "format":       format,
                    "quality_mode": quality_mode
                }
            )
            logger.info(f"[FALLBACK] [Swarm] Autonomous Agent Spawned! Session: {session_id} | Topic: {topic}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] [Swarm] MISSION FAILED to start: {e}")
            return False

    async def execute_parallel_production(self, topics: List[str]) -> Dict[str, Any]:
        """
        [NEW] Executes multiple agent sessions in parallel.
        Used for batch video production across different topics.
        
        Args:
            topics: List of topic strings to produce videos for
            
        Returns:
            Dictionary with session IDs and status
        """
        logger.info(f"[FALLBACK] [Swarm] Starting PARALLEL production for {len(topics)} topics")
        
        results = {
            "started": [],
            "failed": [],
            "total": len(topics)
        }
        
        # Limit concurrent agents
        topics_to_run = topics[:self.max_concurrent_agents]
        
        # Create tasks for parallel execution
        async def spawn_topic(topic: str):
            try:
                session_id = await self.openclaw.spawn_agent(topic)
                return {"topic": topic, "session_id": session_id, "status": "started"}
            except Exception as e:
                logger.error(f"Failed to spawn agent for {topic}: {e}")
                return {"topic": topic, "error": str(e), "status": "failed"}
        
        # Execute in parallel with semaphore to limit concurrency
        semaphore = asyncio.Semaphore(self.max_concurrent_agents)
        
        async def limited_spawn(topic: str):
            async with semaphore:
                return await spawn_topic(topic)
        
        # Run all topics in parallel
        tasks = [limited_spawn(topic) for topic in topics_to_run]
        task_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in task_results:
            if isinstance(result, Exception):
                results["failed"].append({"error": str(result)})
            elif result.get("status") == "started":
                results["started"].append(result)
            else:
                results["failed"].append(result)
        
        logger.info(f"[OK] [Swarm] Parallel production complete: {len(results['started'])} started, {len(results['failed'])} failed")
        return results

    async def execute_batch_production(self, channel_ids: List[int], topics_per_channel: int = 3) -> Dict[str, Any]:
        """
        [NEW] Batch production for multiple channels.
        Creates multiple topics per channel and runs in parallel.
        """
        logger.info(f"[BOX] [Swarm] Starting BATCH production for {len(channel_ids)} channels")
        
        topics = []
        for channel_id in channel_ids:
            for i in range(topics_per_channel):
                topics.append(f"Channel_{channel_id}_Topic_{i+1}")
        
        return await self.execute_parallel_production(topics)

    async def get_swarm_status(self) -> Dict[str, Any]:
        """
        [NEW] Get current swarm status including active sessions.
        """
        from app.services.openclaw.orchestrator import orchestrator
        
        active = orchestrator.active_sessions
        return {
            "active_agents": len(active),
            "max_concurrent": self.max_concurrent_agents,
            "sessions": [
                {
                    "session_id": sid,
                    "topic": info.get("topic"),
                    "started": info.get("start_time").isoformat() if info.get("start_time") else None,
                    "pid": info.get("pid")
                }
                for sid, info in active.items()
            ]
        }

    async def terminate_session(self, session_id: str) -> bool:
        """
        [NEW] Terminate a specific agent session.
        """
        from app.services.openclaw.orchestrator import orchestrator
        
        if session_id in orchestrator.active_sessions:
            try:
                process = orchestrator.active_sessions[session_id].get("process")
                if process:
                    process.terminate()
                    await process.wait()
                    del orchestrator.active_sessions[session_id]
                    
                    # Update DB
                    with SessionLocal() as db:
                        session = db.query(models.AgentSwarmSession).filter(
                            models.AgentSwarmSession.id == session_id
                        ).first()
                        if session:
                            session.status = "TERMINATED"
                            session.completed_at = datetime.now()
                            db.commit()
                    
                    logger.info(f"[OK] [Swarm] Session {session_id} terminated")
                    return True
            except Exception as e:
                logger.error(f"Failed to terminate session {session_id}: {e}")
        
        return False

    async def run_daily_incubation_swarm(self):
        """
        MISSION: GLOBAL ACCOUNT WARMUP
        Triggers warmup activities for all managed channels.
        """
        logger.info("🌞 MISSION START: Daily Incubation Swarm")
        return True

    async def execute_premium_sop_run(self, channel_id: int, niche: str = None, ref_data: str = ""):
        """
        [Premium V2] Executes a full High-Quality SOP mission.
        """
        logger.info(f"💎 [Swarm] MISSION START: Premium SOP Run for Channel #{channel_id}")
        return await self.sop.run_premium_mission(
            channel_id=channel_id,
            niche=niche or f"Channel_{channel_id}_Premium",
            ref_data=ref_data
        )

    def close(self):
        self.db.close()
        if hasattr(self.openclaw, 'close'):
            self.openclaw.close()