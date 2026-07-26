from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from .. import database, models, schemas
from datetime import datetime

router = APIRouter(tags=["callback"])

@router.post("/n8n-finished", status_code=201)
def receive_n8n_video(
    payload: dict = Body(...),
    db: Session = Depends(database.get_db)
):
    """
    Receives notification from n8n that a video has been generated.
    Payload expected: { "source_id": "...", "video_path": "...", "metadata": {...} }
    """
    print(f"Received n8n callback: {payload}")

    # 1. Validate Payload
    if "video_path" not in payload:
        raise HTTPException(status_code=400, detail="Missing video_path in payload")

    # 2. Logic: Create Video Record (or update existing)
    # Find channel from metadata or default
    # For now, we just create a record to show up in "Work Queue"
    
    # Check if video_id exists (deduplication)
    video_id = payload.get("video_id", f"n8n-{int(datetime.now().timestamp())}")
    
    new_video = models.Video(
        video_id=video_id,
        title=payload.get("title", "Generated Video"),
        file_path=payload["video_path"],
        status="completed",
        upload_date=datetime.now(),
        upload_status="PENDING", # Triggers Worker to pick it up
        metadata_json=payload.get("metadata", {}),
        priority_level=payload.get("priority", 1) # Auto-generated = High Priority usually
    )
    
    db.add(new_video)
    db.commit()
    db.refresh(new_video)
    
    # 3. Trigger WebSocket (Optional/Future: Notify Dashboard)
    
    return {"status": "success", "video_id": new_video.id}
