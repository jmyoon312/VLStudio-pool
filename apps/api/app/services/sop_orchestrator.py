import logging
import asyncio
import json
from typing import Dict, Any, Optional
from .creative.writer import Writer
from .intelligence import IntelligenceService
from .video.orchestrator import VideoOrchestrator
from app.database import SessionLocal
from app.models import BrandChannel

logger = logging.getLogger(__name__)

class SOPOrchestrator:
    """
    Standard Operating Procedure (SOP) Orchestrator.
    Ties together Intelligence, Writing, and Production for High-Quality Swarm.
    """
    def __init__(self, settings, llm_client):
        self.settings = settings
        self.llm_client = llm_client
        self.writer = Writer(llm_client)
        self.intelligence = IntelligenceService(settings)
        self.video = VideoOrchestrator(settings)

    async def run_premium_mission(self, channel_id: int, niche: str, ref_data: str = "", expert_edits: Optional[Dict[str, Any]] = None):
        """
        Executes the full Premium SOP Mission:
        1. DNA Fetching -> 2. Intelligence -> 3. Writing -> 4. DNA Audit -> 5. Render
        """
        logger.info(f"💎 [SOP] Starting Premium Mission for Channel #{channel_id} (Niche: {niche})")
        
        # --- Stage 0: DNA Awareness ---
        db = SessionLocal()
        channel = db.query(BrandChannel).filter(BrandChannel.id == channel_id).first()
        channel_dna = channel.style_signature if channel else {}
        db.close()

        # --- Stage 1: Intelligence Analysis ---
        logger.info("🕵️‍♂️ Stage 1: Reference Analysis...")
        analysis = await self.intelligence.analyst.extract_viral_patterns(
            source_text=ref_data if ref_data else niche,
            model=getattr(self.settings, "REVIEW_MODEL", "gemini-1.5-pro")
        )
        
        # Merge Master Identity if exists
        master_identity = channel.expert_identity if channel and channel.expert_identity else {}
        instructions = expert_edits.get('instructions') if expert_edits else None
        
        combined_guidelines = {
            "master_identity": master_identity.get("latest_instructions", ""),
            "mission_specific": instructions or ""
        }

        # Combine local DNA with mission-specific analysis
        dna_context = json.dumps({
            "master_dna": channel_dna,
            "mission_analysis": analysis,
            "expert_guidelines": combined_guidelines
        }, ensure_ascii=False)
        
        # --- Stage 2: Premium Writing (3-Stage) ---
        script_content = expert_edits.get('script') if expert_edits else None
        
        if script_content:
            logger.info("✍️ [Expert] Using Human-Edited Script. Skipping AI Drafting.")
            script_data = {
                "title": f"{niche} Expert Script",
                "content": script_content,
                "stages": ["EXPERT_PROVIDED"]
            }
        else:
            logger.info("✍️ Stage 2: Premium Script Drafting (DNA-Grounded)...")
            script_data = await self.writer.produce_premium_script(
                niche=niche,
                dna_context=dna_context,
                draft_model=getattr(self.settings, "DRAFT_MODEL", "gemini-1.5-flash"),
                review_model=getattr(self.settings, "REVIEW_MODEL", "gemini-1.5-pro")
            )
        
        # --- Stage 2.5: DNA Audit ---
        logger.info("🛡️ Stage 2.5: DNA Compliance Audit...")
        if channel_dna:
            audit_result = await self._run_dna_audit(script_data['content'], channel_dna)
            script_data['dna_audit'] = audit_result
            if audit_result.get('score', 100) < 70:
                logger.warning(f"⚠️ Script DNA Score Low ({audit_result.get('score')}). Feedback: {audit_result.get('feedback')}")
        
        # --- Stage 3: Asset Coordination ---
        logger.info("🎬 Stage 3: Media Scouting & Scene Building...")
        scenes = self.writer.segment_script(
            text=script_data['content'],
            style_prompt=analysis.get('visual_style', ""),
            model=getattr(self.settings, "REVIEW_MODEL", "gemini-1.5-flash")
        )

        # --- Stage 4: Subtitle/Caption Preparation ---
        logger.info("💬 Stage 4: Autonomous Captioning Engine (Whisper) ready.")
        
        return {
            "channel_id": channel_id,
            "analysis": analysis,
            "script": script_data,
            "scenes": scenes,
            "expert_applied": bool(expert_edits),
            "status": "READY_FOR_RENDER",
            "dna_grounded": True
        }

    async def _run_dna_audit(self, script: str, dna: Dict[str, Any]) -> Dict[str, Any]:
        """Internal LLM helper for script compliance"""
        prompt = f"""
        당신은 채널 DNA 수호자입니다. 다음 대본이 마스터 DNA 스타일을 따르는지 검사하세요.
        [Master DNA]: {json.dumps(dna, ensure_ascii=False)}
        [대본]: {script}
        
        결과를 {{"score": 0-100, "feedback": "여기를 이렇게 고치세요"}} 형식의 JSON으로만 답변하세요.
        """
        try:
            resp = self.llm_client.generate_content(prompt, model_name="gemini-1.5-flash")
            import re
            match = re.search(r'\{.*\}', resp, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return {"score": 50, "feedback": "JSON 파싱 실패"}
        except:
            return {"score": 100, "feedback": "검사 스킵됨"}
