"""
Processing Verification API Router

Endpoints:
- POST /api/verification/register - Register item
- PUT /api/verification/{item_id}/stage - Update stage
- GET /api/verification/{item_id}/status - Get status
- GET /api/verification/{item_id}/verify - Verify workflow
- GET /api/verification/missing - Get missing items
- GET /api/verification/alerts - Get active alerts
- GET /api/verification/team-workload - Get team workload
- GET /api/verification/sla-report - Get SLA report
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/verification", tags=["verification"])

class RegisterItemRequest(BaseModel):
    item_id: str
    video_id: str
    channel_id: str
    title: str
    source: str = "auto"
    assigned_reviewer: Optional[str] = None

class UpdateStageRequest(BaseModel):
    stage: str
    actor: str = "system"
    notes: str = ""

def get_verification_service():
    from app.services.processing_verification import get_processing_verification
    return get_processing_verification()

@router.post("/register")
async def register_item(request: RegisterItemRequest):
    """Register item for processing verification"""
    verifier = get_verification_service()
    
    item_id = await verifier.register_item(
        item_id=request.item_id,
        video_id=request.video_id,
        channel_id=request.channel_id,
        title=request.title,
        source=request.source,
        assigned_reviewer=request.assigned_reviewer
    )
    
    return {"item_id": item_id, "status": "registered"}

@router.put("/{item_id}/stage")
async def update_stage(item_id: str, request: UpdateStageRequest):
    """Update processing stage"""
    verifier = get_verification_service()
    
    result = await verifier.update_stage(
        item_id=item_id,
        new_stage=request.stage,
        actor=request.actor,
        notes=request.notes
    )
    
    if not result:
        raise HTTPException(status_code=404, message="Item not found")
    
    return {"status": "updated"}

@router.get("/{item_id}/status")
async def get_status(item_id: str):
    """Get processing status"""
    verifier = get_verification_service()
    
    status = await verifier.check_processing_status(item_id)
    
    if not status:
        raise HTTPException(status_code=404, message="Item not found")
    
    return status

@router.get("/{item_id}/verify")
async def verify_workflow(item_id: str):
    """Verify workflow correctness"""
    verifier = get_verification_service()
    
    result = await verifier.verify_workflow(item_id)
    
    return result

@router.get("/missing")
async def get_missing_items(hours: int = Query(24, ge=1, le=168)):
    """Get items stuck in processing"""
    verifier = get_verification_service()
    
    missing = await verifier.get_missing_items(hours=hours)
    
    return {"data": missing, "count": len(missing)}

@router.get("/alerts")
async def get_alerts(
    level: Optional[str] = None,
    channel_id: Optional[str] = None
):
    """Get active alerts"""
    from app.services.processing_verification import AlertLevel
    
    verifier = get_verification_service()
    alert_level = AlertLevel(level) if level else None
    
    alerts = verifier.get_active_alerts(severity=alert_level)
    
    return {"data": alerts, "count": len(alerts)}

@router.get("/team-workload")
async def get_team_workload(team: Optional[str] = None):
    """Get team workload"""
    verifier = get_verification_service()
    
    workload = verifier.get_team_workload(team)
    
    return {"data": workload}

@router.get("/sla-report")
async def get_sla_report(hours: int = Query(24, ge=1, le=720)):
    """Get SLA compliance report"""
    verifier = get_verification_service()
    
    report = verifier.get_sla_report(hours=hours)
    
    return report

@router.get("/summary")
async def get_processing_summary(channel_id: Optional[str] = None):
    """Get processing summary"""
    verifier = get_verification_service()
    
    summary = verifier.get_processing_summary(channel_id)
    
    return summary

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert"""
    verifier = get_verification_service()
    
    result = await verifier.resolve_alert(alert_id)
    
    return {"status": "resolved" if result else "not_found"}