import asyncio
import logging
import json
import os
import shutil
from datetime import timedelta
from typing import List, Dict, Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from .brain import HermesBrain
from app.config import settings

logger = logging.getLogger(__name__)

class LogCollector(logging.Handler):
    """Custom handler to capture internal MCP/Process logs for the Brain."""
    def __init__(self):
        super().__init__()
        self.logs = []
    def emit(self, record):
        self.logs.append({"level": record.levelname, "message": record.getMessage()})

class HermesMissionRunner:
    """
    Orchestrates a multi-stage mission using the Hermes Brain (Decision) 
    and the OpenClaw MCP Server (Granular Execution).
    
    [v2.1] Added Phase 7 Quality Verification and Feedback Loop
    """
    def __init__(self, session_id: str, topic: str, config: Dict[str, Any]):
        self.session_id = session_id
        self.topic = topic
        self.config = config
        
        # [DYNAMIC MODEL RESOLUTION - STRICTLY DB DRIVEN]
        from app.database import SessionLocal
        from app import crud
        with SessionLocal() as db:
            db_settings = crud.get_settings(db)
            db_model = getattr(db_settings, "hermes_agent_model", None)
            provider = getattr(db_settings, "hermes_agent_provider", None)
            
            if provider and db_model and '/' not in db_model:
                self.agent_model = f"{provider}/{db_model}"
            elif db_model:
                self.agent_model = db_model
            else:
                self.agent_model = "llama-3.3-70b-versatile" # Fallback if DB is completely empty and no provider is set
                
        # Override with specific mission config if provided by the caller
        if config.get("agent_model"):
            self.agent_model = config.get("agent_model")

        self.brain = HermesBrain(agent_model=self.agent_model)
        self.log_collector = LogCollector()
        
        # Quality tracking
        self.quality_score = None
        self.retry_count = 0
        self.max_retries = 3
        
        # Configure logging to capture process stderr
        mcp_logger = logging.getLogger("mcp")
        mcp_logger.setLevel(logging.DEBUG)
        mcp_logger.addHandler(self.log_collector)
        
        # Resolve OpenClaw Root (Container Path)
        self.openclaw_root = "/app/apps/swarm"
        if not os.path.exists(self.openclaw_root):
             self.openclaw_root = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "apps/swarm")

    async def _verify_quality(self, script: str, dna: dict) -> Dict[str, Any]:
        """
        [NEW] Phase 7 Quality Verification
        Calls the quality auditor service
        """
        try:
            from app.services.quality_auditor import get_quality_auditor
            from app.llm_manager import LLMClient
            
            llm_client = LLMClient(settings)
            auditor = get_quality_auditor(llm_client)
            
            result = await auditor.verify_script(
                script=script,
                dna=str(dna),
                niche=self.config.get("niche"),
                channel_id=self.config.get("channel_id")
            )
            
            logger.info(f"🔍 [Phase 7] Quality Score: {result['score']} - Status: {result['status']}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Quality verification failed: {e}")
            return {"score": 50, "status": "REVIEW", "passed": False}  # Default to review on error
    
    async def _rollback_to_phase_3(self, reason: str):
        """
        [NEW] Rollback to Phase 3 (Script Writing)
        This is called when quality score is below threshold
        """
        await self._broadcast(
            f"⚠️ 품질 검토 결과 {self.quality_score}점으로 기준치(70점)에 미달하였습니다. "
            f"더 나은 대본을 위해 {self.retry_count}회차 재집필을 시작합니다! ✍️",
            type="task_progress"
        )
        
        logger.warning(f"🔄 [ROLLBACK] Initiating rollback to Phase 3. Reason: {reason}")
        
        # Log the rollback for tracking
        rollback_info = {
            "session_id": self.session_id,
            "from_phase": 7,
            "to_phase": 3,
            "reason": reason,
            "retry_count": self.retry_count,
            "quality_score": self.quality_score
        }
        
        logger.info(f"📋 Rollback Info: {json.dumps(rollback_info)}")
        
        # Trigger notification
        await self._notify_human_reviewer(rollback_info)
        
        return rollback_info
    
    async def _notify_human_reviewer(self, info: dict):
        """
        [NEW] Notify human reviewer when intervention needed
        """
        try:
            from app.services.notification_service import notify_quality_alert
            
            await notify_quality_alert(
                mission_id=self.session_id,
                quality_score=info.get("quality_score", 0),
                status="ROLLBACK",
                details=info
            )
        except Exception as e:
            logger.warning(f"⚠️ Notification failed: {e}")

    async def _check_quality_and_branch(self, script: str, dna: dict) -> str:
        """
        [NEW] Check quality and determine next action
        Returns: "continue" | "rollback" | "review"
        """
        quality_result = await self._verify_quality(script, dna)
        
        self.quality_score = quality_result["score"]
        
        if quality_result["passed"]:
            # Score >= 70, continue to publishing
            logger.info(f"✅ Quality check passed ({self.quality_score}), continuing to Phase 8")
            return "continue"
            
        elif quality_result.get("needs_human_review", False):
            # Score 50-70, need human review
            logger.warning(f"⚠️ Quality score {self.quality_score} requires human review")
            await self._notify_human_reviewer({
                "session_id": self.session_id,
                "quality_score": self.quality_score,
                "status": "REVIEW_NEEDED"
            })
            return "review"
            
        else:
            # Score < 50, rollback to Phase 3
            self.retry_count += 1
            
            if self.retry_count >= self.max_retries:
                logger.error(f"❌ Max retries ({self.max_retries}) exceeded. Stopping mission.")
                return "stop"
            
            await self._rollback_to_phase_3(
                reason=f"Quality score {self.quality_score} below threshold (70)"
            )
            return "rollback"

    async def _broadcast(self, message: str, type: str = "task_progress", action: dict = None):
        """Helper to send WebSocket broadcasts via the API's internal endpoint."""
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                await client.post("http://api:8000/api/swarm/broadcast", json={
                    "message": message,
                    "type": type,
                    "session_id": self.session_id,
                    "action": action
                })
        except Exception as e:
            logger.warning(f"⚠️ Broadcast failed: {e}")

    async def run(self):
        """
        [SOVEREIGN] Upgraded 10-Phase Cycle with Intelligent Failover.
        """
        logger.info(f"⚡ [MissionRunner] Initiating 10-Phase Sovereign Cycle for: {self.topic}")
        
        # [FAILOVER CONFIG] - STRICT LOCKDOWN: Single model only, no fallbacks as per user command
        models_to_try = [self.agent_model]
        current_model_idx = 0
        quality_branch = "none"

        # [NEW] Fetch DB-stored API keys to inject into the agent environment
        from app.database import SessionLocal
        from app import crud
        db_keys = {}
        with SessionLocal() as db:
            db_settings = crud.get_settings(db)
            if db_settings:
                if db_settings.nvidia_api_keys: db_keys["NVIDIA_API_KEY"] = db_settings.nvidia_api_keys[0]
                if db_settings.groq_api_keys: db_keys["GROQ_API_KEY"] = db_settings.groq_api_keys[0]
                if db_settings.gemini_api_keys: db_keys["GOOGLE_API_KEY"] = db_settings.gemini_api_keys[0]
                if hasattr(db_settings, "openrouter_api_keys") and db_settings.openrouter_api_keys:
                    db_keys["OPENROUTER_API_KEY"] = db_settings.openrouter_api_keys[0]
                elif hasattr(db_settings, "openrouter_api_key") and db_settings.openrouter_api_key:
                    db_keys["OPENROUTER_API_KEY"] = db_settings.openrouter_api_key

        while self.retry_count < self.max_retries:
            current_agent_model = models_to_try[current_model_idx % len(models_to_try)]
            
            # [BROADCAST] Notify user of current status
            if self.retry_count > 0:
                await self._broadcast(f"🔄 [시도 {self.retry_count + 1}] {current_agent_model} 모델로 다시 시도합니다...")

            server_params = StdioServerParameters(
                command="/usr/bin/node",
                args=[
                    "--import", "/app/apps/swarm/silence.js",
                    "/app/apps/swarm/node_modules/tsx/dist/cli.mjs", 
                    "/app/apps/swarm/mcp_server.ts"
                ],
                cwd=self.openclaw_root,
                env={
                    **os.environ, 
                    **db_keys, 
                    "SESSION_ID": self.session_id, 
                    "AGENT_MODEL": current_agent_model,
                    "PI_SKIP_VERSION_CHECK": "true",
                    "LOG_LEVEL": "error"
                }
            )

            try:
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=300)) as session:
                        await session.initialize()
                        
                        channel_id = self.config.get("channel_id")
                        niche = self.config.get("niche", "general")

                        # Phase 1: Discovery (Research)
                        logger.info("🔎 Phase 1: Market Gap Analysis...")
                        await self._broadcast(f"🔍 [Phase 1] {self.topic} 관련 시장 분석을 시작합니다...")
                        research = await session.call_tool("scout_market_gap", {"niche": niche}, read_timeout_seconds=timedelta(seconds=300))
                        
                        # Phase 2: DNA Injection & Direction
                        logger.info("🧬 Phase 2: DNA Injection & Direction...")
                        dna = {}
                        if channel_id and channel_id != "None" and str(channel_id).lower() != "null":
                            try:
                                import httpx
                                async with httpx.AsyncClient() as client:
                                    dna_resp = await client.get(f"http://api:8000/api/channels/{channel_id}/dna")
                                    dna = dna_resp.json() if dna_resp.status_code == 200 else {}
                            except Exception as e:
                                logger.warning(f"⚠️ DNA fetch failed for channel {channel_id}: {e}")
                        
                        if not dna:
                            dna = {"brand_voice": "professional, calm, and helpful", "target_audience_avatar": "Senior/Informational", "visual": {"color_grading": "natural"}}
                        
                        direction = await session.call_tool("generate_director_schema", {
                            "script_content": str(research.content), 
                            "mood": dna.get("visual", {}).get("color_grading", "natural")
                        }, read_timeout_seconds=timedelta(seconds=300))

                        # Phase 3: Premium Scripting
                        logger.info(f"✍️ Phase 3: Premium Scripting using {current_agent_model}...")
                        await self._broadcast(f"✍️ [Phase 3] {current_agent_model} 기반 대본 작성을 시작합니다...")
                        
                        script_gen = await session.call_tool("generate_script", {
                            "topic": self.topic, "niche": niche, "wisdom_context": str(research.content)
                        }, read_timeout_seconds=timedelta(seconds=300))
                        
                        # Detect Failover Need
                        result_text = str(script_gen.content)
                        if any(x in result_text.lower() for x in ["rate limit", "429", "quota", "limit exceeded"]) or "Tool Execution Error" in result_text:
                             logger.warning(f"⚠️ [Failover] Issue detected on {current_agent_model}. Switching to stronger intelligence...")
                             current_model_idx += 1
                             self.retry_count += 1
                             continue # Restart with new model

                        mutated_script = await session.call_tool("mutate_script_persona", {
                            "original_script": str(script_gen.content),
                            "persona": dna.get("target_audience_avatar", "General"),
                            "intensity": 0.8
                        }, read_timeout_seconds=timedelta(seconds=300))
                        
                        current_script = str(mutated_script.content)
                        
                        if "Tool Execution Error" in current_script or "exited with code 1" in current_script:
                            logger.warning(f"⚠️ [Persona Error] Mutation failed with {current_agent_model}. Escalating...")
                            current_model_idx += 1
                            self.retry_count += 1
                            continue

                        await self._broadcast("✅ 대본 초안 작성이 완료되었습니다. 페르소나 최적화 중...")
                        
                        validation = await session.call_tool("verify_script_dna", {
                            "channel_id": channel_id, "script_content": current_script
                        }, read_timeout_seconds=timedelta(seconds=300))

                        # Phase 7: Assembly & Quality Verification
                        quality_branch = await self._check_quality_and_branch(current_script, dna)
                        
                        if quality_branch == "continue":
                            await self._broadcast("🎬 [Phase 7] 대본이 품질 기준을 통과했습니다! 영상 제작을 시작합니다.")
                            render_result = await session.call_tool("render_video_shorts", {
                                "script_content": current_script, "niche": niche,
                                "voice_actor": dna.get("voice", {}).get("actor", "ko-KR-Standard-A")
                            }, read_timeout_seconds=timedelta(seconds=300))
                            await self._broadcast("✅ 영상 렌더링이 성공적으로 시작되었습니다.")
                            
                            # Final Reflection
                            learnings = await self.brain.reflect_on_mission(self.session_id, niche, self.log_collector.logs)
                            await session.call_tool("sync_channel_dna", {
                                "channel_id": channel_id, "reflection_insights": {"success_patterns": [str(learnings)]}
                            }, read_timeout_seconds=timedelta(seconds=300))

                            return {"status": "COMPLETED", "quality_score": self.quality_score, "learnings": learnings}
                        elif quality_branch == "rollback":
                            self.retry_count += 1
                            continue
                        else:
                            return {"status": "FAILED", "reason": "quality_threshold_exceeded"}

            except Exception as e:
                import traceback
                logger.error(f"💥 Mission failure: {e}")
                logger.error(traceback.format_exc())
                
                self.retry_count += 1
                await self._broadcast(
                    f"⚠️ 시스템 오류 또는 모델 응답 지연이 발생했습니다. "
                    f"현재 {self.retry_count}회차 자동 복구를 시도 중입니다... (원인: {str(e)[:50]}...)",
                    type="task_progress"
                )
                
                current_model_idx += 1
                await asyncio.sleep(3)
                continue
        
        return {"status": "FAILED", "reason": "max_retries_reached"}


async def execute_mission(session_id: str, topic: str, config: Dict[str, Any]):
    runner = HermesMissionRunner(session_id, topic, config)
    return await runner.run()