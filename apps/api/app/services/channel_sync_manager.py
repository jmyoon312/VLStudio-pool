"""
Multi-Channel Synchronization Manager

Manages:
1. Cross-channel content synchronization
2. Unified publishing schedule
3. Resource sharing between channels
4. Conflict resolution
5. Channel dependency management

Usage:
    sync = ChannelSyncManager()
    
    # Sync content to multiple channels
    await sync.sync_to_channels(
        content_id=123,
        target_channels=[1, 2, 3],
        strategy="parallel"
    )
    
    # Get sync status
    status = sync.get_sync_status(content_id=123)
"""

import os
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


class SyncStrategy(Enum):
    """Synchronization strategies"""
    PARALLEL = "parallel"      # All at once
    SEQUENTIAL = "sequential"  # One by one
    PRIORITY = "priority"      # By channel priority
    STAGGERED = "staggered"    # Time-delayed


class SyncStatus(Enum):
    """Sync operation status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class ChannelDependency(Enum):
    """Channel dependency types"""
    NONE = "none"
    SHARES_AUDIENCE = "shares_audience"  # Same audience across channels
    SEQUENTIAL = "sequential"            # Must publish in order
    CROSS_PROMOTE = "cross_promote"      # Cross-promote content


@dataclass
class ChannelSyncConfig:
    """Channel synchronization configuration"""
    channel_id: int
    priority: int = 5          # 1-10, higher = more priority
    dependency: ChannelDependency = ChannelDependency.NONE
    depends_on: List[int] = field(default_factory=list)  # Channel IDs
    sync_enabled: bool = True
    max_retries: int = 3


@dataclass
class SyncOperation:
    """Sync operation"""
    operation_id: str
    content_id: int
    source_channel: int
    target_channels: List[int]
    strategy: SyncStrategy
    status: SyncStatus = SyncStatus.PENDING
    results: Dict[int, bool] = field(default_factory=dict)
    errors: Dict[int, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class SharedResource:
    """Shared resource between channels"""
    resource_id: str
    resource_type: str  # "thumbnail", "music", "asset"
    channel_ids: List[int]
    path: str
    created_at: datetime = field(default_factory=datetime.now)


class ChannelSyncManager:
    """
    Multi-Channel Synchronization Manager
    
    Features:
    - Cross-channel content sync
    - Unified schedule management
    - Resource sharing
    - Conflict resolution
    - Dependency tracking
    """
    
    def __init__(self):
        self._channel_configs: Dict[int, ChannelSyncConfig] = {}
        self._sync_operations: Dict[str, SyncOperation] = {}
        self._shared_resources: Dict[str, SharedResource] = {}
        self._content_map: Dict[int, Set[int]] = defaultdict(set)  # content_id -> channel_ids
        
        # Sync queue
        self._sync_queue: asyncio.Queue = asyncio.Queue()
        
        logger.info("ChannelSyncManager initialized")
    
    def configure_channel(
        self,
        channel_id: int,
        priority: int = 5,
        dependency: ChannelDependency = ChannelDependency.NONE,
        depends_on: List[int] = None,
        sync_enabled: bool = True
    ) -> ChannelSyncConfig:
        """Configure channel sync settings"""
        config = ChannelSyncConfig(
            channel_id=channel_id,
            priority=priority,
            dependency=dependency,
            depends_on=depends_on or [],
            sync_enabled=sync_enabled
        )
        
        self._channel_configs[channel_id] = config
        
        logger.info(f"📡 Channel {channel_id} configured: priority={priority}, dependency={dependency.value}")
        
        return config
    
    def get_channel_config(self, channel_id: int) -> Optional[ChannelSyncConfig]:
        """Get channel sync configuration"""
        return self._channel_configs.get(channel_id)
    
    async def sync_to_channels(
        self,
        content_id: int,
        target_channels: List[int],
        strategy: SyncStrategy = SyncStrategy.PARALLEL,
        source_channel: int = None
    ) -> str:
        """
        Sync content to multiple channels
        
        Args:
            content_id: Content ID to sync
            target_channels: List of target channel IDs
            strategy: Sync strategy
            source_channel: Source channel (optional)
            
        Returns:
            Operation ID
        """
        operation_id = f"sync_{uuid.uuid4().hex[:12]}"
        
        operation = SyncOperation(
            operation_id=operation_id,
            content_id=content_id,
            source_channel=source_channel or target_channels[0],
            target_channels=target_channels,
            strategy=strategy
        )
        
        self._sync_operations[operation_id] = operation
        self._content_map[content_id].update(target_channels)
        
        # Execute based on strategy
        if strategy == SyncStrategy.PARALLEL:
            await self._sync_parallel(operation)
        elif strategy == SyncStrategy.SEQUENTIAL:
            await self._sync_sequential(operation)
        elif strategy == SyncStrategy.PRIORITY:
            await self._sync_priority(operation)
        elif strategy == SyncStrategy.STAGGERED:
            await self._sync_staggered(operation)
        
        return operation_id
    
    async def _sync_parallel(self, operation: SyncOperation):
        """Sync to all channels in parallel"""
        operation.status = SyncStatus.IN_PROGRESS
        
        # Create tasks for all channels
        tasks = []
        for channel_id in operation.target_channels:
            task = asyncio.create_task(
                self._sync_to_single_channel(
                    operation.content_id,
                    channel_id,
                    operation.operation_id
                )
            )
            tasks.append((channel_id, task))
        
        # Wait for all
        for channel_id, task in tasks:
            try:
                success = await task
                operation.results[channel_id] = success
                
                if not success:
                    operation.errors[channel_id] = "Sync failed"
                    
            except Exception as e:
                operation.results[channel_id] = False
                operation.errors[channel_id] = str(e)
                logger.error(f"[FAIL] Sync to channel {channel_id} failed: {e}")
        
        # Update status
        self._update_operation_status(operation)
    
    async def _sync_sequential(self, operation: SyncOperation):
        """Sync to channels sequentially"""
        operation.status = SyncStatus.IN_PROGRESS
        
        for channel_id in operation.target_channels:
            # Check dependencies
            config = self._channel_configs.get(channel_id)
            if config and config.depends_on:
                for dep_id in config.depends_on:
                    if not operation.results.get(dep_id):
                        operation.errors[channel_id] = f"Dependency not met: {dep_id}"
                        operation.results[channel_id] = False
                        continue
            
            try:
                success = await self._sync_to_single_channel(
                    operation.content_id,
                    channel_id,
                    operation.operation_id
                )
                operation.results[channel_id] = success
                
                if not success:
                    operation.errors[channel_id] = "Sync failed"
                    
            except Exception as e:
                operation.results[channel_id] = False
                operation.errors[channel_id] = str(e)
        
        self._update_operation_status(operation)
    
    async def _sync_priority(self, operation: SyncOperation):
        """Sync by channel priority"""
        operation.status = SyncStatus.IN_PROGRESS
        
        # Sort by priority
        sorted_channels = sorted(
            operation.target_channels,
            key=lambda c: self._channel_configs.get(c, ChannelSyncConfig(c)).priority,
            reverse=True
        )
        
        for channel_id in sorted_channels:
            try:
                success = await self._sync_to_single_channel(
                    operation.content_id,
                    channel_id,
                    operation.operation_id
                )
                operation.results[channel_id] = success
                
            except Exception as e:
                operation.results[channel_id] = False
                operation.errors[channel_id] = str(e)
        
        self._update_operation_status(operation)
    
    async def _sync_staggered(self, operation: SyncOperation):
        """Sync with time delays between channels"""
        operation.status = SyncStatus.IN_PROGRESS
        
        delay_minutes = 10  # Configurable
        
        for i, channel_id in enumerate(operation.target_channels):
            # Wait before each sync (except first)
            if i > 0:
                await asyncio.sleep(delay_minutes * 60)
            
            try:
                success = await self._sync_to_single_channel(
                    operation.content_id,
                    channel_id,
                    operation.operation_id
                )
                operation.results[channel_id] = success
                
            except Exception as e:
                operation.results[channel_id] = False
                operation.errors[channel_id] = str(e)
        
        self._update_operation_status(operation)
    
    async def _sync_to_single_channel(
        self,
        content_id: int,
        channel_id: int,
        operation_id: str
    ) -> bool:
        """Sync content to single channel"""
        
        config = self._channel_configs.get(channel_id)
        
        if not config or not config.sync_enabled:
            logger.warning(f"[WARN] Sync disabled for channel {channel_id}")
            return False
        
        try:
            # Simulate sync operation
            # In real implementation, this would:
            # 1. Get content from source
            # 2. Adapt for channel (aspect ratio, etc.)
            # 3. Upload to channel
            
            logger.info(f"📤 Syncing content {content_id} to channel {channel_id}")
            
            # Simulate processing time
            await asyncio.sleep(0.5)
            
            logger.info(f"[OK] Synced content {content_id} to channel {channel_id}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] Sync to channel {channel_id} failed: {e}")
            return False
    
    def _update_operation_status(self, operation: SyncOperation):
        """Update operation status based on results"""
        results = operation.results
        
        if not results:
            operation.status = SyncStatus.PENDING
        elif all(results.values()):
            operation.status = SyncStatus.COMPLETED
        elif any(results.values()):
            operation.status = SyncStatus.PARTIAL
        else:
            operation.status = SyncStatus.FAILED
        
        operation.completed_at = datetime.now()
    
    def get_sync_status(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """Get sync operation status"""
        operation = self._sync_operations.get(operation_id)
        
        if not operation:
            return None
        
        return {
            "operation_id": operation.operation_id,
            "content_id": operation.content_id,
            "status": operation.status.value,
            "source_channel": operation.source_channel,
            "target_channels": operation.target_channels,
            "results": operation.results,
            "errors": operation.errors,
            "created_at": operation.created_at.isoformat(),
            "completed_at": operation.completed_at.isoformat() if operation.completed_at else None
        }
    
    def get_content_channels(self, content_id: int) -> Set[int]:
        """Get channels where content is published"""
        return self._content_map.get(content_id, set())
    
    def get_channel_dependencies(self, channel_id: int) -> List[int]:
        """Get channel dependencies"""
        config = self._channel_configs.get(channel_id)
        return config.depends_on if config else []
    
    def add_shared_resource(
        self,
        resource_type: str,
        channel_ids: List[int],
        path: str
    ) -> str:
        """Add shared resource"""
        resource_id = f"shared_{uuid.uuid4().hex[:8]}"
        
        resource = SharedResource(
            resource_id=resource_id,
            resource_type=resource_type,
            channel_ids=channel_ids,
            path=path
        )
        
        self._shared_resources[resource_id] = resource
        
        logger.info(f"[BOX] Shared resource added: {resource_type} for channels {channel_ids}")
        
        return resource_id
    
    def get_shared_resources(
        self,
        channel_id: int = None,
        resource_type: str = None
    ) -> List[SharedResource]:
        """Get shared resources"""
        resources = list(self._shared_resources.values())
        
        if channel_id is not None:
            resources = [r for r in resources if channel_id in r.channel_ids]
        
        if resource_type:
            resources = [r for r in resources if r.resource_type == resource_type]
        
        return resources
    
    def resolve_conflict(
        self,
        content_id: int,
        channels: List[int]
    ) -> Dict[str, Any]:
        """Resolve publishing conflict"""
        # Simple resolution: use priority
        configs = [
            (c, self._channel_configs.get(c, ChannelSyncConfig(c)))
            for c in channels
        ]
        
        sorted_channels = sorted(
            configs,
            key=lambda x: x[1].priority if x[1] else 5,
            reverse=True
        )
        
        return {
            "content_id": content_id,
            "recommended_order": [c[0] for c in sorted_channels],
            "reason": "Priority-based ordering"
        }
    
    def get_sync_stats(self) -> Dict[str, Any]:
        """Get sync statistics"""
        total_ops = len(self._sync_operations)
        
        by_status = {}
        for op in self._sync_operations.values():
            status = op.status.value
            by_status[status] = by_status.get(status, 0) + 1
        
        return {
            "total_operations": total_ops,
            "by_status": by_status,
            "configured_channels": len(self._channel_configs),
            "shared_resources": len(self._shared_resources)
        }


# Global singleton
_channel_sync_manager = None

def get_channel_sync_manager() -> ChannelSyncManager:
    """Get global ChannelSyncManager instance"""
    global _channel_sync_manager
    if _channel_sync_manager is None:
        _channel_sync_manager = ChannelSyncManager()
    return _channel_sync_manager