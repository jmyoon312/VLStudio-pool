import os
import json
import random
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import database, crud
from app.agent.brain_router import brain_router

router = APIRouter(tags=["Veo Prompt Agent"])
logger = logging.getLogger(__name__)

class EnhancePromptRequest(BaseModel):
    script: str
    full_context: str = ""
    brand_persona: str = ""
    model_type: str = "veo"

class EnhancePromptResponse(BaseModel):
    subject_action: str
    mood: str
    recommended_skill_id: str
    reasoning: str
    is_continuation: bool = False

# Load the 200 skills once on module load
SKILLS_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "prompt_skills.json")
try:
    with open(SKILLS_DB_PATH, "r", encoding="utf-8") as f:
        SKILLS_DB = json.load(f)
except Exception as e:
    logger.error(f"Failed to load prompt_skills.json: {e}")
    SKILLS_DB = []

@router.post("/enhance-prompt", response_model=EnhancePromptResponse)
def enhance_veo_prompt(req: EnhancePromptRequest, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    
    try:
        target_provider = settings.hermes_agent_provider or "nvidia"
        target_model = settings.hermes_agent_model or "llama-3.3-70b-versatile"
        
        if "/" in target_model:
            target_provider, clean_model = target_model.split("/", 1)
        else:
            clean_model = target_model

        if target_provider == "openrouter" and not clean_model.startswith("openrouter/"):
             clean_model = f"openrouter/{clean_model}"
        elif target_provider == "groq" and not clean_model.startswith("groq/"):
             clean_model = f"groq/{clean_model}"
        elif target_provider == "cerebras" and not clean_model.startswith("cerebras/"):
             clean_model = f"cerebras/{clean_model}"

        llm = brain_router._create_langchain_model(target_provider, clean_model, settings)
        if not llm:
             return EnhancePromptResponse(subject_action="a dramatic scene", mood="neutral", recommended_skill_id="skill_cinematic_001", reasoning="fallback")

        brand_context = f"\n브랜드/채널 페르소나 (이 가이드라인을 최우선으로 반영할 것): {req.brand_persona}" if req.brand_persona else ""

        if req.model_type == "omni":
            model_guideline = "You are an expert prompt engineer for Google Omni Flash. Omni Flash prefers descriptive, natural language flowing text rather than comma-separated cinematic keywords."
        else:
            model_guideline = "You are an expert cinematic prompt engineer and script analyst for Google Veo and Midjourney. Focus on precise cinematic keywords."

        full_context_instruction = f"\n전체 대본 맥락 (반드시 이 맥락의 시대, 장소, 정황을 유지하세요!):\n{req.full_context}\n" if req.full_context else ""

        system_instruction = (
            f"{model_guideline}\n"
            f"{brand_context}\n"
            f"{full_context_instruction}\n"
            "Your task is to analyze the provided Korean script and output a valid JSON object with the following keys ONLY:\n"
            "1. 'subject_action': Extract the 'Subject' and 'Action' and translate to descriptive English (under 20 words). DO NOT include camera/lighting. **CRITICAL: If the full_context indicates a specific historical era (e.g., Joseon Dynasty) or location, YOU MUST explicitly include those keywords in the subject_action to prevent context loss.**\n"
            "2. 'mood': The emotional mood of the scene.\n"
            "3. 'category': Choose exactly one from: Cinematic, Anime, Cyberpunk, Watercolor, 3D Render, Vintage/Retro, Fantasy.\n"
            "4. 'camera_vibe': A short keyword for camera style (e.g. Close-up, Wide shot, Low angle, Tracking shot).\n"
            "5. 'lighting_vibe': A short keyword for lighting style (e.g. Neon, Cinematic, Moody, Soft, Bright).\n"
            "6. 'reasoning': A brief 1-sentence Korean explanation of why this style fits the script and brand persona.\n"
            "7. 'is_continuation': A boolean (true/false) indicating if this scene is a direct continuation of the previous action in the exact same location and time, with no cutaways or hard transitions.\n"
            "Output strictly valid JSON."
        )

        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=req.script)
        ]
        
        try:
            response = llm.invoke(messages, response_format={"type": "json_object"})
            content = response.content.strip()
        except:
            response = llm.invoke(messages)
            content = response.content.strip()
            
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
            
        parsed = json.loads(content)
        
        category = parsed.get("category", "Cinematic")
        cam_vibe = parsed.get("camera_vibe", "").lower()
        light_vibe = parsed.get("lighting_vibe", "").lower()
        
        # Match against SKILLS_DB
        best_skill = None
        best_score = -1
        
        for skill in SKILLS_DB:
            if skill.get("category") != category:
                continue
            
            score = 0
            if cam_vibe in skill.get("camera", "").lower():
                score += 2
            if light_vibe in skill.get("lighting", "").lower():
                score += 2
            
            if score > best_score:
                best_score = score
                best_skill = skill
                
        # Fallback if no category match or DB empty
        if not best_skill and SKILLS_DB:
            best_skill = random.choice(SKILLS_DB)
            
        recommended_skill_id = best_skill["id"] if best_skill else "skill_cinematic_001"
        
        return EnhancePromptResponse(
            subject_action=parsed.get("subject_action", "a scene unfolding"),
            mood=parsed.get("mood", "neutral"),
            recommended_skill_id=recommended_skill_id,
            reasoning=parsed.get("reasoning", "스타일 매칭 완료"),
            is_continuation=bool(parsed.get("is_continuation", False))
        )

    except Exception as e:
        logger.error(f"Veo Prompt Agent Error: {e}")
        return EnhancePromptResponse(
            subject_action="a scene unfolding", 
            mood="neutral", 
            recommended_skill_id="skill_cinematic_001", 
            reasoning="분석 실패로 인한 기본 매칭",
            is_continuation=False
        )
