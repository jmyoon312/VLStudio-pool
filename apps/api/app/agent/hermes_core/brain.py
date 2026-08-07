import logging
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.llm_manager import LLMClient
from app.database import SessionLocal
from app.models import MissionExperience

logger = logging.getLogger(__name__)

class HermesBrain:
    """
    The Sovereign Intelligence Core of ViraLoop.
    Integrated with the production PostgreSQL pool for collective intelligence.
    [Phase 4-2] Upgraded with Semantic Vector Memory.
    """
    def __init__(self, agent_model: Optional[str] = None):
        from app.crud import get_settings
        with SessionLocal() as db:
            db_settings = get_settings(db)
            self.llm = LLMClient(db_settings)
            
            # Use provided agent_model, or construct from DB settings
            if agent_model:
                self.agent_model = agent_model
            else:
                provider = getattr(db_settings, "hermes_agent_provider", "nvidia")
                model = getattr(db_settings, "hermes_agent_model", "llama-3.3-70b-versatile")
                # Format for LLMClient (e.g., "groq/llama-3.1-8b-instant")
                if provider != "auto" and "/" not in model:
                    self.agent_model = f"{provider}/{model}"
                else:
                    self.agent_model = model
                    
        logger.info(f"🧠 [HermesBrain] Initialized with model: {self.agent_model}")

    def get_wisdom_context(self, topic: str) -> Optional[str]:
        """
        [Phase 4-2] Semantic Memory Retrieval:
        Uses vector similarity to find the most relevant past successes.
        """
        try:
            with SessionLocal() as db:
                # 1. Generate Embedding for current topic
                logger.info(f"🔎 [HermesBrain] Generating embedding for topic: {topic}")
                topic_vector = self.llm.embed_text(topic)
                
                # 2. Semantic Similarity Search (Cosine distance)
                # Find the top successful mission that is semantically closest
                from pgvector.sqlalchemy import Vector
                past_mission = db.query(MissionExperience).filter(
                    MissionExperience.success == True,
                    MissionExperience.embedding != None
                ).order_by(
                    MissionExperience.embedding.cosine_distance(topic_vector)
                ).first()

                if past_mission:
                    logger.info(f"🧠 [HermesBrain] Semantic Wisdom Found! (Match: {past_mission.topic})")
                    return f"PAST SUCCESS CONTEXT ({past_mission.topic}): {past_mission.learnings}"
                
                logger.info("ℹ️ [HermesBrain] No relevant semantic wisdom found.")
                return None
        except Exception as e:
            logger.error(f"[FAIL] [HermesBrain] Wisdom retrieval failed: {e}")
            return None

    async def reflect_on_mission(self, session_id: str, niche: str, logs: List[Dict[str, Any]]) -> str:
        """
        [Phase 4-2] Deep Reflection & Semantic Minting:
        Analyzes logs and generates a vector for future recall.
        """
        logger.info(f"🧠 [HermesBrain] Reflecting on session {session_id} for niche {niche}")
        
        # 1. Prepare log data for analysis
        log_snippet = "\n".join([f"[{l.get('level', 'INFO')}] {l.get('message', '')}" for l in logs[-100:]])
        
        prompt = f"""
        Analyze the following high-precision execution logs from an autonomous video agent (Session: {session_id}).
        Niche: {niche}
        
        LOGS:
        {log_snippet}
        
        TASK:
        1. Determine if the mission was successful (final video produced).
        2. Identify precise technical bottlenecks (API quota, FFmpeg error, script logic).
        3. Extract a "Successful Strategy" for the collective intelligence.
        
        Return the result ONLY as a JSON object:
        {{
            "success": boolean,
            "bottleneck": "string",
            "strategy": "string",
            "summary": "one sentence summary"
        }}
        """
        
        system_instruction = "You are the ViraLoop Sovereign Intelligence Analyst. Your goal is to maximize agent autonomy."
        
        try:
            # 2. Call LLM for reasoning
            response_raw = self.llm.generate_content(
                prompt=prompt,
                model_name=self.agent_model,
                system_instruction=system_instruction
            )
            
            if not response_raw:
                raise ValueError("LLM returned empty or None response")

            # JSON extraction
            json_text = response_raw.strip()
            if "```json" in json_text:
                json_text = json_text.split("```json")[1].split("```")[0].strip()
            elif "```" in json_text:
                json_text = json_text.split("```")[1].split("```")[0].strip()
                
            analysis = json.loads(json_text)
            success = analysis.get("success", False)
            bottleneck = analysis.get("bottleneck", "None")
            strategy = analysis.get("strategy", analysis.get("summary", "No clear strategy extracted."))
            summary = analysis.get("summary", "Mission processed.")
            
            # [Phase 4-2] Generate embedding for successful strategies
            embedding = None
            if success:
                logger.info(f"[MAGIC] [HermesBrain] Minting Semantic Experience for {niche}")
                embedding = self.llm.embed_text(f"{niche} {strategy}")

            # 3. Save to production persistent memory (PostgreSQL)
            with SessionLocal() as db:
                experience = MissionExperience(
                    session_id=session_id,
                    niche=niche,
                    topic=summary, # Contextual topic
                    success=success,
                    bottleneck=bottleneck,
                    learnings=strategy,
                    summary=summary,
                    embedding=embedding
                )
                db.add(experience)
                db.commit()
                logger.info(f"[SAVE] [HermesBrain] Semantic Wisdom stored in production DB for session {session_id}")
            
            return strategy
            
        except Exception as e:
            logger.error(f"[FAIL] [HermesBrain] LLM Reflection failed: {e}")
            return f"Reflection failed: {str(e)}"
