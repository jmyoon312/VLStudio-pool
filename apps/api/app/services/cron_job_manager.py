"""
Cron Job Manager - Centralized Job Management

Manages all scheduled jobs across the system:
1. Production schedules
2. Maintenance tasks
3. Analytics updates
4. Cleanup jobs
5. Health checks

Usage:
    manager = CronJobManager()
    
    # List all jobs
    jobs = manager.list_jobs()
    
    # Add custom job
    manager.add_job("my_task", "0 * * * *", my_function)
    
    # Pause/resume
    manager.pause_job("production_channel_123")
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


class JobType(Enum):
    """Types of cron jobs"""
    PRODUCTION = "production"
    MAINTENANCE = "maintenance"
    ANALYTICS = "analytics"
    CLEANUP = "cleanup"
    HEALTH = "health"
    CUSTOM = "custom"


class JobStatus(Enum):
    """Job status"""
    ACTIVE = "active"
    PAUSED = "paused"
    RUNNING = "running"
    FAILED = "failed"
    DISABLED = "disabled"


@dataclass
class CronJob:
    """Cron job definition"""
    job_id: str
    name: str
    job_type: JobType
    cron_expression: str
    callback: Callable
    enabled: bool = True
    description: str = ""
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    failure_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class CronJobManager:
    """
    Centralized Cron Job Manager
    
    Manages all scheduled jobs with:
    - Centralized job registry
    - Job status tracking
    - Failure handling
    - Job dependencies
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone='Asia/Seoul')
        self._jobs: Dict[str, CronJob] = {}
        self._running = False
        
        # Predefined job templates
        self._job_templates = self._init_job_templates()
        
        logger.info("CronJobManager initialized")
    
    def _init_job_templates(self) -> Dict[str, Dict]:
        """Initialize job templates"""
        return {
            "production_daily": {
                "name": "Daily Production Run",
                "type": JobType.PRODUCTION,
                "cron": "0 6 * * *",
                "description": "Run daily video production"
            },
            "production_4h": {
                "name": "4-Hour Production",
                "type": JobType.PRODUCTION,
                "cron": "0 */4 * * *",
                "description": "Run production every 4 hours"
            },
            "cleanup_daily": {
                "name": "Daily Cleanup",
                "type": JobType.CLEANUP,
                "cron": "0 3 * * *",
                "description": "Clean up temp files daily at 3 AM"
            },
            "analytics_hourly": {
                "name": "Hourly Analytics",
                "type": JobType.ANALYTICS,
                "cron": "0 * * * *",
                "description": "Update analytics every hour"
            },
            "health_check": {
                "name": "System Health Check",
                "type": JobType.HEALTH,
                "cron": "*/15 * * * *",
                "description": "Check system health every 15 minutes"
            },
            "trend_scan": {
                "name": "Trend Scanning",
                "type": JobType.PRODUCTION,
                "cron": "0 */6 * * *",
                "description": "Scan for trends every 6 hours"
            },
            "backup_daily": {
                "name": "Daily Backup",
                "type": JobType.MAINTENANCE,
                "cron": "0 2 * * *",
                "description": "Backup database daily at 2 AM"
            }
        }
    
    def start(self):
        """Start the scheduler"""
        if not self._running:
            self.scheduler.start()
            self._running = True
            logger.info("[OK] CronJobManager started")
    
    def stop(self):
        """Stop the scheduler"""
        if self._running:
            self.scheduler.shutdown()
            self._running = False
            logger.info("🛑 CronJobManager stopped")
    
    def add_job(
        self,
        job_id: str,
        name: str,
        cron_expression: str,
        callback: Callable,
        job_type: JobType = JobType.CUSTOM,
        description: str = "",
        enabled: bool = True,
        **kwargs
    ) -> bool:
        """
        Add a new cron job
        
        Args:
            job_id: Unique job identifier
            name: Job name
            cron_expression: Cron expression
            callback: Function to execute
            job_type: Type of job
            description: Job description
            enabled: Whether job is enabled
            
        Returns:
            Success status
        """
        try:
            # Create job definition
            job = CronJob(
                job_id=job_id,
                name=name,
                job_type=job_type,
                cron_expression=cron_expression,
                callback=callback,
                description=description,
                enabled=enabled,
                metadata=kwargs
            )
            
            # Add to scheduler if enabled
            if enabled:
                trigger = CronTrigger.from_crontab(cron_expression)
                self.scheduler.add_job(
                    func=self._wrap_callback(job_id),
                    trigger=trigger,
                    id=job_id,
                    name=name,
                    replace_existing=True
                )
            
            self._jobs[job_id] = job
            
            logger.info(f"[OK] Added job: {job_id} ({cron_expression})")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] Failed to add job {job_id}: {e}")
            return False
    
    def add_job_from_template(
        self,
        template_name: str,
        job_id: str,
        callback: Callable,
        **override_params
    ) -> bool:
        """
        Add job from predefined template
        
        Args:
            template_name: Name of template
            job_id: Unique job identifier
            callback: Function to execute
            **override_params: Parameters to override
            
        Returns:
            Success status
        """
        template = self._job_templates.get(template_name)
        
        if not template:
            logger.error(f"Unknown template: {template_name}")
            return False
        
        # Merge with overrides
        params = {**template, **override_params}
        
        return self.add_job(
            job_id=job_id,
            name=params["name"],
            cron_expression=params["cron"],
            callback=callback,
            job_type=params["type"],
            description=params.get("description", "")
        )
    
    def remove_job(self, job_id: str) -> bool:
        """Remove a job"""
        try:
            if job_id in self._jobs:
                self.scheduler.remove_job(job_id)
                del self._jobs[job_id]
                logger.info(f"🗑️ Removed job: {job_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to remove job {job_id}: {e}")
        return False
    
    def pause_job(self, job_id: str) -> bool:
        """Pause a job"""
        try:
            self.scheduler.pause_job(job_id)
            if job_id in self._jobs:
                self._jobs[job_id].enabled = False
            logger.info(f"⏸️ Paused job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to pause job {job_id}: {e}")
            return False
    
    def resume_job(self, job_id: str) -> bool:
        """Resume a paused job"""
        try:
            self.scheduler.resume_job(job_id)
            if job_id in self._jobs:
                self._jobs[job_id].enabled = True
            logger.info(f"▶️ Resumed job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to resume job {job_id}: {e}")
            return False
    
    def list_jobs(self, job_type: Optional[JobType] = None) -> List[Dict[str, Any]]:
        """
        List all jobs
        
        Args:
            job_type: Filter by job type
            
        Returns:
            List of job info
        """
        jobs = []
        
        for job_id, job in self._jobs.items():
            if job_type and job.job_type != job_type:
                continue
            
            # Get next run time from scheduler
            try:
                scheduled_job = self.scheduler.get_job(job_id)
                next_run = scheduled_job.next_run_time if scheduled_job else None
            except:
                next_run = None
            
            jobs.append({
                "job_id": job_id,
                "name": job.name,
                "type": job.job_type.value,
                "cron": job.cron_expression,
                "enabled": job.enabled,
                "description": job.description,
                "last_run": job.last_run.isoformat() if job.last_run else None,
                "next_run": next_run.isoformat() if next_run else None,
                "run_count": job.run_count,
                "failure_count": job.failure_count
            })
        
        return jobs
    
    def get_job_info(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed job information"""
        job = self._jobs.get(job_id)
        
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "name": job.name,
            "type": job.job_type.value,
            "cron": job.cron_expression,
            "enabled": job.enabled,
            "description": job.description,
            "last_run": job.last_run.isoformat() if job.last_run else None,
            "next_run": job.next_run.isoformat() if job.next_run else None,
            "run_count": job.run_count,
            "failure_count": job.failure_count,
            "metadata": job.metadata
        }
    
    def _wrap_callback(self, job_id: str) -> Callable:
        """Wrap callback to track execution"""
        job = self._jobs.get(job_id)
        
        def wrapper(*args, **kwargs):
            if job:
                job.run_count += 1
                job.last_run = datetime.now()
                
                try:
                    result = job.callback(*args, **kwargs)
                    logger.info(f"[OK] Job {job_id} completed")
                    return result
                except Exception as e:
                    job.failure_count += 1
                    logger.error(f"[FAIL] Job {job_id} failed: {e}")
                    raise
        
        return wrapper
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all jobs"""
        total = len(self._jobs)
        enabled = sum(1 for j in self._jobs.values() if j.enabled)
        
        by_type = {}
        for job in self._jobs.values():
            key = job.job_type.value
            by_type[key] = by_type.get(key, 0) + 1
        
        return {
            "total_jobs": total,
            "enabled": enabled,
            "paused": total - enabled,
            "by_type": by_type,
            "total_runs": sum(j.run_count for j in self._jobs.values()),
            "total_failures": sum(j.failure_count for j in self._jobs.values())
        }


# Global singleton
_cron_job_manager = None

def get_cron_job_manager() -> CronJobManager:
    """Get global CronJobManager instance"""
    global _cron_job_manager
    if _cron_job_manager is None:
        _cron_job_manager = CronJobManager()
    return _cron_job_manager