from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from app.services.adb_service import adb_service
from app.services.network_monitor import network_monitor
from app.database import get_db
from app.models import Profile, ProfileStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["network"])

@router.get("/status")
def get_network_status(db: Session = Depends(get_db), force: bool = Query(False)):
    """
    [SAIF-P1] 실시간 네트워크 격리 및 LTE 상태 조회
    프론트엔드 NetworkStatus 인터페이스 포맷으로 응답
    """
    try:
        # 원본 adb_service.get_network_status_detail() 사용 (복원된 전체 구현)
        base = adb_service.get_network_status_detail(force=force)

        # 프로필 분류 추가
        profiles = db.query(Profile).filter(Profile.status != ProfileStatus.QUARANTINED).all()
        lte_profiles, isp_profiles, direct_profiles = [], [], []
        for p in profiles:
            p_data = {"id": p.id, "email": p.email, "proxy_mode": p.proxy_mode,
                      "proxy_host": p.proxy_host, "proxy_port": p.proxy_port}
            if p.proxy_mode == "DIRECT_LTE":
                lte_profiles.append(p_data)
            elif p.proxy_mode == "ISP_PROXY":
                isp_profiles.append(p_data)
            else:
                direct_profiles.append(p_data)

        base["profiles"] = {"lte": lte_profiles, "isp": isp_profiles, "direct": direct_profiles}

        # isolation_ok 계산 (프론트엔드 호환)
        mon = base.get("monitor", {})
        lte_status = mon.get("lte", {}).get("status", "Disconnected")
        wifi_status = mon.get("wifi", {}).get("status", "Disconnected")
        base["isolation_ok"] = (lte_status == "Connected" and wifi_status in ["Connected", "Isolated"])

        return base
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

@router.get("/adapters/debug")
def get_adapter_debug():
    """
    [Debug] 현재 감지된 모든 어댑터 상태를 반환 (LTE 인식 문제 진단용)
    """
    try:
        from app.services.network_monitor import network_monitor as nm
        adb_devices = adb_service.list_devices()
        return {
            "network_monitor_status": nm.get_status(),
            "adb_connected": len(adb_devices) > 0,
            "adb_devices": adb_devices,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

