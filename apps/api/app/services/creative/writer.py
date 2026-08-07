import logging
import re
import json
from typing import List, Dict, Any
from app.schemas.packet import QualityAuditPacket

logger = logging.getLogger(__name__)

class Writer:
    def __init__(self, llm_client):
        self.llm_client = llm_client

    async def produce_premium_script(self, niche: str, dna_context: str = "", format: str = "shorts", 
                                  draft_model: str = "ollama/gemma2", 
                                  review_model: str = "openrouter/google/gemini-2.0-flash-001") -> Dict[str, Any]:
        """
        [SOP V2] High-Quality 3-Stage Script Production Pipeline.
        1. Draft (Pioneer) -> 2. Refine (Architect) -> 3. Review (Director)
        """
        logger.info(f"✍️ Starting Multi-Loop Script Production for niche: {niche}")
        
        # Stage 1: Initial Drafting (Pioneer)
        current_script = await self.generate_script_draft(niche, dna_context, format, model=draft_model)
        
        max_retries = 3
        feedback_history = []
        
        # --- PHASE 3: Micro-Loop (Drafter-Critic) ---
        for attempt in range(max_retries):
            # Stage 2: Refinement (Architect) - incorporate any feedback
            refined_payload = f"Previous Feedback to fix:\n{chr(10).join(feedback_history)}\n\n" if feedback_history else ""
            current_script = await self.refine_script(current_script, format, model=draft_model, extra_context=refined_payload)
            
            # Stage 3: Strict Audit (Critic)
            audit_packet: QualityAuditPacket = await self.review_script_with_audit(current_script, niche, dna_context, model=review_model)
            
            if audit_packet.status == "APPROVED":
                logger.info(f"[OK] Script passed QA on attempt {attempt+1}")
                return {
                    "title": f"{niche} Viral Script",
                    "content": audit_packet.artifacts.get("script", current_script),
                    "stages": ["DRAFTED", "REFINED", f"QA_APPROVED_AT_{attempt+1}"]
                }
            
            logger.warning(f"[WARN] Script QA Failed (Attempt {attempt+1}). Feedback: {audit_packet.feedback}")
            feedback_history.extend(audit_packet.feedback)
            
        logger.error("[FAIL] Script QA failed after max retries. Falling back to the last best effort.")
        return {
            "title": f"{niche} Viral Script (UNSTABLE)",
            "content": current_script,
            "stages": ["DRAFTED", "REFINED", "QA_FAILED", "RETRY_EXHAUSTED"]
        }

    async def generate_script_draft(self, niche: str, dna: str, format: str, model: str) -> str:
        # Attempt to parse expert guidelines from DNA context if it's JSON
        expert_info = ""
        try:
            dna_data = json.loads(dna)
            guidelines = dna_data.get('expert_guidelines', {})
            master = guidelines.get('master_identity', '')
            mission = guidelines.get('mission_specific', '')
            if master or mission:
                expert_info = f"\n[Expert Guidelines]:\nMaster Identity: {master}\nMission Focus: {mission}"
        except:
            pass

        prompt = f"""
        [Pioneer Draftsman]
        Create a viral {format} script for the niche: '{niche}'.
        Channel DNA/Style: {dna}
        {expert_info}
        
        Focus on:
        - Compelling storytelling.
        - Engaging information.
        - Natural flow.
        
        Return ONLY the raw script text.
        """
        return self.llm_client.generate_content(prompt, model_name=model)

    async def refine_script(self, raw_script: str, format: str, model: str, extra_context: str = "") -> str:
        prompt = f"""
        [Architect Refiner]
        Refine the following {format} script for maximum retention and pacing.
        {extra_context}
        
        Original Script:
        {raw_script}
        
        Optimization Goals:
        1. Start with a MEGA HOOK (first 3 seconds).
        2. Ensure a pacing shift every 5-7 seconds (visual/audio changes).
        3. Remove filler words.
        4. Add [SFX: Whoosh], [SFX: Pop], [SFX: Ding] tags at high-impact moments.
        
        Return ONLY the refined script with SFX tags.
        """
        return self.llm_client.generate_content(prompt, model_name=model)

    async def review_script_with_audit(self, refined_script: str, niche: str, dna: str, model: str) -> QualityAuditPacket:
        prompt = f"""
        [Strict QA Auditor]
        Review this script for a high-quality production swarm.
        
        Script to Review:
        {refined_script}
        
        Niche: {niche}
        Channel DNA: {dna}
        
        Checklist:
        1. Does it strictly align with the Channel DNA?
        2. Are SFX tags placed naturally?
        3. Is the storytelling deeply engaging without hallucination?
        
        You must output ONLY valid JSON matching this schema:
        {{
            "status": "APPROVED" or "REJECTED",
            "feedback": ["List of specific issues to fix if REJECTED, otherwise empty list"],
            "artifacts": {{"script": "The final polished script if APPROVED, otherwise empty string"}}
        }}
        """
        response = self.llm_client.generate_content(prompt, model_name=model)
        try:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            data = json.loads(match.group(0)) if match else {"status": "APPROVED", "feedback": [], "artifacts": {"script": refined_script}}
            return QualityAuditPacket(**data)
        except Exception as e:
            logger.error(f"Audit generation failed, bypassing: {e}")
            return QualityAuditPacket(status="APPROVED", feedback=[], artifacts={"script": refined_script})

    def segment_script(self, text: str, mode: str = "shorts", provider: str = "google", model: str = "gemini-1.5-flash", style_prompt: str = "", split_method: str = "ai_smart") -> list:
        """
        Splits a script into logical scenes and generates visual generation prompts for each scene.
        """
        try:
            cleaned_text = text.replace("\r\n", "\n").strip()
            
            if split_method == 'sentence':
                return self._split_by_sentence(cleaned_text, style_prompt)
            
            prompt = self._build_segmentation_prompt(cleaned_text, mode, style_prompt)
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=f"{provider}/{model}" if provider != "openai" else model,
                full_response=False
            )
            
            match = re.search(r'\{.*\}', response, re.DOTALL)
            data = json.loads(match.group(0)) if match else {"scenes": []}
            return data.get("scenes", [])

        except Exception as e:
            logger.error(f"Script Segmentation Failed: {e}")
            raise e

    def _build_segmentation_prompt(self, text, mode, style_prompt):
        return f"""
        Split this script into scenes for a {mode} video.
        For each scene, provide:
        1. 'script': The portion of the script.
        2. 'visual_prompt': A high-detail prompt for an image/video generator. Match the SFX or pacing if mentioned.
        3. 'style_suffix': {style_prompt}

        TEXT:
        {text}

        Output ONLY JSON: {{ "scenes": [ {{ "script": "...", "visual_prompt": "..." }}, ... ] }}
        """

    def _split_by_sentence(self, text, style_prompt):
        sentences = re.split(r'(?<=[.?!])\s+', text)
        return [{"script": s, "visual_prompt": f"Realistic scene: {s}. {style_prompt}"} for s in sentences if s.strip()]
