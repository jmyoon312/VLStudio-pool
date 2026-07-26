from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Settings
from app.services.search_manager import search_manager
import os

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    engine: str = "auto"
    media_only: bool = False
    type: str = "auto"

@router.post("/search")
async def bridge_search(request: SearchRequest, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()

    tavily_key = None
    if settings and settings.tavily_api_keys and len(settings.tavily_api_keys) > 0:
        tavily_key = settings.tavily_api_keys[0]
    if not tavily_key:
        tavily_key = os.getenv("TAVILY_API_KEY")

    searxng_url = settings.searxng_url if settings and settings.searxng_url else "https://searx.work/search"

    config = {"tavily_key": tavily_key, "searxng_url": searxng_url}

    if request.media_only:
        from app.routers.assets import search_stock_assets
        media_type = "video" if request.type in ["video", "auto"] else "image"
        try:
            results = search_stock_assets(request.query, media_type)
            return {"results": results, "source": "StockLibrary"}
        except:
            pass

    result = search_manager.search(request.query, request.engine, config=config)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result
