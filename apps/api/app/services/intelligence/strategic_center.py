import logging
import json
import re
from typing import List, Dict, Any, Optional
from app.llm_manager import LLMClient
from app.models import ScoutCandidate, SovereignInterest

logger = logging.getLogger(__name__)

class StrategicCenter:
    """
    Sovereign Intelligence Strategic Layer (v7.0).
    Handles Shadow Boxing (Conquest) and Niche Synthesis.
    """
    
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def generate_conquest_manual(self, candidate: ScoutCandidate) -> Dict[str, Any]:
        """
        Performs a 'Shadow Boxing' analysis on a competitor candidate.
        Identifies vulnerabilities and generates a tactical conquest plan.
        """
        logger.info(f"⚔️ [StrategicCenter] Generating Conquest Manual for: {candidate.channel_name}")
        
        prompt = f"""
        ACT AS A SOVEREIGN CONTENT STRATEGIST.
        TARGET COMPETITOR: {candidate.channel_name}
        NICHE: {candidate.ai_reasoning}
        CURRENT METRICS: Sovereign Score {candidate.total_sovereign_score}
        
        TASK:
        1. IDENTIFY VULNERABILITIES: What are the common weaknesses in this type of content? (e.g., pacing, jargon, visual stagnation)
        2. AUDIENCE PAIN POINTS: What is the audience likely missing or complaining about?
        3. COUNTER-STRATEGY: Generate a 3-step tactical plan to 'conquer' this niche.
        4. TACTICAL HOOKS: 3 specific video titles/hooks that would outperform this competitor.
        
        RETURN JSON ONLY:
        {{
            "vulnerabilities": ["v1", "v2"],
            "pain_points": ["p1", "p2"],
            "conquest_plan": [
                {{"step": 1, "action": "...", "reason": "..."}},
                {{"step": 2, "action": "...", "reason": "..."}},
                {{"step": 3, "action": "...", "reason": "..."}}
            ],
            "recommended_hooks": ["hook1", "hook2", "hook3"]
        }}
        """
        
        try:
            resp = await self.llm.generate_content(prompt)
            match = re.search(r'\{.*\}', resp, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError as je:
                    logger.error(f"JSON Decode Error in Conquest Manual: {je}")
                    return {"error": "Invalid JSON format from AI", "raw": resp}
            
            logger.warning(f"No JSON found in conquest response: {resp}")
            return {"error": "Failed to parse conquest manual from AI response"}
        except Exception as e:
            logger.error(f"Failed to generate conquest manual: {e}")
            return {"error": str(e)}

    async def discover_blue_oceans(self, interests: List[SovereignInterest]) -> List[Dict[str, Any]]:
        """
        Performs 'Predictive Niche Synthesis' using Knowledge Graph logic.
        Finds intersections between master interests to discover 'Blue Oceans'.
        """
        if not interests:
            return []
            
        interest_names = [i.name for i in interests]
        logger.info(f"🌐 [StrategicCenter] Synthesizing Blue Oceans from: {interest_names}")
        
        prompt = f"""
        ACT AS A MARKET SYNTHESIS ENGINE.
        MASTER INTERESTS: {', '.join(interest_names)}
        
        TASK:
        1. FIND SEMANTIC OVERLAPS: Where do these interests intersect in a way that is currently UNDERSERVED on YouTube?
        2. SYNTHESIZE 3 NEW NICHES: Create entirely new 'Blue Ocean' categories.
        3. DEFINE AESTHETIC: What should the visual/vocal style be?
        4. POTENTIAL SCORE: Estimated viral potential (1-100).
        
        RETURN JSON ONLY:
        [
            {{
                "category_name": "...",
                "logic": "Intersection of X and Y because...",
                "aesthetic": "...",
                "potential_score": 85,
                "first_video_concept": "..."
            }}
        ]
        """
        
        try:
            resp = await self.llm.generate_content(prompt)
            match = re.search(r'\[.*\]', resp, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return []
        except Exception as e:
            logger.error(f"Failed to discover blue oceans: {e}")
            return []
