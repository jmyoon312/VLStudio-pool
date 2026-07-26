"""
Queue Management API Router

Endpoints:
- GET /api/queue - Get all queue items
- POST /api/queue - Add to queue
- PUT /api/queue/{item_id}/status - Update status
- PUT /api/queue/{item_id}/reschedule - Reschedule
- DELETE /api/queue/{item_id} - Cancel
- GET /api/queue/status - Get queue statistics
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/queue", tags=["queue"])

class QueueItemCreate(BaseModel):
    video_id: str
    channel_id: str
    title: str
    video_file_path: str
    thumbnail_path: Optional[str] = None
    source: str = "auto"
    priority: str = "normal"
    metadata: dict = {}

class QueueStatusUpdate(BaseModel):
    status: str
    youtube_url: Optional[str] = None

class RescheduleRequest(BaseModel):
    scheduled_at: datetime

def get_queue_manager():
    from app.services.upload_queue_manager import get_upload_queue_manager
    return get_upload_queue_manager()

@router.get("")
async def get_queue(
    channel_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get all queue items"""
    queue_mgr = get_queue_manager()
    items = queue_mgr.get_all_items(channel_id=channel_id, status=[status] if status else None, limit=limit)
    return {"data": items, "total": len(items)}

@router.post("")
async def enqueue_video(item: QueueItemCreate):
    """Add video to upload queue"""
    queue_mgr = get_queue_manager()
    
    video_data = {
        "video_id": item.video_id,
        "channel_id": item.channel_id,
        "title": item.title,
        "video_file_path": item.video_file_path,
        "thumbnail_path": item.thumbnail_path,
        "metadata": item.metadata
    }
    
    item_id = await queue_mgr.enqueue(
        video_data=video_data,
        source=item.source,
        priority=item.priority
    )
    
    return {"item_id": item_id, "status": "queued"}

@router.put("/{item_id}/status")
async def update_status(item_id: str, update: QueueStatusUpdate):
    """Update queue item status"""
    queue_mgr = get_queue_manager()
    
    result = await queue_mgr.update_status(
        item_id=item_id,
        status=update.status,
        youtube_url=update.youtube_url
    )
    
    if not result:
        raise HTTPException(status_code=404, message="Item not found")
    
    return {"status": "updated"}

@router.put("/{item_id}/reschedule")
async def reschedule_item(item_id: str, request: RescheduleRequest):
    """Reschedule queue item"""
    queue_mgr = get_queue_manager()
    
    result = await queue_mgr.reschedule(item_id, request.scheduled_at)
    
    if not result:
        raise HTTPException(status_code=404, message="Item not found")
    
    return {"status": "rescheduled"}

@router.delete("/{item_id}")
async def cancel_item(item_id: str, reason: Optional[str] = None):
    """Cancel queue item"""
    queue_mgr = get_queue_manager()
    
    result = await queue_mgr.cancel(item_id, reason)
    
    if not result:
        raise HTTPException(status_code=404, message="Item not found")
    
    return {"status": "cancelled"}

@router.get("/status")
async def get_queue_status(channel_id: Optional[str] = None):
    """Get queue statistics"""
    queue_mgr = get_queue_manager()
    status = queue_mgr.get_queue_status(channel_id)
    
    pending = await queue_mgr.get_pending_count(channel_id)
    
    return {
        "status": status,
        "pending_count": pending
    }

@router.post("/schedule")
async def set_channel_schedule(
    channel_id: str,
    daily_limit: int = 4,
    upload_times: List[str] = None
):
    """Set channel upload schedule"""
    queue_mgr = get_queue_manager()
    queue_mgr.set_channel_schedule(channel_id, daily_limit, upload_times)
    return {"status": "scheduled"}