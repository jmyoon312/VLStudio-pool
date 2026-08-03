from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, Body
import json
import os
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile, ProfileStatus
from fastapi.responses import JSONResponse
from app.services.adb_service import adb_service
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
def get_network_status(db: Session = Depends(get_db), force: bool = Query(False)):
    """
    [Fix] 프론트엔드 Home.tsx 가 호출하는 실제 엔드포인트.
    monitor / system_public_ip / mobile_public_ip / isolation_ok 등 전체 상태 반환.
    """
    try:
        # adb_service.get_network_status_detail() — 캐시 기반으로 빠르게 반환
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

        # isolation_ok 계산
        mon = base.get("monitor", {})
        lte_status = mon.get("lte", {}).get("status", "Disconnected")
        wifi_status = mon.get("wifi", {}).get("status", "Disconnected")
        base["isolation_ok"] = (lte_status == "Connected" and wifi_status in ["Connected", "Isolated"])

        return base
    except Exception as e:
        logger.error(f"Failed to get network status: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/network/rotate")
async def rotate_network_ip(payload: dict = Body(default={})):
    """
    [Fix] Home.tsx / Incubator.tsx 에서 호출하는 /api/resources/network/rotate 엔드포인트.
    실제 로직은 adb_service.rotate_ip()에 위임. method 기본값: 'soft'
    """
    try:
        method = payload.get("method", "soft")
        success = adb_service.rotate_ip(method=method)
        if success:
            return {"status": "success", "message": f"IP rotation ({method}) sequence triggered"}
        else:
            raise HTTPException(status_code=500, detail="IP rotation failed on device")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"IP rotation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/profiles/{id}/upload-key")
async def upload_profile_key(id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """ Upload & Validate client_secret.json """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if profile.status == ProfileStatus.QUARANTINED:
        raise HTTPException(403, "Profile is quarantined and cannot be modified.")
    
    try:
        content = await file.read()
        json_content = json.loads(content.decode('utf-8'))
        client_config = json_content.get('installed') or json_content.get('web')
        
        if not client_config:
            raise HTTPException(400, "Invalid Key File: Missing 'installed' or 'web' root key.")
        if 'client_id' not in client_config or 'client_secret' not in client_config:
            raise HTTPException(400, "Invalid Key File: Missing client_id or client_secret.")

        # Save to file system for compatibility
        folder_path = profile.folder_path
        if folder_path:
            if not os.path.exists(folder_path):
                os.makedirs(folder_path, exist_ok=True)
            file_path = os.path.join(folder_path, "client_secret.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(json_content, f, indent=4)
        else:
            file_path = None
        
        # Save to database for OAuth2 authentication
        profile.client_secret_json = json.dumps(json_content)
        
        db.commit()
        
        logger.info(f"✅ OAuth2 credentials saved for profile {id}")
        return {
            "status": "success", 
            "path": file_path, 
            "msg": "Profile updated with OAuth2 credentials",
            "has_oauth2": True
        }
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process key upload: {e}")
        raise HTTPException(500, str(e))

@router.post("/network/fix-permissions")
def fix_network_permissions():
    """ 
    메인 네트워크(Wi-Fi/이더넷) 우선순위 영구 고정 (Metric 1) 
    UAC 권한 요청을 통해 Powershell로 메트릭 조정
    """
    try:
        import subprocess
        import base64
        # 1. USB 테더링(NDIS) 장치를 찾아 메트릭을 9000으로 최하위 강등
        # 2. Wi-Fi 장치를 찾아 메트릭을 1로 최상위 승격
        ps_script = 'Get-NetAdapter | Where-Object InterfaceDescription -match "NDIS|RNDIS" | Set-NetIPInterface -InterfaceMetric 9000; Get-NetIPInterface | Where-Object InterfaceAlias -match "Wi-Fi" | Set-NetIPInterface -InterfaceMetric 1'
        
        # 특수문자 충돌(파이프, 따옴표) 방지를 위해 Base64 인코딩 후 전달
        encoded_script = base64.b64encode(ps_script.encode('utf-16-le')).decode('utf-8')
        cmd = f'powershell -Command "Start-Process powershell -ArgumentList \'-NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded_script}\' -Verb RunAs -WindowStyle Hidden"'
        
        subprocess.run(cmd, shell=True)
        return {"status": "success", "message": "메인 네트워크 절대 우선권 부여 완료 (UAC 승인 시 즉시 적용)"}
    except Exception as e:
        logger.error(f"Failed to fix network permissions: {e}")
        raise HTTPException(500, str(e))