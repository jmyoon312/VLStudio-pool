from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from .. import database, crud
from ..script_engine import ScriptEngine
from ..llm_manager import LLMClient
from pydantic import BaseModel
from typing import Optional, List
import re

# Import get_script_engine from script_writer where it is defined
from .script_writer import get_script_engine

# --- Models ---
class MultilingualScriptRequest(BaseModel):
    input_text: str
    niche: str
    target_languages: Optional[List[str]] = ["ko", "en", "ja", "zh"]

class RedTeamScanRequest(BaseModel):
    text: str

router = APIRouter(tags=["approval"])

@router.post("/generate-multilingual")
def generate_multilingual(
    request: MultilingualScriptRequest,
    engine: ScriptEngine = Depends(get_script_engine)
):
    """
    [Phase 3] Generates 4-language scripts concurrently for the HITL Approval Board.
    """
    try:
        result = engine.generate_multilingual_script(input_text=request.input_text, niche=request.niche)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/redteam-scan")
def redteam_scan(request: RedTeamScanRequest):
    """
    [Phase 3] AI Red-Team Scan: Detects platform-censored words (kill, bomb, suicide, etc.) 
    and offers safe alternatives (unalive, unalive device, game over). 
    """
    text = request.text
    # Simple regex-based dictionary substitution for MVP
    censorship_dict = {
        r'\bkill\b': 'unalive',
        r'\bkilled\b': 'unalived',
        r'\bkiller\b': 'un-aliver',
        r'\bbomb\b': 'explosive device',
        r'\bsuicide\b': 'game over',
        r'\b폭탄\b': '폭발물',
    }
    
    flagged_words = []
    suggested_text = text
    
    for pattern, replacement in censorship_dict.items():
        if re.search(pattern, text, flags=re.IGNORECASE):
            flagged_words.append(pattern.replace(r'\b', ''))
            suggested_text = re.sub(pattern, replacement, suggested_text, flags=re.IGNORECASE)
            
    # Add simple exact matches for Korean since word boundaries act differently
    ko_dict = {
        '죽이': '없애',
        '죽었': '사라졌',
        '자살': '극단적 선택',
        '폭발물': '위험물'
    }
    for word, replacement in ko_dict.items():
        if word in suggested_text:
            flagged_words.append(word)
            suggested_text = suggested_text.replace(word, replacement)

    is_safe = len(flagged_words) == 0
    return {
        "is_safe": is_safe,
        "flagged_words": list(set(flagged_words)),
        "suggested_text": suggested_text,
        "original_text": text
    }
