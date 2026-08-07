"""
ViraLoop Elite: Beats Editor API Router
비트 기반 영상 편집기 백엔드 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import json

from app.database import get_db
from app.services.redis_queue import redis_task_queue
from app.routers.script_writer import get_script_engine
from ..utils.path_utils import get_absolute_path, clean_transcript

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────

class Beat(BaseModel):
    id: str
    type: str          # "hook" | "problem" | "solution" | "cta" | "outro"
    title: str
    subtitle: Optional[str] = None
    duration_sec: float = 5.0
    text_overlay: Optional[str] = None
    font: Optional[str] = "Pretendard"
    font_size: Optional[int] = 40
    text_color: Optional[str] = "#FFFFFF"
    animation: Optional[str] = "fade"  # "fade" | "slide" | "zoom"
    volume: Optional[float] = 0.85
    background_music: Optional[str] = "default"
    engine: Optional[str] = "remotion"  # "remotion" | "hyperframes"
    asset_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: Optional[str] = "ready"  # "ready" | "rendering" | "done"
    transform: Optional[Dict[str, Any]] = None
    fx: Optional[Dict[str, Any]] = None


class BeatsUpdateRequest(BaseModel):
    beats: List[Beat]


class ScriptSegmentationRequest(BaseModel):
    video_id: int
    script: str


class RenderRequest(BaseModel):
    video_id: int
    beats: List[Beat]
    engine: Optional[str] = "remotion"


# ─────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────

@router.get("/video/{video_id}", summary="영상의 비트 목록 조회")
async def get_beats(video_id: int, db: Session = Depends(get_db)):
    """
    특정 영상 ID에 연결된 비트 목록 반환.
    비트가 없으면 기본 구조로 생성.
    """
    try:
        from app import models
        video = db.query(models.Video).filter(models.Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

        # beats 데이터가 video 메타데이터에 저장되어 있으면 반환
        metadata = {}
        if hasattr(video, 'metadata_json') and video.metadata_json:
            try:
                metadata = json.loads(video.metadata_json) if isinstance(video.metadata_json, str) else video.metadata_json
            except Exception:
                pass

        beats = metadata.get("beats")
        
        # [ELITE] If no beats exist but we have a transcript, attempt dynamic segmentation
        transcript = getattr(video, 'content', None) or getattr(video, 'description', None)
        
        # If we need to fetch transcript from file
        if not transcript and video.file_path:
            # (Fetching logic below...)
            pass

        if not beats and transcript:
            try:
                from app.routers.script_writer import get_script_engine
                engine = get_script_engine(db)
                beats = engine.segment_to_beats(transcript)
                # Store these as default beats
                metadata["beats"] = beats
                video.metadata_json = json.dumps(metadata)
                db.commit()
            except Exception as e:
                logger.warning(f"Auto-segmentation failed: {e}")
                beats = _generate_default_beats(video)
        elif not beats:
            beats = _generate_default_beats(video)
        # [FIX] Subtitle 모델은 실존하지 않으며, 자막은 파일 시스템에 저장됨.
        # 기존의 잘못된 DB 쿼리 대신 파일 기반 조회를 수행하도록 개선.
        transcript = getattr(video, 'content', None) or getattr(video, 'description', None)
        
        if not transcript and video.file_path:
            try:
                from app.utils.path_utils import get_absolute_path
                import os
                
                abs_path = get_absolute_path(video.file_path)
                base_path = os.path.splitext(abs_path)[0]
                
                # 자막 파일 우선순위: .ko.vtt > .ko.srt > .vtt > .srt > .txt
                found_path = None
                logger.info(f"[SEARCH] Checking subtitles for base: {base_path}")
                for ext in ['.ko.vtt', '.ko.srt', '.en.srt', '.vtt', '.srt', '.txt']:
                    potential = base_path + ext
                    if os.path.exists(potential):
                        logger.info(f"[OK] Found subtitle: {potential}")
                        found_path = potential
                        break
                    else:
                        # logger.debug(f"[FAIL] Not found: {potential}")
                        pass
                
                if found_path:
                    with open(found_path, 'r', encoding='utf-8') as f:
                        raw_transcript = f.read() # Read FULL content for analysis/editor
                        transcript = clean_transcript(raw_transcript)
                else:
                    logger.warning(f"[WARN] No subtitles found for {video.title}")
            except Exception as e:
                logger.error(f"Failed to read transcript file: {e}")

        return {
            "video_id": video_id, 
            "beats": beats, 
            "engine": metadata.get("engine", "remotion"),
            "video_metadata": {
                "title": getattr(video, 'title', f"Video #{video_id}"),
                "thumbnail": getattr(video, 'thumbnail_path', None),
                "duration": getattr(video, 'duration', 0),
                "upload_status": getattr(video, 'upload_status', 'N/A'),
                "is_script_only": getattr(video, 'is_script_only', False),
                "viral_score": getattr(video, 'viral_score', 0),
                "view_count": getattr(video, 'view_count', 0),
                "channel": video.channel.name if hasattr(video, 'channel') and video.channel else "Unknown",
                "transcript": transcript,
                "metadata_json": video.metadata_json if isinstance(video.metadata_json, dict) else json.loads(video.metadata_json or '{}')
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BeatsEditor] get_beats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/beat/{beat_id}", summary="특정 비트 수정")
async def update_beat(beat_id: str, beat: Beat, db: Session = Depends(get_db)):
    """단일 비트의 내용(텍스트, 애니메이션, 색상 등)을 수정."""
    try:
        # 실제 구현에서는 DB의 video.metadata_json을 업데이트
        logger.info(f"[BeatsEditor] Updating beat {beat_id}")
        return {
            "success": True,
            "beat_id": beat_id,
            "updated": beat.model_dump()
        }
    except Exception as e:
        logger.error(f"[BeatsEditor] update_beat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/segment-from-script", summary="대본 기반 동적 비트 생성")
async def segment_from_script(request: ScriptSegmentationRequest, db: Session = Depends(get_db)):
    """
    제공된 대본을 분석하여 최적화된 영상 구조(비트 목록)를 생성합니다.
    """
    try:
        from app import models
        video = db.query(models.Video).filter(models.Video.id == request.video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        engine = get_script_engine(db)
        beats = engine.segment_to_beats(request.script)

        # Update metadata
        metadata = {}
        if video.metadata_json:
            metadata = json.loads(video.metadata_json) if isinstance(video.metadata_json, str) else video.metadata_json
        
        metadata["beats"] = beats
        video.metadata_json = json.dumps(metadata)
        db.commit()

        return {"success": True, "beats": beats}
    except Exception as e:
        logger.error(f"[BeatsEditor] segment_from_script error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/render", summary="비트 기반 영상 렌더링 요청")
async def render_from_beats(request: RenderRequest, db: Session = Depends(get_db)):
    """
    수정된 비트 데이터를 기반으로 렌더링 작업을 Redis 큐에 등록.
    엔진: remotion (템플릿) 또는 hyperframes (창의적 레이아웃)
    """
    try:
        task_id = redis_task_queue.push({
            "type": "beats_render",
            "video_id": request.video_id,
            "engine": request.engine,
            "beats": [b.model_dump() for b in request.beats],
        })
        logger.info(f"[BeatsEditor] Render task queued: {task_id} | video={request.video_id} | engine={request.engine}")
        return {
            "success": True,
            "task_id": task_id,
            "video_id": request.video_id,
            "engine": request.engine,
            "message": f"Render task queued ({request.engine}). Check /api/beats/status/{task_id}"
        }
    except Exception as e:
        logger.error(f"[BeatsEditor] render_from_beats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}", summary="렌더링 태스크 상태 조회")
async def get_render_status(task_id: str):
    """Redis 큐의 렌더링 태스크 상태 조회."""
    status = redis_task_queue.get_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return status


@router.get("/queue/info", summary="렌더링 큐 현황")
async def get_queue_info():
    """현재 대기 중인 렌더링 태스크 수 반환."""
    return {
        "queue_length": redis_task_queue.get_queue_length(),
        "status": "operational"
    }


# ─────────────────────────────────────────
# Helper
# ─────────────────────────────────────────

def _generate_default_beats(video) -> list:
    """영상 객체로부터 기본 비트 구조 생성"""
    title = getattr(video, 'title', '제목 없음') or '제목 없음'
    return [
        {"id": "beat-1", "type": "hook", "title": "훅", "subtitle": "시청자의 주목을 끄는 도입부",
         "duration_sec": 5, "text_overlay": title, "animation": "zoom", "status": "ready"},
        {"id": "beat-2", "type": "problem", "title": "문제 제기", "subtitle": "핵심 메시지 전달",
         "duration_sec": 10, "text_overlay": "", "animation": "slide", "status": "ready"},
        {"id": "beat-3", "type": "solution", "title": "해결책", "subtitle": "가치 제안",
         "duration_sec": 15, "text_overlay": "", "animation": "fade", "status": "ready"},
        {"id": "beat-4", "type": "cta", "title": "행동 유도", "subtitle": "구독/좋아요/링크",
         "duration_sec": 5, "text_overlay": "구독과 좋아요!", "animation": "slide", "status": "ready"},
    ]
