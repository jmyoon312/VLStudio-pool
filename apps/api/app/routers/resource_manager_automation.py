from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile
from app.services.automation.orchestrator import AutomationOrchestrator, AutomationConfig

router = APIRouter()
@router.post("/profiles/{profile_id}/automation/execute")
async def execute_automation(
    profile_id: int,
    brand_name: str = None,
    admin_email: str = None,
    auto_create_channel: bool = False,
    auto_delegate_admin: bool = False,
    db: Session = Depends(get_db)
):
    """Execute automation workflow for a profile"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    if auto_create_channel and not brand_name:
        raise HTTPException(400, "Brand name required")
    
    if auto_delegate_admin and not admin_email:
        raise HTTPException(400, "Admin email required")
    
    config = AutomationConfig(
        auto_create_channel=auto_create_channel,
        auto_delegate_admin=auto_delegate_admin,
        brand_name=brand_name,
        admin_email=admin_email
    )
    
    # Create orchestrator instance
    orchestrator = AutomationOrchestrator(db)
    results = await orchestrator.execute(str(profile_id), config)
    
    # Update channel_id if created
    for step in results.get("steps", []):
        if step.get("step") == "create_channel" and step.get("success"):
            channel_url = step.get("channel_url", "")
            if "youtube.com/channel/" in channel_url:
                channel_id = channel_url.split("/channel/")[-1].split("?")[0]
                profile.channel_id = channel_id
                db.commit()
    
    return results
