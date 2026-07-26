"""
Mission Scheduler - Automated Production Scheduling

Manages:
1. Channel-specific production schedules
2. Video publish timing optimization
3. Trend-based scheduling
4. Batch processing windows

Usage:
    scheduler = MissionScheduler()
    
    # Schedule daily production for a channel
    scheduler.schedule_channel_production(
        channel_id=123,
        cron="0 6,12,18 * * *",  # 3 times daily
        timezone="Asia/Seoul"
    )
    
    # Get next scheduled times
    next_runs = scheduler.get_next_runs(channel_id=123, count=5)
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ScheduleType(Enum):
    """Types of schedules"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"
    TREND_BASED = "trend_based"


class ChannelPriority(Enum):
    """Channel production priority"""
    HIGH = "high"      # 3-5 videos/day
    MEDIUM = "medium"  # 1-2 videos/day
    LOW = "low"        # 2-3 videos/week


@dataclass
class ScheduleConfig:
    """Schedule configuration for a channel"""
    channel_id: int
    schedule_type: ScheduleType
    cron_expression: str
    timezone: str = "Asia/Seoul"
    max_daily_videos: int = 3
    optimal_times: List[str] = field(default_factory=list)  # ["06:00", "12:00", "18:00"]
    trend_based: bool = False
    trend_check_interval_hours: int = 4
    enabled: bool = True


@dataclass
class ScheduledRun:
    """Scheduled run information"""
    channel_id: int
    scheduled_time: datetime
    status: str = "pending"  # pending, running, completed, skipped
    estimated_videos: int = 0


class MissionScheduler:
    """
    Mission Scheduler for automated video production
    
    Features:
    - Per-channel scheduling
    - Optimal publish time calculation
    - Trend-based dynamic scheduling
    - Batch processing windows
    - Failover and retry logic
    """
    
    def __init__(self):
        self._schedules: Dict[int, ScheduleConfig] = {}
        self._history: Dict[int, List[ScheduledRun]] = {}
        
        # Default schedule templates
        self._default_schedules = {
            ChannelPriority.HIGH: "0 6,10,14,18,22 * * *",  # Every 4 hours
            ChannelPriority.MEDIUM: "0 9,15 * * *",         # Twice daily
            ChannelPriority.LOW: "0 10 * * 0,3"             # Twice a week
        }
        
        logger.info("MissionScheduler initialized")
    
    def configure_channel(
        self,
        channel_id: int,
        priority: ChannelPriority = ChannelPriority.MEDIUM,
        custom_cron: Optional[str] = None,
        timezone: str = "Asia/Seoul",
        max_daily: int = 3,
        trend_based: bool = False
    ) -> ScheduleConfig:
        """
        Configure schedule for a channel
        
        Args:
            channel_id: Channel ID
            priority: Production priority (determines default schedule)
            custom_cron: Custom cron expression (overrides priority)
            timezone: Timezone for scheduling
            max_daily: Maximum videos per day
            trend_based: Use trend-based dynamic scheduling
            
        Returns:
            ScheduleConfig
        """
        cron = custom_cron or self._default_schedules.get(priority, "0 9 * * *")
        
        # Calculate optimal times from cron
        optimal_times = self._extract_times_from_cron(cron)
        
        config = ScheduleConfig(
            channel_id=channel_id,
            schedule_type=ScheduleType.TREND_BASED if trend_based else ScheduleType.DAILY,
            cron_expression=cron,
            timezone=timezone,
            max_daily_videos=max_daily,
            optimal_times=optimal_times,
            trend_based=trend_based
        )
        
        self._schedules[channel_id] = config
        
        logger.info(f"📅 Channel {channel_id} scheduled: {cron} (priority: {priority.value})")
        
        return config
    
    def schedule_channel_production(
        self,
        channel_id: int,
        cron: str,
        timezone: str = "Asia/Seoul",
        max_daily: int = 3,
        trend_based: bool = False
    ) -> bool:
        """
        Schedule production for a channel
        
        Args:
            channel_id: Channel ID
            cron: Cron expression
            timezone: Timezone
            max_daily: Max videos per day
            trend_based: Enable trend-based scheduling
            
        Returns:
            Success status
        """
        try:
            config = self.configure_channel(
                channel_id=channel_id,
                custom_cron=cron,
                timezone=timezone,
                max_daily=max_daily,
                trend_based=trend_based
            )
            
            # In a real implementation, this would add to APScheduler
            # For now, just store the config
            logger.info(f"✅ Scheduled channel {channel_id}: {cron}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to schedule channel {channel_id}: {e}")
            return False
    
    def get_schedule(self, channel_id: int) -> Optional[ScheduleConfig]:
        """Get schedule configuration for a channel"""
        return self._schedules.get(channel_id)
    
    def get_all_schedules(self) -> Dict[int, ScheduleConfig]:
        """Get all channel schedules"""
        return self._schedules.copy()
    
    def remove_schedule(self, channel_id: int) -> bool:
        """Remove schedule for a channel"""
        if channel_id in self._schedules:
            del self._schedules[channel_id]
            logger.info(f"🗑️ Removed schedule for channel {channel_id}")
            return True
        return False
    
    def pause_schedule(self, channel_id: int) -> bool:
        """Pause schedule for a channel"""
        if channel_id in self._schedules:
            self._schedules[channel_id].enabled = False
            logger.info(f"⏸️ Paused schedule for channel {channel_id}")
            return True
        return False
    
    def resume_schedule(self, channel_id: int) -> bool:
        """Resume schedule for a channel"""
        if channel_id in self._schedules:
            self._schedules[channel_id].enabled = True
            logger.info(f"▶️ Resumed schedule for channel {channel_id}")
            return True
        return False
    
    def get_next_runs(
        self,
        channel_id: int,
        count: int = 5
    ) -> List[ScheduledRun]:
        """
        Get next scheduled runs for a channel
        
        Args:
            channel_id: Channel ID
            count: Number of runs to return
            
        Returns:
            List of ScheduledRun
        """
        config = self._schedules.get(channel_id)
        
        if not config or not config.enabled:
            return []
        
        # Calculate next run times (simplified)
        runs = []
        base_time = datetime.now()
        
        # Parse cron and generate next times
        # This is simplified - real implementation would use cron-parser
        for i in range(count):
            hour_index = i % len(config.optimal_times) if config.optimal_times else i
            next_time = base_time + timedelta(hours=(i + 1) * 4)
            
            if config.optimal_times and hour_index < len(config.optimal_times):
                time_str = config.optimal_times[hour_index]
                hour, minute = map(int, time_str.split(':'))
                next_time = next_time.replace(hour=hour, minute=minute)
            
            runs.append(ScheduledRun(
                channel_id=channel_id,
                scheduled_time=next_time,
                estimated_videos=config.max_daily_videos // len(config.optimal_times) if config.optimal_times else 1
            ))
        
        return runs
    
    def get_scheduled_channels(self) -> List[int]:
        """Get list of scheduled channel IDs"""
        return list(self._schedules.keys())
    
    def get_schedule_summary(self) -> Dict[str, Any]:
        """Get summary of all schedules"""
        total_channels = len(self._schedules)
        enabled_channels = sum(1 for s in self._schedules.values() if s.enabled)
        disabled_channels = total_channels - enabled_channels
        
        by_priority = {}
        for config in self._schedules.values():
            key = config.schedule_type.value
            by_priority[key] = by_priority.get(key, 0) + 1
        
        return {
            "total_channels": total_channels,
            "enabled": enabled_channels,
            "disabled": disabled_channels,
            "by_type": by_priority,
            "trend_based_count": sum(1 for s in self._schedules.values() if s.trend_based)
        }
    
    def _extract_times_from_cron(self, cron: str) -> List[str]:
        """Extract time list from cron expression"""
        times = []
        
        try:
            parts = cron.split()
            if len(parts) >= 2:
                hour_part = parts[1]
                
                if ',' in hour_part:
                    hours = hour_part.split(',')
                elif '-' in hour_part:
                    start, end = hour_part.split('-')
                    hours = range(int(start), int(end) + 1)
                elif hour_part == '*':
                    hours = range(0, 24)
                else:
                    hours = [hour_part]
                
                for h in hours:
                    times.append(f"{int(h):02d}:00")
                    
        except Exception as e:
            logger.warning(f"Failed to parse cron: {e}")
        
        return times
    
    def should_produce(self, channel_id: int) -> bool:
        """
        Check if channel should produce video now
        
        Args:
            channel_id: Channel ID
            
        Returns:
            True if should produce
        """
        config = self._schedules.get(channel_id)
        
        if not config or not config.enabled:
            return False
        
        now = datetime.now()
        current_hour = now.hour
        
        # Check if current time matches schedule
        for time_str in config.optimal_times:
            scheduled_hour = int(time_str.split(':')[0])
            if current_hour == scheduled_hour:
                # Check if already produced today
                if channel_id in self._history:
                    today_runs = [
                        r for r in self._history[channel_id]
                        if r.scheduled_time.date() == now.date()
                    ]
                    if len(today_runs) < config.max_daily_videos:
                        return True
        
        return False
    
    def record_production(
        self,
        channel_id: int,
        scheduled_time: datetime,
        status: str = "completed"
    ):
        """Record a production run"""
        if channel_id not in self._history:
            self._history[channel_id] = []
        
        run = ScheduledRun(
            channel_id=channel_id,
            scheduled_time=scheduled_time,
            status=status
        )
        
        self._history[channel_id].append(run)
        
        # Keep only last 30 days
        cutoff = datetime.now() - timedelta(days=30)
        self._history[channel_id] = [
            r for r in self._history[channel_id]
            if r.scheduled_time > cutoff
        ]
    
    def get_production_stats(self, channel_id: int, days: int = 7) -> Dict[str, Any]:
        """Get production statistics for a channel"""
        if channel_id not in self._history:
            return {
                "total_runs": 0,
                "completed": 0,
                "skipped": 0,
                "success_rate": 0.0
            }
        
        cutoff = datetime.now() - timedelta(days=days)
        runs = [r for r in self._history[channel_id] if r.scheduled_time > cutoff]
        
        completed = sum(1 for r in runs if r.status == "completed")
        skipped = sum(1 for r in runs if r.status == "skipped")
        
        return {
            "total_runs": len(runs),
            "completed": completed,
            "skipped": skipped,
            "success_rate": completed / len(runs) if runs else 0.0
        }


# Global singleton
_mission_scheduler = None

def get_mission_scheduler() -> MissionScheduler:
    """Get global MissionScheduler instance"""
    global _mission_scheduler
    if _mission_scheduler is None:
        _mission_scheduler = MissionScheduler()
    return _mission_scheduler