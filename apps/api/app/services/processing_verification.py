"""
Processing Verification Service

Provides:
1. Processing procedure validation (review → approve → upload → complete)
2. Missing item monitoring
3. Alert on processing delays
4. SLA tracking
5. Department/team workflow management

Usage:
    verifier = ProcessingVerificationService()
    
    # Check processing status
    status = await verifier.check_processing_status(item_id)
    
    # Get missing items
    missing = await verifier.get_missing_items(hours=24)
    
    # Verify workflow
    result = await verifier.verify_workflow(item_id)
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


class ProcessingStage(Enum):
    CREATED = "created"
    PENDING_REVIEW = "pending_review"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SCHEDULED = "scheduled"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class WorkflowStep:
    stage: ProcessingStage
    timestamp: datetime
    actor: str = "system"
    notes: str = ""
    

@dataclass
class ProcessingRecord:
    item_id: str
    video_id: str
    channel_id: str
    title: str
    workflow: List[WorkflowStep] = field(default_factory=list)
    current_stage: ProcessingStage = ProcessingStage.CREATED
    assigned_reviewer: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    sla_breached: bool = False


@dataclass
class VerificationAlert:
    alert_id: str
    item_id: str
    channel_id: str
    level: AlertLevel
    message: str
    stage: ProcessingStage
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class ProcessingVerificationService:
    def __init__(self):
        self._records: Dict[str, ProcessingRecord] = {}
        self._alerts: Dict[str, VerificationAlert] = {}
        self._sla_config = {
            "pending_review_hours": 4,
            "review_completion_hours": 24,
            "upload_timeout_hours": 2,
            "retry_window_hours": 48
        }
        self._team_assignments: Dict[str, str] = {}  # item_id -> team/department
        
        logger.info("ProcessingVerificationService initialized")
    
    async def register_item(
        self,
        item_id: str,
        video_id: str,
        channel_id: str,
        title: str,
        source: str = "auto",
        assigned_reviewer: str = None
    ) -> str:
        record = ProcessingRecord(
            item_id=item_id,
            video_id=video_id,
            channel_id=channel_id,
            title=title,
            current_stage=ProcessingStage.PENDING_REVIEW,
            assigned_reviewer=assigned_reviewer
        )
        
        record.workflow.append(WorkflowStep(
            stage=ProcessingStage.CREATED,
            timestamp=datetime.now(),
            notes=f"Created from {source}"
        ))
        
        record.workflow.append(WorkflowStep(
            stage=ProcessingStage.PENDING_REVIEW,
            timestamp=datetime.now(),
            notes="Awaiting review"
        ))
        
        sla_hours = self._sla_config["pending_review_hours"]
        record.sla_deadline = datetime.now() + timedelta(hours=sla_hours)
        
        self._records[item_id] = record
        
        if assigned_reviewer:
            self._team_assignments[item_id] = assigned_reviewer
        
        logger.info(f"📝 Registered: {title} -> {assigned_reviewer or 'unassigned'}")
        
        return item_id
    
    async def update_stage(
        self,
        item_id: str,
        new_stage: str,
        actor: str = "system",
        notes: str = ""
    ) -> bool:
        record = self._records.get(item_id)
        if not record:
            logger.warning(f"Record not found: {item_id}")
            return False
        
        try:
            stage = ProcessingStage(new_stage.lower())
        except ValueError:
            logger.error(f"Invalid stage: {new_stage}")
            return False
        
        record.workflow.append(WorkflowStep(
            stage=stage,
            timestamp=datetime.now(),
            actor=actor,
            notes=notes
        ))
        
        record.current_stage = stage
        
        if stage == ProcessingStage.APPROVED:
            sla_hours = self._sla_config["upload_timeout_hours"]
            record.sla_deadline = datetime.now() + timedelta(hours=sla_hours)
        
        logger.info(f"🔄 Stage updated: {item_id} -> {stage.value}")
        
        return True
    
    async def check_processing_status(self, item_id: str) -> Optional[Dict]:
        record = self._records.get(item_id)
        if not record:
            return None
        
        workflow_timeline = [
            {
                "stage": step.stage.value,
                "timestamp": step.timestamp.isoformat(),
                "actor": step.actor,
                "notes": step.notes
            }
            for step in record.workflow
        ]
        
        now = datetime.now()
        time_in_stage = (now - record.workflow[-1].timestamp).total_seconds() / 3600
        
        return {
            "item_id": record.item_id,
            "title": record.title,
            "channel_id": record.channel_id,
            "current_stage": record.current_stage.value,
            "assigned_reviewer": record.assigned_reviewer,
            "sla_deadline": record.sla_deadline.isoformat() if record.sla_deadline else None,
            "sla_breached": record.sla_breached,
            "time_in_stage_hours": round(time_in_stage, 2),
            "workflow_timeline": workflow_timeline
        }
    
    async def verify_workflow(self, item_id: str) -> Dict:
        record = self._records.get(item_id)
        if not record:
            return {"valid": False, "errors": ["Item not found"]}
        
        errors = []
        warnings = []
        
        stages = [step.stage for step in record.workflow]
        
        required_order = [
            ProcessingStage.CREATED,
            ProcessingStage.PENDING_REVIEW,
        ]
        
        for i, expected in enumerate(required_order):
            if expected not in stages:
                if i < len(stages):
                    errors.append(f"Missing required stage: {expected.value}")
        
        if ProcessingStage.FAILED in stages and ProcessingStage.COMPLETED in stages:
            errors.append("Cannot be both failed and completed")
        
        if record.sla_deadline and datetime.now() > record.sla_deadline:
            if record.current_stage not in [ProcessingStage.COMPLETED, ProcessingStage.FAILED]:
                record.sla_breached = True
                warnings.append("SLA deadline breached")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "current_stage": record.current_stage.value
        }
    
    async def get_missing_items(
        self,
        hours: int = 24,
        stage: str = None
    ) -> List[Dict]:
        cutoff = datetime.now() - timedelta(hours=hours)
        missing = []
        
        for item_id, record in self._records.items():
            last_step = record.workflow[-1] if record.workflow else None
            
            if not last_step:
                continue
            
            if stage and record.current_stage.value != stage:
                continue
            
            if last_step.timestamp < cutoff:
                if record.current_stage in [
                    ProcessingStage.PENDING_REVIEW,
                    ProcessingStage.IN_REVIEW,
                    ProcessingStage.SCHEDULED,
                    ProcessingStage.UPLOADING
                ]:
                    age_hours = (datetime.now() - last_step.timestamp).total_seconds() / 3600
                    
                    missing.append({
                        "item_id": item_id,
                        "title": record.title,
                        "channel_id": record.channel_id,
                        "current_stage": record.current_stage.value,
                        "age_hours": round(age_hours, 2),
                        "last_update": last_step.timestamp.isoformat(),
                        "assigned_reviewer": record.assigned_reviewer
                    })
                    
                    await self._create_alert(
                        item_id=item_id,
                        channel_id=record.channel_id,
                        level=AlertLevel.WARNING if age_hours < 48 else AlertLevel.CRITICAL,
                        message=f"Item stuck at {record.current_stage.value} for {age_hours:.1f} hours",
                        stage=record.current_stage
                    )
        
        return missing
    
    async def _create_alert(
        self,
        item_id: str,
        channel_id: str,
        level: AlertLevel,
        message: str,
        stage: ProcessingStage
    ):
        alert_key = f"{item_id}_{level.value}"
        
        if alert_key in self._alerts:
            existing = self._alerts[alert_key]
            if not existing.resolved:
                return
        
        alert = VerificationAlert(
            alert_id=alert_key,
            item_id=item_id,
            channel_id=channel_id,
            level=level,
            message=message,
            stage=stage
        )
        
        self._alerts[alert_key] = alert
        
        logger.warning(f"🚨 Alert: {message}")
    
    async def resolve_alert(self, alert_id: str) -> bool:
        alert = self._alerts.get(alert_id)
        if not alert:
            return False
        
        alert.resolved = True
        alert.resolved_at = datetime.now()
        
        return True
    
    def get_active_alerts(
        self,
        level: AlertLevel = None,
        channel_id: str = None
    ) -> List[Dict]:
        alerts = self._alerts.values()
        
        if level:
            alerts = [a for a in alerts if a.level == level]
        
        if channel_id:
            alerts = [a for a in alerts if a.channel_id == channel_id]
        
        alerts = [a for a in alerts if not a.resolved]
        
        return [
            {
                "alert_id": a.alert_id,
                "item_id": a.item_id,
                "channel_id": a.channel_id,
                "level": a.level.value,
                "message": a.message,
                "stage": a.stage.value,
                "created_at": a.created_at.isoformat()
            }
            for a in alerts
        ]
    
    def get_team_workload(self, team: str = None) -> Dict:
        team_items = defaultdict(lambda: {"pending": 0, "in_review": 0, "approved": 0, "rejected": 0})
        
        for record in self._records.values():
            assignee = record.assigned_reviewer or "unassigned"
            
            if team and assignee != team:
                continue
            
            stage = record.current_stage
            if stage == ProcessingStage.PENDING_REVIEW:
                team_items[assignee]["pending"] += 1
            elif stage == ProcessingStage.IN_REVIEW:
                team_items[assignee]["in_review"] += 1
            elif stage == ProcessingStage.APPROVED:
                team_items[assignee]["approved"] += 1
            elif stage == ProcessingStage.REJECTED:
                team_items[assignee]["rejected"] += 1
        
        return dict(team_items)
    
    def get_sla_report(self, hours: int = 24) -> Dict:
        cutoff = datetime.now() - timedelta(hours=hours)
        
        total = 0
        breached = 0
        completed_on_time = 0
        
        for record in self._records.values():
            if not record.sla_deadline:
                continue
            
            if record.sla_deadline < cutoff:
                continue
            
            total += 1
            
            if record.sla_breached:
                breached += 1
            elif record.current_stage == ProcessingStage.COMPLETED:
                completed_on_time += 1
        
        return {
            "period_hours": hours,
            "total_tracked": total,
            "sla_breached": breached,
            "completed_on_time": completed_on_time,
            "compliance_rate": round((completed_on_time / total * 100), 2) if total > 0 else 100.0
        }
    
    def get_processing_summary(self, channel_id: str = None) -> Dict:
        records = self._records.values()
        
        if channel_id:
            records = [r for r in records if r.channel_id == channel_id]
        
        by_stage = defaultdict(int)
        
        for record in records:
            by_stage[record.current_stage.value] += 1
        
        return {
            "total_items": len(list(records)),
            "by_stage": dict(by_stage),
            "active_alerts": len([a for a in self._alerts.values() if not a.resolved]),
            "sla_compliance": self.get_sla_report()
        }


_processing_verification = None

def get_processing_verification() -> ProcessingVerificationService:
    global _processing_verification
    if _processing_verification is None:
        _processing_verification = ProcessingVerificationService()
    return _processing_verification