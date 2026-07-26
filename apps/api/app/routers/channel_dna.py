from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from .. import models, database
from ..schemas.dna import ChannelDNA

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/channels", tags=["Channel DNA"])

@router.get("/{channel_id}/dna", response_model=ChannelDNA)
def get_channel_dna(channel_id: int, db: Session = Depends(database.get_db)):
    """
    특정 채널의 초정밀 DNA 정보를 반환합니다.
    Channel Director가 기획/대본/편집 에이전트들에게 주입할 때 사용합니다.
    """
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # DB에 저장된 JSON을 Pydantic 모델로 변환
    if not channel.style_signature:
        # DNA가 아예 없는 경우 404를 반환하거나 기본 빈 모델을 반환할 수 있습니다.
        # 여기서는 초기 상태를 나타내는 기본 DNA 템플릿을 생성하여 반환합니다.
        raise HTTPException(status_code=404, detail="Channel DNA not initialized yet. Please have Portfolio Strategist generate the initial DNA.")

    try:
        dna = ChannelDNA(**channel.style_signature)
        return dna
    except Exception as e:
        logger.error(f"Failed to parse DNA for channel {channel_id}: {e}")
        raise HTTPException(status_code=500, detail="DNA format is invalid or corrupted.")

@router.put("/{channel_id}/dna", response_model=ChannelDNA)
def update_channel_dna(channel_id: int, new_dna: ChannelDNA, db: Session = Depends(database.get_db)):
    """
    Phase 10 (분석/성찰) 종료 후 Channel Director가 발견한 성공/실패 패턴을 반영하여 DNA를 업데이트합니다.
    버전(version)은 백엔드에서 자동으로 +1 증가시킵니다.
    """
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # 기존 DNA가 있으면 버전을 올리고, 없으면 버전을 1로 시작
    current_version = 0
    if channel.style_signature and "version" in channel.style_signature:
        current_version = channel.style_signature.get("version", 0)

    # 새 DNA 객체 덤프 및 버전 증가
    dna_dict = new_dna.dict()
    dna_dict["version"] = current_version + 1

    channel.style_signature = dna_dict
    db.commit()
    db.refresh(channel)

    return ChannelDNA(**channel.style_signature)

@router.post("/{channel_id}/dna/verify")
def verify_script_dna(channel_id: int, request: dict, db: Session = Depends(database.get_db)):
    """
    제작된 대본이 채널 DNA를 준수하는지 검증합니다.
    """
    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
    if not channel or not channel.style_signature:
        return {"status": "warning", "score": 0.5, "feedback": "DNA context missing"}
    
    script = request.get("script_content", "")
    dna = channel.style_signature
    
    # Simple logic for unit testing:
    # 1. Check if "말맛" keywords are present
    keywords = dna.get("script_flavor", {}).get("preferred_lexicon", [])
    matches = [k for k in keywords if k in script]
    
    score = 0.5 + (len(matches) / (len(keywords) + 1)) * 0.5
    
    return {
        "status": "success" if score > 0.7 else "refining_needed",
        "score": round(score, 2),
        "matches": matches,
        "feedback": f"DNA keywords found: {len(matches)}/{len(keywords)}. Flavor profile match good." if score > 0.7 else "Needs more brand flavor (말맛)."
    }
