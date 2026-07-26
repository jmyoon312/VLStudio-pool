from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import SwarmWisdom
from ..services.intelligence.wisdom import WisdomDistiller
from ..services.intelligence.obsidian_manager import ObsidianManager
from pydantic import BaseModel
from datetime import datetime

# --- Models ---
class WisdomResponse(BaseModel):
    id: int
    niche: str
    pattern: str
    importance_score: float
    insight: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

router = APIRouter()

@router.get("", response_model=List[WisdomResponse])
async def get_all_wisdom(db: Session = Depends(get_db)):
    """Fetches all distilled wisdom patterns from the brain."""
    return db.query(SwarmWisdom).order_by(SwarmWisdom.created_at.desc()).all()

@router.get("/{niche}", response_model=List[WisdomResponse])
async def get_niche_wisdom(niche: str, db: Session = Depends(get_db)):
    """Fetches wisdom specific to a niche."""
    return db.query(SwarmWisdom).filter(SwarmWisdom.niche == niche).order_by(SwarmWisdom.importance_score.desc()).all()

@router.delete("/{wisdom_id}")
async def delete_wisdom(wisdom_id: int, db: Session = Depends(get_db)):
    """Prunes ineffective or outdated wisdom."""
    wisdom = db.query(SwarmWisdom).filter(SwarmWisdom.id == wisdom_id).first()
    if not wisdom:
        raise HTTPException(status_code=404, detail="Wisdom not found")
    db.delete(wisdom)
    db.commit()
    return {"status": "deleted"}

# [NEW] Sovereign Brain Knowledge Access
obsidian = ObsidianManager()

@router.get("/knowledge/notes")
async def get_knowledge_notes():
    """Returns a list of recent research notes from the Sovereign Brain (Obsidian)."""
    try:
        return obsidian.list_recent_notes(limit=30)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brain Access Error: {e}")

@router.get("/knowledge/notes/{filename}")
async def get_note_content(filename: str):
    """Fetches the raw content of a specific research note."""
    content = obsidian.get_note_content(filename)
    if not content:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"content": content}
