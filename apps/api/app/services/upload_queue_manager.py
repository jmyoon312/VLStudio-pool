"""
Upload Queue Manager

Provides:
1. Unified queue for auto-generated + manual videos
2. Channel-based scheduling (3-5 videos/day, 24/7)
3. Priority management (auto vs manual, urgency)
4. Queue ordering and scheduling

Usage:
    queue = UploadQueueManager()
    
    # Add video to queue
    await queue.enqueue(video_data, source="auto", priority="high")
    
    # Get next upload
    next_item = await queue.get_next_for_channel("channel_123")
    
    # Schedule management
    await queue.reschedule(item_id, new_time)
"""

import os
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class VideoSource(Enum):
    AUTO = "auto"
    MANUAL = "manual"
    IMPORTED = "imported"


class Priority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4


class QueueStatus(Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class QueueItem:
    item_id: str
    video_id: str
    channel_id: str
    title: str
    video_file_path: str
    thumbnail_path: Optional[str]
    source: VideoSource
    priority: Priority
    status: QueueStatus
    scheduled_at: datetime
    created_at: datetime = field(default_factory=datetime.now)
    uploaded_at: Optional[datetime] = None
    youtube_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class ChannelSchedule:
    channel_id: str
    daily_upload_limit: int = 4
    upload_times: List[str] = field(default_factory=list)
    timezone: str = "Asia/Seoul"
    enabled: bool = True
    last_upload: Optional[datetime] = None


class UploadQueueManager:
    def __init__(self):
        self._queue: Dict[str, QueueItem] = {}
        self._channel_schedules: Dict[str, ChannelSchedule] = {}
        self._daily_upload_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        
        logger.info("UploadQueueManager initialized")
    
    async def enqueue(
        self,
        video_data: Dict[str, Any],
        source: str = "auto",
        priority: str = "normal",
        scheduled_at: Optional[datetime] = None
    ) -> str:
        item_id = f"q_{uuid.uuid4().hex[:8]}"
        
        video_source = VideoSource(source.lower())
        video_priority = Priority[priority.upper()]
        
        if scheduled_at is None:
            scheduled_at = await self._calculate_next_slot(
                video_data.get("channel_id"),
                video_source
            )
        
        item = QueueItem(
            item_id=item_id,
            video_id=video_data.get("video_id", f"vid_{uuid.uuid4().hex[:8]}"),
            channel_id=video_data["channel_id"],
            title=video_data.get("title", "Untitled"),
            video_file_path=video_data["video_file_path"],
            thumbnail_path=video_data.get("thumbnail_path"),
            source=video_source,
            priority=video_priority,
            status=QueueStatus.PENDING,
            scheduled_at=scheduled_at,
            metadata=video_data.get("metadata", {})
        )
        
        self._queue[item_id] = item
        
        logger.info(f"📋 Enqueued: {item.title} -> {item.channel_id} (scheduled: {scheduled_at})")
        
        return item_id
    
    async def _calculate_next_slot(
        self,
        channel_id: str,
        source: VideoSource
    ) -> datetime:
        schedule = self._channel_schedules.get(channel_id)
        now = datetime.now()
        
        if not schedule or not schedule.enabled:
            return now
        
        today = now.date()
        channel_key = f"{channel_id}_{today}"
        today_count = self._daily_upload_counts[channel_key].get("count", 0)
        
        if today_count >= schedule.daily_upload_limit:
            return now + timedelta(days=1)
        
        base_hour = 9
        base_minute = 0
        
        if source == VideoSource.AUTO:
            base_hour = 6 + (today_count * 3)
        else:
            base_hour = 12 + (today_count * 2)
        
        next_slot = datetime(
            today.year, today.month, today.day,
            min(base_hour, 23), base_minute
        )
        
        if next_slot <= now:
            next_slot = now + timedelta(hours=1)
        
        return next_slot
    
    async def get_next_for_channel(
        self,
        channel_id: str,
        max_results: int = 1
    ) -> List[QueueItem]:
        now = datetime.now()
        
        channel_items = [
            item for item in self._queue.values()
            if item.channel_id == channel_id
            and item.status in [QueueStatus.PENDING, QueueStatus.SCHEDULED]
            and item.scheduled_at <= now
        ]
        
        channel_items.sort(
            key=lambda x: (
                -x.priority.value,
                x.scheduled_at,
                x.source.value
            )
        )
        
        return channel_items[:max_results]
    
    async def get_pending_count(self, channel_id: str = None) -> int:
        if channel_id:
            return len([
                item for item in self._queue.values()
                if item.channel_id == channel_id
                and item.status in [QueueStatus.PENDING, QueueStatus.SCHEDULED]
            ])
        return len([
            item for item in self._queue.values()
            if item.status in [QueueStatus.PENDING, QueueStatus.SCHEDULED]
        ])
    
    async def update_status(
        self,
        item_id: str,
        status: str,
        youtube_url: str = None
    ) -> bool:
        item = self._queue.get(item_id)
        if not item:
            return False
        
        item.status = QueueStatus(status.lower())
        
        if status == "completed":
            item.uploaded_at = datetime.now()
            if youtube_url:
                item.youtube_url = youtube_url
            
            today = datetime.now().date()
            channel_key = f"{item.channel_id}_{today}"
            self._daily_upload_counts[channel_key]["count"] += 1
            
            logger.info(f"✅ Upload completed: {item.title}")
        
        elif status == "failed":
            item.retry_count += 1
            if item.retry_count >= item.max_retries:
                item.status = QueueStatus.CANCELLED
                logger.error(f"❌ Max retries reached: {item.title}")
            else:
                item.scheduled_at = datetime.now() + timedelta(minutes=30)
                logger.warning(f"🔄 Will retry: {item.title} (attempt {item.retry_count + 1})")
        
        return True
    
    async def reschedule(
        self,
        item_id: str,
        new_scheduled_at: datetime
    ) -> bool:
        item = self._queue.get(item_id)
        if not item:
            return False
        
        item.scheduled_at = new_scheduled_at
        item.status = QueueStatus.SCHEDULED
        
        logger.info(f"📅 Rescheduled: {item.title} -> {new_scheduled_at}")
        
        return True
    
    async def cancel(self, item_id: str, reason: str = None) -> bool:
        item = self._queue.get(item_id)
        if not item:
            return False
        
        item.status = QueueStatus.CANCELLED
        if reason:
            item.metadata["cancel_reason"] = reason
        
        logger.info(f"❌ Cancelled: {item.title} - {reason}")
        
        return True
    
    def get_queue_status(self, channel_id: str = None) -> Dict:
        items = self._queue.values()
        
        if channel_id:
            items = [i for i in items if i.channel_id == channel_id]
        
        by_status = defaultdict(int)
        by_source = defaultdict(int)
        by_priority = defaultdict(int)
        
        for item in items:
            by_status[item.status.value] += 1
            by_source[item.source.value] += 1
            by_priority[item.priority.name] += 1
        
        return {
            "total": len(items),
            "by_status": dict(by_status),
            "by_source": dict(by_source),
            "by_priority": dict(by_priority)
        }
    
    def get_all_items(
        self,
        channel_id: str = None,
        status: List[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        items = self._queue.values()
        
        if channel_id:
            items = [i for i in items if i.channel_id == channel_id]
        
        if status:
            items = [i for i in items if i.status.value in status]
        
        items = sorted(items, key=lambda x: x.scheduled_at)
        
        return [
            {
                "item_id": i.item_id,
                "video_id": i.video_id,
                "channel_id": i.channel_id,
                "title": i.title,
                "source": i.source.value,
                "priority": i.priority.name,
                "status": i.status.value,
                "scheduled_at": i.scheduled_at.isoformat(),
                "uploaded_at": i.uploaded_at.isoformat() if i.uploaded_at else None,
                "youtube_url": i.youtube_url,
                "retry_count": i.retry_count
            }
            for i in items[:limit]
        ]
    
    def set_channel_schedule(
        self,
        channel_id: str,
        daily_limit: int = 4,
        upload_times: List[str] = None,
        timezone: str = "Asia/Seoul"
    ):
        schedule = ChannelSchedule(
            channel_id=channel_id,
            daily_upload_limit=daily_limit,
            upload_times=upload_times or [],
            timezone=timezone
        )
        self._channel_schedules[channel_id] = schedule
        logger.info(f"📅 Schedule set for {channel_id}: {daily_limit}/day")


_upload_queue_manager = None

def get_upload_queue_manager() -> UploadQueueManager:
    global _upload_queue_manager
    if _upload_queue_manager is None:
        _upload_queue_manager = UploadQueueManager()
    return _upload_queue_manager