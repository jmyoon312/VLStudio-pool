from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import database, crud
from ..llm_manager import LLMClient
from .. import bulk_engine, job_queue
import logging
import json

router = APIRouter(tags=["insights"])
logger = logging.getLogger(__name__)

class ViralityRequest(BaseModel):
    content: str # Script or Video Summary
    type: str = "script" # script | video

class SeoRequest(BaseModel):
    content: str
    keywords: str = ""

class ABTestRequest(BaseModel):
    project_id: str
    hooks: list[str] # List of hook texts or file paths

@router.post("/analyze-virality")
def analyze_virality(req: ViralityRequest, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    client = LLMClient(settings)
    
    prompt = f"""
    You are a YouTube Algorithm Expert. Analyze the following {req.type} content.
    Score it (0-100) on: Hook, Retention, Shareability.
    Provide 3 actionable tips to improve retention.
    
    Content:
    {req.content[:5000]}
    
    Return JSON ONLY:
    {{
        "score": 85,
        "metrics": {{ "hook": 90, "retention": 80, "shareability": 85 }},
        "advice": ["Make intro faster", "Add visual change at 5s", ...]
    }}
    """
    
    try:
        response = client.generate_content(prompt, model_name="gemini-2.0-flash-exp")
        # Clean JSON
        clean_json = response.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except Exception as e:
        logger.error(f"Virality Analysis Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-seo")
def generate_seo(req: SeoRequest, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    client = LLMClient(settings)
    
    prompt = f"""
    Generate 3 sets of YouTube SEO metadata for the following content.
    Keywords: {req.keywords}
    
    Content:
    {req.content[:3000]}
    
    Output Format (JSON):
    [
        {{
            "strategy": "Click-through (High CTR)",
            "title": "...",
            "description": "...",
            "tags": ["..."]
        }},
        {{
            "strategy": "Search Optimized (SEO)",
            "title": "...",
            "description": "...",
            "tags": ["..."]
        }},
        {{
            "strategy": "Shorts Feed (Viral)",
            "title": "...",
            "description": "...",
            "tags": ["..."]
        }}
    ]
    """
    
    try:
        response = client.generate_content(prompt, model_name="gemini-2.0-flash-exp")
        clean_json = response.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except Exception as e:
        logger.error(f"SEO Gen Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ab-test")
def generate_ab_test(req: ABTestRequest, db: Session = Depends(database.get_db)):
    """
    Generates variants of a project with different hooks and adds them to the render queue.
    """
    try:
        # Load Project
        # Assuming project_id is a filename in saved_projects or similar
        # For this prototype, we'll assume project_id is the full path to the project JSON or ID in DB?
        # The prompt says "Load Project JSON".
        # Let's assume we pass the project JSON content or ID.
        # If ID, we need to fetch it.
        # Let's assume the frontend sends the ID and we load it from `projects/` dir.
        
        # We'll use bulk_engine to generate variants
        # But bulk_engine needs to be updated first.
        # We'll call it here assuming it will be implemented.
        
        jobs = bulk_engine.generate_variants(req.project_id, req.hooks)
        
        # Add to Queue
        for job in jobs:
            job_queue.add_job(job)
            
        return {"status": "success", "variants_created": len(jobs)}
        
    except Exception as e:
        logger.error(f"A/B Test Gen Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Internal Helper for Auto-Fixer ---
from datetime import datetime, timedelta
from .. import models

def perform_viral_analysis(db: Session, timeframe_hours: int = 24) -> int:
    """
    Recalculates viral_score and velocity_score for videos from the last N hours.
    Used by Auto-Fixer to ensure metrics remain fresh.
    """
    logger.info(f"[REFRESH] Recalculating Viral Indices (Timeframe: {timeframe_hours}h)...")
    
    cutoff = datetime.now() - timedelta(hours=timeframe_hours)
    
    # Select recent videos
    videos = db.query(models.Video).filter(
        models.Video.upload_date >= cutoff
    ).all()
    
    count = 0
    for video in videos:
        try:
            # 1. Update Velocity
            # Default to Lifetime Velocity
            upload_dt = video.upload_date or datetime.now()
            # [FIX] Clamp min hours to 1.0 to prevent Velocity > Total Views confusion
            lifetime_hours = max(1.0, (datetime.now() - upload_dt).total_seconds() / 3600)
            velocity = float(video.view_count) / lifetime_hours
            
            # Try Instant Velocity if history exists
            last_history = db.query(models.VideoHistory)\
                .filter(models.VideoHistory.video_id == video.id)\
                .order_by(models.VideoHistory.timestamp.desc())\
                .first()
                
            if last_history:
                time_diff = (datetime.now() - last_history.timestamp).total_seconds() / 3600
                if time_diff > 0:
                    view_diff = video.view_count - last_history.view_count
                    instant_velocity = view_diff / time_diff
                    if instant_velocity > 0:
                        velocity = instant_velocity

            video.velocity_score = round(velocity, 1)

            # 2. Update Viral Score
            if video.channel and video.channel.subscriber_count and video.channel.subscriber_count > 0:
                video.viral_score = round((video.view_count / video.channel.subscriber_count) * 100, 1)
            else:
                video.viral_score = 0.0
                
            # Update Metadata JSON
            if video.metadata_json:
                meta = dict(video.metadata_json)
                meta['velocity_score'] = video.velocity_score
                meta['viral_score'] = video.viral_score
                video.metadata_json = meta
                
            count += 1
            
        except Exception as e:
            logger.warning(f"Failed to recalc for video {video.id}: {e}")
            continue

    if count > 0:
        db.commit()
    
    return count
