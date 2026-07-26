"""
Automation endpoints for resource manager
Append this to resource_manager.py or import as needed
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile
from app.services.automation.orchestrator import AutomationOrchestrator, AutomationConfig
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

async def execute_profile_automation(
    profile_id: int,
    brand_name: str = None,
    admin_email: str = None,
    auto_create_channel: bool = False,
    auto_delegate_admin: bool = False,
    db: Session = Depends(get_db)
):
    """
    Execute automation workflow for a profile
    
    POST /resources/profiles/{profile_id}/automation/execute
    
    Body:
        brand_name: str (optional) - Brand channel name
        admin_email: str (optional) - Admin email for delegation
        auto_create_channel: bool - Enable channel creation
        auto_delegate_admin: bool - Enable admin delegation
    """
    
    # Verify profile exists
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Validate inputs
    if auto_create_channel and not brand_name:
        raise HTTPException(
            status_code=400, 
            detail="Brand name required for channel creation"
        )
    
    if auto_delegate_admin and not admin_email:
        raise HTTPException(
            status_code=400, 
            detail="Admin email required for delegation"
        )
    
    # Create config
    config = AutomationConfig(
        auto_create_channel=auto_create_channel,
        auto_delegate_admin=auto_delegate_admin,
        brand_name=brand_name,
        admin_email=admin_email
    )
    
    # Execute automation with db-aware orchestrator
    try:
        orchestrator = AutomationOrchestrator(db)
        results = await orchestrator.execute(
            profile_id=str(profile_id),
            config=config
        )
        
        # Update profile channel_id if channel was created
        for step in results.get("steps", []):
            if step.get("step") == "create_channel" and step.get("success"):
                channel_url = step.get("channel_url", "")
                if "youtube.com/channel/" in channel_url:
                    channel_id = channel_url.split("/channel/")[-1].split("?")[0]
                    profile.channel_id = channel_id
                    db.commit()
                    logger.info(f"Updated profile {profile_id} with channel_id: {channel_id}")
        
        return results
        
    except Exception as e:
        logger.error(f"Automation execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# To add to resource_manager.py:
# @router.post("/profiles/{profile_id}/automation/execute")
# async def execute_automation(
#     profile_id: int,
#     brand_name: str = None,
#     admin_email: str = None,
#     auto_create_channel: bool = False,
#     auto_delegate_admin: bool = False,
#     db: Session = Depends(get_db)
# ):
#     return await execute_profile_automation(
#         profile_id, brand_name, admin_email, 
#         auto_create_channel, auto_delegate_admin, db
#     )

@router.post("/profiles/{profile_id}/execute")
async def execute_automation(
    profile_id: int,
    brand_name: str = None,
    admin_email: str = None,
    auto_create_channel: bool = False,
    auto_delegate_admin: bool = False,
    db: Session = Depends(get_db)
):
    """
    Standalone endpoint for direct automation execution
    """
    return await execute_profile_automation(
        profile_id=profile_id,
        brand_name=brand_name,
        admin_email=admin_email,
        auto_create_channel=auto_create_channel,
        auto_delegate_admin=auto_delegate_admin,
        db=db
    )

async def execute_profile_automation(
    profile_id: int,
    brand_name: str = None,
    admin_email: str = None,
    auto_create_channel: bool = False,
    auto_delegate_admin: bool = False,
    db: Session = Depends(get_db)
):
    """
    Execute automation workflow for a profile
    
    POST /resources/profiles/{profile_id}/automation/execute
    
    Body:
        brand_name: str (optional) - Brand channel name
        admin_email: str (optional) - Admin email for delegation
        auto_create_channel: bool - Enable channel creation
        auto_delegate_admin: bool - Enable admin delegation
    """
    
    # Verify profile exists
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Validate inputs
    if auto_create_channel and not brand_name:
        raise HTTPException(
            status_code=400, 
            detail="Brand name required for channel creation"
        )
    
    if auto_delegate_admin and not admin_email:
        raise HTTPException(
            status_code=400, 
            detail="Admin email required for delegation"
        )
    
    # Create config
    config = AutomationConfig(
        auto_create_channel=auto_create_channel,
        auto_delegate_admin=auto_delegate_admin,
        brand_name=brand_name,
        admin_email=admin_email
    )
    
    # Execute automation with db-aware orchestrator
    try:
        orchestrator = AutomationOrchestrator(db)
        results = await orchestrator.execute(
            profile_id=str(profile_id),
            config=config
        )
        
        # Update profile channel_id if channel was created
        for step in results.get("steps", []):
            if step.get("step") == "create_channel" and step.get("success"):
                channel_url = step.get("channel_url", "")
                if "youtube.com/channel/" in channel_url:
                    channel_id = channel_url.split("/channel/")[-1].split("?")[0]
                    profile.channel_id = channel_id
                    db.commit()
                    logger.info(f"Updated profile {profile_id} with channel_id: {channel_id}")
        
        return results
        
    except Exception as e:
        logger.error(f"Automation execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# To add to resource_manager.py:
# @router.post("/profiles/{profile_id}/automation/execute")
# async def execute_automation(
#     profile_id: int,
#     brand_name: str = None,
#     admin_email: str = None,
#     auto_create_channel: bool = False,
#     auto_delegate_admin: bool = False,
#     db: Session = Depends(get_db)
# ):
#     return await execute_profile_automation(
#         profile_id, brand_name, admin_email, 
#         auto_create_channel, auto_delegate_admin, db
#     )
