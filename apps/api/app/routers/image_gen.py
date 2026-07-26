from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.database import get_db
from app import models
from app.services.image_gen_service import ImageGenService

router = APIRouter(tags=["image-gen"])
logger = logging.getLogger(__name__)

# --- Schemas ---
class GenerateRequest(BaseModel):
    prompt: str
    mode: str = "auto" # fast, quality, remix, auto
    style_preset: Optional[str] = None
    width: int = 1024
    height: int = 1024

class GenerateResponse(BaseModel):
    success: bool
    image_url: str # Can be local path or URL
    provider: str
    message: Optional[str] = None

# --- Dependency ---
def get_service(db: Session = Depends(get_db)):
    settings = db.query(models.Settings).first()
    if not settings:
        raise HTTPException(500, "System settings not found")
    return ImageGenService(settings)

# --- Endpoints ---
@router.post("/generate", response_model=GenerateResponse)
async def generate_image(
    req: GenerateRequest,
    service: ImageGenService = Depends(get_service)
):
    """
    Generates an image using the Hybrid Orchestrator.
    """
    try:
        logger.info(f"🎨 API Request: Generate '{req.prompt}' [{req.mode}]")
        
        # Call Service
        # Note: This is synchronous for now. For Browser Farm, might need async/background tasks later.
        # But for V1, we wait (timeout might be an issue for browser, but let's try)
        result_path = service.generate_image(req.prompt, req.mode, req.style_preset)
        
        provider = "api" 
        if req.mode in ["quality", "remix"]:
            provider = "browser"
            
        # If result is local path, we might need to serve it? 
        # The frontend expects a URL.
        # We need a way to serve "F:\media\temp" or "/temp" via static files.
        # Assuming `main.py` mounts `/static` or similar.
        # For now, return the raw path (frontend might need adjustment or we convert to static URL)
        
        # Convert absolute path to relative static URL if possible
        # Assumes 'media' or 'temp' is mounted. 
        # Hack: If path contains "media", return "/media/..."
        
        image_url = result_path
        if "media" in result_path:
             # Normalize path
             rel_path = result_path.replace("\\", "/").split("media/")[-1]
             image_url = f"/media/{rel_path}"
             
        return GenerateResponse(
            success=True,
            image_url=image_url,
            provider=provider
        )

    except Exception as e:
        logger.error(f"❌ API Gen Error: {e}")
        raise HTTPException(500, f"Generation Failed: {str(e)}")
