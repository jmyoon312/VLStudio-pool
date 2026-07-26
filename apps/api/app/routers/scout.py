from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from ..database import get_db, SessionLocal
from ..models import ScoutCandidate
from app.services.intelligence.hierarchical_scout import HierarchicalScout
from app.services.intelligence.strategic_center import StrategicCenter
from app.services.intelligence.strategist import SovereignStrategist
from ..config import settings
from ..llm_manager import LLMClient
from .. import crud

logger = logging.getLogger(__name__)

# --- Models ---
class ScoutMissionRequest(BaseModel):
    category_id: Optional[int] = None
    niche: Optional[str] = None
    autonomous: bool = False

class CandidateApprovalRequest(BaseModel):
    candidate_id: int
    approve: bool
    feedback: Optional[str] = None

class BatchApprovalRequest(BaseModel):
    candidate_ids: List[int]
    approve: bool

# --- Router ---
router = APIRouter(tags=["scout"])

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Retrieves the full hierarchical category tree"""
    return db.query().all()

@router.post("/mission")
async def start_scout_mission(background_tasks: BackgroundTasks, request: Optional[ScoutMissionRequest] = None, db: Session = Depends(get_db)):
    """Starts a Scouting mission (Hierarchical or Autonomous)"""
    try:
        db_settings = crud.get_settings(db)
        
        async def run_mission_wrapper(category_id: Optional[int], niche: Optional[str], autonomous: bool):
            db_bg = SessionLocal()
            try:
                bg_settings = crud.get_settings(db_bg)
                bg_llm = LLMClient(settings=bg_settings)
                
                if autonomous and niche:
                    from app.services.intelligence.autonomous_scout import AutonomousScout
                    scout = AutonomousScout(settings=bg_settings, llm_client=bg_llm)
                    await scout.scout_niche(niche)
                else:
                    scout = HierarchicalScout(settings=bg_settings, llm_client=bg_llm)
                    await scout.run_scan_mission(db_bg, target_category_id=category_id)
            finally:
                db_bg.close()

        cat_id = request.category_id if request else None
        niche = request.niche if request else None
        is_autonomous = request.autonomous if request else False
        
        background_tasks.add_task(run_mission_wrapper, cat_id, niche, is_autonomous)
            
        return {
            "status": "SUCCESS", 
            "message": f"{'Autonomous' if is_autonomous else 'Hierarchical'} scouting mission initiated.",
            "category_id": cat_id,
            "niche": niche
        }
    except Exception as e:
        logger.error(f"🔥 [Scout] Mission failure: {e}")
        return JSONResponse(status_code=500, content={"status": "ERROR", "message": str(e)})

@router.get("/candidates")
def get_candidates(category_id: Optional[int] = None, status: str = "PENDING", db: Session = Depends(get_db)):
    """Retrieves scout candidates with filtering"""
    query = db.query(ScoutCandidate).filter(ScoutCandidate.status == status)
    if category_id:
        # Include sub-categories? For now, exact match
        query = query.filter(ScoutCandidate.category_id == category_id)
    
    # Sort by score descending
    return query.order_by(ScoutCandidate.total_sovereign_score.desc()).all()

@router.post("/approve")
def approve_candidate(request: CandidateApprovalRequest, db: Session = Depends(get_db)):
    """Approves or Rejects a scout candidate"""
    candidate = db.query(ScoutCandidate).filter(ScoutCandidate.id == request.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate.status = "APPROVED" if request.approve else "REJECTED"
    db.commit()
    return {"status": "SUCCESS", "new_status": candidate.status}

@router.post("/batch-approve")
def batch_approve_candidates(request: BatchApprovalRequest, db: Session = Depends(get_db)):
    """Bulk approves or rejects candidates"""
    candidates = db.query(ScoutCandidate).filter(ScoutCandidate.id.in_(request.candidate_ids)).all()
    new_status = "APPROVED" if request.approve else "REJECTED"
    
    for c in candidates:
        c.status = new_status
    
    db.commit()
    return {"status": "SUCCESS", "count": len(candidates), "new_status": new_status}

@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """Deletes a scout candidate permanently"""
    candidate = db.query(ScoutCandidate).filter(ScoutCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    db.delete(candidate)
    db.commit()
    return {"status": "SUCCESS", "message": f"Candidate {candidate_id} deleted."}

@router.post("/batch-delete")
def batch_delete_candidates(request: List[int], db: Session = Depends(get_db)):
    """Bulk deletes candidates"""
    db.query(ScoutCandidate).filter(ScoutCandidate.id.in_(request)).delete(synchronize_session=False)
    db.commit()
    return {"status": "SUCCESS", "message": f"{len(request)} candidates deleted."}

# --- Interest Management ---
class InterestRequest(BaseModel):
    name: str

@router.get("/interests")
def get_interests(db: Session = Depends(get_db)):
    """Retrieves all master interests"""
    from ..models import SovereignInterest
    return db.query(SovereignInterest).filter(SovereignInterest.is_active == True).all()

@router.post("/interests")
def add_interest(request: InterestRequest, db: Session = Depends(get_db)):
    """Adds a new master interest"""
    from ..models import SovereignInterest
    existing = db.query(SovereignInterest).filter(SovereignInterest.name == request.name).first()
    if existing:
        return {"status": "SUCCESS", "message": "Already exists"}
    
    new_interest = SovereignInterest(name=request.name)
    db.add(new_interest)
    db.commit()
    return {"status": "SUCCESS", "id": new_interest.id}

@router.delete("/interests/{name}")
def delete_interest(name: str, db: Session = Depends(get_db)):
    """Deletes an interest"""
    from ..models import SovereignInterest
    db.query(SovereignInterest).filter(SovereignInterest.name == name).delete()
    db.commit()
    return {"status": "SUCCESS"}

# --- Strategic Intelligence (v7.0) ---

@router.get("/candidates/{candidate_id}/conquest")
async def get_conquest_manual(candidate_id: int, db: Session = Depends(get_db)):
    """Generates a strategic conquest manual for a specific competitor."""
    from ..models import ScoutCandidate
    candidate = db.query(ScoutCandidate).filter(ScoutCandidate.id == candidate_id).first()
    if not candidate:
        return {"error": "Candidate not found"}
    
    db_settings = crud.get_settings(db)
    llm = LLMClient(settings=db_settings)
    strategy = StrategicCenter(llm_client=llm)
    return await strategy.generate_conquest_manual(candidate)

@router.get("/synthesis")
async def get_niche_synthesis(db: Session = Depends(get_db)):
    """Performs predictive niche synthesis based on master interests."""
    from ..models import SovereignInterest
    interests = db.query(SovereignInterest).filter(SovereignInterest.is_active == True).all()
    
    db_settings = crud.get_settings(db)
    llm = LLMClient(settings=db_settings)
    strategy = StrategicCenter(llm_client=llm)
    return await strategy.discover_blue_oceans(interests)

@router.post("/strategic-brief")
async def create_strategic_brief(category_id: int, niche: Optional[str] = None, db: Session = Depends(get_db)):
    """Triggers autonomous generation of a deep strategic brief."""
    from .. import crud
    db_settings = crud.get_settings(db)
    llm = LLMClient(settings=db_settings)
    strategist = SovereignStrategist(db, llm_client=llm)
    return await strategist.generate_deep_brief(category_id, niche)

@router.get("/strategic-briefs")
async def get_strategic_briefs(limit: int = 10, db: Session = Depends(get_db)):
    """Retrieves latest evolving strategic reports."""
    from .. import crud
    db_settings = crud.get_settings(db)
    llm = LLMClient(settings=db_settings)
    strategist = SovereignStrategist(db, llm_client=llm)
    return await strategist.get_evolving_reports(limit)
