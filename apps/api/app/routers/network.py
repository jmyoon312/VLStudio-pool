from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.services.adb_service import adb_service
from app.database import get_db
from app.models import Profile, ProfileStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["network"])

@router.get("/status")
def get_network_status(db: Session = Depends(get_db)):
    """
    [SAIF-P1] 실시간 네트워크 격리 및 LTE 상태 조회
    """
    try:
        # Get base network status
        base_status = adb_service.get_network_status_detail()
        
        # Get profiles and group them
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
                
        base_status["profiles"] = {
            "lte": lte_profiles,
            "isp": isp_profiles,
            "direct": direct_profiles
        }
        
        return base_status
    except Exception as e:
        logger.error(f"Failed to get network status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rotate-ip")
def rotate_network_ip(serial: str = None, method: str = "soft"):
    """
    [SAIF-P1] 강제 IP 로테이션 트리거 (비행기 모드 토글 또는 모바일 데이터 토글)
    """
    try:
        success = adb_service.rotate_ip(serial=serial, method=method)
        if success:
            return {"status": "success", "message": f"IP rotation ({method}) sequence triggered"}
        else:
            raise HTTPException(status_code=500, detail="IP rotation failed on device")
    except Exception as e:
        logger.error(f"IP rotation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
