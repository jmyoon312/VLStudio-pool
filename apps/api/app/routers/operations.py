from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import os
import shutil
import logging

from app.database import get_db
from app import models, crud
from app.config import settings
from app.utils.file_manager import delete_video_files

logger = logging.getLogger(__name__)
router = APIRouter(tags=["operations"])

@router.post("/{video_id}/reset", summary="작전 데이터 초기화")
async def reset_operation(video_id: int, db: Session = Depends(get_db)):
    """
    작전 진행 중 생성된 모든 임시 파일 및 결과물 폴더를 삭제하고,
    DB의 비트(beats) 데이터를 초기화합니다.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Operation not found")

    # 1. Delete Operations Folder
    # Folder name is usually based on video_id or a safe title
    op_folder_name = str(video_id)
    op_path = os.path.join(settings.OPERATIONS_DIR, op_folder_name)
    
    if os.path.exists(op_path):
        try:
            shutil.rmtree(op_path)
            logger.info(f"Reset: Deleted folder {op_path}")
        except Exception as e:
            logger.error(f"Failed to delete folder {op_path}: {e}")
            # Continue anyway to reset DB

    # 2. Reset DB Metadata (Clear beats, reset status)
    metadata = {}
    if video.metadata_json:
        metadata = video.metadata_json if isinstance(video.metadata_json, dict) else {}
    
    # Clear project specific data
    metadata.pop("beats", None)
    metadata.pop("current_phase", None)
    metadata["status"] = "ready"
    
    video.metadata_json = metadata
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(video, "metadata_json")
    
    db.commit()
    
    return {"status": "success", "message": "작전이 성공적으로 초기화되었습니다."}

@router.post("/{video_id}/delete", summary="작전 완전 폐기")
async def delete_operation(video_id: int, db: Session = Depends(get_db)):
    """
    작전 데이터뿐만 아니라 원본 소스 파일, 썸네일, DB 레코드까지 모두 삭제합니다.
    """
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Operation not found")

    # 1. Delete Operations Folder
    op_folder_name = str(video_id)
    op_path = os.path.join(settings.OPERATIONS_DIR, op_folder_name)
    if os.path.exists(op_path):
        try:
            shutil.rmtree(op_path)
            logger.info(f"Delete: Deleted folder {op_path}")
        except Exception as e:
            logger.error(f"Failed to delete folder {op_path}: {e}")

    # 2. Delete Source Files (using existing utility)
    try:
        delete_video_files(video.file_path, video.thumbnail_path)
    except Exception as e:
        logger.error(f"Failed to delete source files for video {video_id}: {e}")

    # 3. Delete from DB
    db.delete(video)
    db.commit()

    return {"status": "success", "message": "작전 및 모든 관련 파일이 영구 삭제되었습니다."}
