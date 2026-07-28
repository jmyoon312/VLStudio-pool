from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile, ProfileStatus
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/ping")
async def ping():
    return {"status": "ok"}

@router.get("/profiles")
async def list_profiles(
    type: str = Query(None),
    status: str = Query(None),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(Profile)
        if type:
            query = query.filter(Profile.profile_type == type)
        if status:
            query = query.filter(Profile.status == status)
        profiles = query.all()

        results = []
        for p in profiles:
            results.append({
                "id": p.id,
                "email": p.email or "no-email@viraloop.ai",
                "profile_type": p.profile_type,
                "status": p.status,
                "engine_type": p.engine_type,
                "folder_path": p.folder_path,
                "tags": p.tags or [],
                "daily_gen_count": p.daily_gen_count or 0,
                "last_gen_at": str(p.last_gen_at) if p.last_gen_at else None,
                "proxy_mode": p.proxy_mode,
            })
        return results
    except Exception as e:
        logger.error(f"Failed to list profiles: {e}")
        return []

@router.get("/network/status")
def get_network_status(db: Session = Depends(get_db)):
    try:
        profiles = db.query(Profile).filter(Profile.status != ProfileStatus.QUARANTINED).all()

        lte_profiles = []
        isp_profiles = []
        direct_profiles = []

        for p in profiles:
            p_data = {
                "id": p.id,
                "email": p.email,
                "proxy_mode": p.proxy_mode,
                "proxy_host": p.proxy_host,
                "proxy_port": p.proxy_port
            }
            if p.proxy_mode == "DIRECT_LTE":
                lte_profiles.append(p_data)
            elif p.proxy_mode == "ISP_PROXY":
                isp_profiles.append(p_data)
            else:
                direct_profiles.append(p_data)

        return {
            "profiles": {
                "lte": lte_profiles,
                "isp": isp_profiles,
                "direct": direct_profiles
            }
        }
    except Exception as e:
        logger.error(f"Failed to get network status: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})