from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import Integer, cast
from typing import Optional, List, Dict
import logging
import json

from ..database import get_db
from ..swarm_coordinator import SwarmCoordinator
from ..config import settings
from ..services.intelligence.governance_manager import governance_manager
from ..services.workflow_runner import WorkflowRunner
from app.global_swarm_master import global_master
from app.state_management.video_graph import app_graph
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(tags=["swarm"])

# Singleton-like access to Coordinator (could be moved to dependency)
coordinator = SwarmCoordinator(settings)

class SwarmModeRequest(BaseModel):
    mode: str  # AUTONOMOUS, CONFIRMATION, EXPERT
    channel_id: Optional[int] = None

@router.get("/status")
def get_swarm_status(db: Session = Depends(get_db)):
    """
    Returns the current status of the OpenClaw Swarm, optimized with joinedload for scaling.
    """
    from ..models import CaptainAccount, BrandChannel, WorkQueueItem, AgentSwarmSession, AgentLog, GlobalSwarmConfig
    from sqlalchemy.orm import joinedload
    from sqlalchemy import desc
    
    # 1. 캡틴과 채널 정보를 단일 조인 쿼리로 인출 (성능 극대화)
    captains = db.query(CaptainAccount).options(joinedload(CaptainAccount.channels)).all()
    
    # 2. 모든 승인 대기 미션을 한 번에 가져와 메모리에서 매핑
    pending_missions = db.query(WorkQueueItem).filter(WorkQueueItem.approval_status == 'PENDING').all()

    # 2.5 [NEW] 글로벌 스웜 설정 가져오기
    swarm_config = db.query(GlobalSwarmConfig).first()
    if not swarm_config:
        swarm_config = GlobalSwarmConfig(swarm_mode="CONFIRMATION")
        db.add(swarm_config)
        db.commit()
        db.refresh(swarm_config)

    # 3. [NEW] 활성 에이전트 세션 및 로그 가져오기
    active_sessions = db.query(AgentSwarmSession).filter(
        AgentSwarmSession.status.notin_(['COMPLETED', 'FAILED'])
    ).order_by(desc(AgentSwarmSession.created_at)).limit(10).all()
    
    session_data = []
    for s in active_sessions:
        # 각 세션의 최신 로그 5개 가져오기
        recent_logs = db.query(AgentLog).filter(
            AgentLog.session_id == s.id
        ).order_by(desc(AgentLog.timestamp)).limit(5).all()
        
        session_data.append({
            "id": s.id,
            "topic": s.topic,
            "status": s.status,
            "created_at": s.created_at,
            "config": s.config_json,
            "logs": [{"level": l.level, "message": l.message, "timestamp": l.timestamp} for l in reversed(recent_logs)]
        })
    
    group_stats = []
    total_active = 0
    total_pending = len(pending_missions)
    
    for cap in captains:
        channels = cap.channels
        active_in_group = len([c for c in channels if c.is_active])
        total_active += active_in_group
        
        # 캡틴 소속 채널들의 미션 카운팅 (메모리 필터링)
        channel_ids = {c.id for c in channels}
        pending_in_group = 0
        for m in pending_missions:
            try:
                m_cid = int(m.source_metadata.get('channel_id')) if m.source_metadata else None
                if m_cid in channel_ids:
                    pending_in_group += 1
            except: continue
        
        group_stats.append({
            "captainId": cap.id,
            "captainEmail": cap.email,
            "safetyScore": cap.safety_score,
            "riskLevel": cap.risk_level,
            "activeChannels": active_in_group,
            "pendingApprovals": pending_in_group,
            "channels": [
                {
                    "id": c.id,
                    "title": c.title,
                    "isAutonomous": c.is_autonomous_enabled,
                    "subscriberCount": c.subscriber_count,
                    "hasDNA": c.style_signature is not None and len(str(c.style_signature)) > 2,
                    "growthPhase": c.growth_phase,
                    "trustScore": c.trust_score,
                    "autonomyStatus": c.autonomy_status
                } for c in channels
            ]
        })

    return {
        "mode": swarm_config.swarm_mode,
        "globalStats": {
            "activeChannels": total_active,
            "pendingApprovals": total_pending,
            "productionRate": 94
        },
        "groups": group_stats,
        "activeSessions": session_data # [NEW]
    }

@router.post("/mode")
def set_swarm_mode(request: SwarmModeRequest, db: Session = Depends(get_db)):
    """
    Updates the operational mode of the swarm (Global or Per-Channel).
    """
    from ..models import GlobalSwarmConfig, BrandChannel
    
    if request.channel_id:
        # Per-channel mode control
        channel = db.query(BrandChannel).filter(BrandChannel.id == request.channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        channel.autonomy_status = request.mode
        logger.info(f"Channel {request.channel_id} mode updated to: {request.mode}")
    else:
        # Global swarm mode control
        swarm_config = db.query(GlobalSwarmConfig).first()
        if not swarm_config:
            swarm_config = GlobalSwarmConfig(swarm_mode=request.mode)
            db.add(swarm_config)
        else:
            swarm_config.swarm_mode = request.mode
        
        logger.info(f"Global Swarm Mode updated to: {request.mode}")
    
    db.commit()
    return {"message": f"Mode set to {request.mode} successfully", "mode": request.mode}

class PhaseUpdateRequest(BaseModel):
    channel_id: int
    phase: str

@router.post("/phase")
def update_channel_phase(request: PhaseUpdateRequest, db: Session = Depends(get_db)):
    """Updates the growth phase and trust metrics for a channel."""
    from ..models import BrandChannel
    channel = db.query(BrandChannel).filter(BrandChannel.id == request.channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    channel.growth_phase = request.phase
    # Logic: As phase evolves, trust score potentially increases
    if request.phase == "SCALED":
        channel.trust_score = 90
        channel.autonomy_status = "SOVEREIGN"
    elif request.phase == "REFINING":
        channel.trust_score = 60
        channel.autonomy_status = "SEMI_AUTO"
        
    db.commit()
    return {"status": "updated", "channel_id": request.channel_id, "phase": request.phase}

@router.post("/missions/factory-run")
async def trigger_factory_run(
    channel_id: int,
    format: str = "shorts",
    quality_mode: str = "auto"
):
    """
    Manually triggers a full autonomous production run for a specific channel.
    
    - **channel_id**: Target brand channel ID
    - **format**: 'shorts' (Vertical 60s) or 'longform' (5–10 min)
    - **quality_mode**: 'quality' (Higgsfield AI video), 'speed' (static image), 'auto' (AI decides)
    """
    success = await coordinator.execute_mission_factory_run(
        channel_id=channel_id,
        format=format,
        quality_mode=quality_mode
    )
    if not success:
        raise HTTPException(500, "Mission execution failed")
    return {
        "message": "Autonomous production mission started",
        "channel_id": channel_id,
        "format": format,
        "quality_mode": quality_mode
    }

@router.post("/missions/premium-sop")
async def trigger_premium_sop_run(
    channel_id: int,
    niche: Optional[str] = None,
    ref_data: Optional[str] = None
):
    """
    Triggers the V2 High-Quality SOP Pipeline.
    1. Reference Analysis -> 2. Premium 3-Stage Scripting -> 3. Asset Processing
    """
    from ..llm_manager import LLMClient
    from ..services.sop_orchestrator import SOPOrchestrator
    
    orchestrator = SOPOrchestrator(settings, LLMClient(settings))
    
    # If niche is not provided, try to fetch it from the channel's metadata
    # (Implemented in orchestrator or handled here)
    
    result = await orchestrator.run_premium_mission(
        channel_id=channel_id,
        niche=niche or f"Channel_{channel_id}_Trend",
        ref_data=ref_data or ""
    )
    
    return {
        "message": "Premium SOP Mission executed successfully",
        "result": result
    }

# --- [NEW] LangGraph Pluggable Brain Endpoints ---

class LangGraphRunRequest(BaseModel):
    project_id: str
    channel_dna: dict

@router.post("/missions/langgraph-run")
async def trigger_langgraph_run(request: LangGraphRunRequest):
    """
    Triggers the new LangGraph-based video production pipeline.
    This replaces the old openclaw factory-run.
    """
    logger.info(f"🧠 [LangGraph] Starting pipeline for project: {request.project_id}")
    
    # Initial state configuration for LangGraph
    initial_state = {
        "project_id": request.project_id,
        "channel_dna": request.channel_dna,
        "production_type": "",
        "script_content": "",
        "scenes": [],
        "hitl_status": "IDLE",
        "current_phase": "STARTED",
        "errors": []
    }
    
    config = {"configurable": {"thread_id": request.project_id}}
    
    # Run the graph until it finishes or hits an interrupt (HITL)
    result = app_graph.invoke(initial_state, config)
    
    # Check if the graph was suspended due to HITL
    state_snapshot = app_graph.get_state(config)
    next_node = state_snapshot.next
    
    if next_node:
        return {
            "status": "SUSPENDED",
            "message": "Workflow suspended waiting for Human-in-the-Loop approval.",
            "current_state": result,
            "next_node": next_node
        }
    
    return {
        "status": "COMPLETED",
        "message": "Workflow completed successfully.",
        "result": result
    }

class LangGraphResumeRequest(BaseModel):
    project_id: str
    action: str # e.g. 'APPROVE', 'REJECT'
    modified_script: Optional[str] = None

@router.post("/missions/resume")
async def resume_langgraph_run(request: LangGraphResumeRequest, background_tasks: __import__('fastapi').BackgroundTasks):
    """
    Resumes a LangGraph workflow that was halted at a HITL gateway.
    """
    logger.info(f"▶️ [LangGraph] Resuming pipeline for project: {request.project_id} with action: {request.action}")
    
    config = {"configurable": {"thread_id": request.project_id}}
    
    # We update the state based on the human action
    update_data = {"hitl_status": "APPROVED" if request.action == "APPROVE" else "REJECTED"}
    if request.modified_script:
        update_data["script_content"] = request.modified_script

    app_graph.update_state(config, update_data)
    
    # Resume the graph in the background so we don't block the UI
    background_tasks.add_task(app_graph.invoke, None, config)
    
    return {
        "status": "RESUMED",
        "message": "Workflow resumed in the background."
    }

# --- PHASE 5: SOVEREIGN CONTROL & TELEMETRY ---

@router.get("/missions/{session_id}/artifacts")
def list_session_artifacts(session_id: str, db: Session = Depends(get_db)):
    """
    Returns the versioned artifact history for a specific mission session.
    """
    from ..models import SwarmArtifact
    artifacts = db.query(SwarmArtifact).filter(
        SwarmArtifact.session_id == session_id
    ).order_by(SwarmArtifact.node_id, SwarmArtifact.version).all()
    
    return [
        {
            "id": a.id,
            "node_id": a.node_id,
            "stage": a.stage_label,
            "version": a.version,
            "created_at": a.created_at,
            "is_active": a.is_active,
            "checksum": a.checksum
        } for a in artifacts
    ]

@router.post("/missions/{session_id}/rollback")
async def rollback_mission(session_id: str, artifact_id: int, db: Session = Depends(get_db)):
    """
    Triggers a rollback to a specific artifact version.
    """
    runner = WorkflowRunner(settings)
    try:
        await runner.rollback_to_stage(db, session_id, artifact_id)
        return {"status": "success", "message": f"Mission {session_id} rolled back to artifact {artifact_id}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/missions/{session_id}/telemetry")
def get_mission_telemetry(session_id: str, db: Session = Depends(get_db)):
    """
    Returns real-time cost and token usage analytics for the session.
    """
    return governance_manager.get_session_telemetry(db, session_id)

@router.post("/reconcile")
async def trigger_swarm_reconcile():
    """
    Manually triggers the GlobalSwarmMaster to reconcile all channels.
    Used by n8n daily scheduler to wake up Channel Directors.
    """
    try:
        logger.info("⏰ [Swarm] Received manual trigger for Swarm Reconcile (Channel Director Wakeup)")
        # Run it as a background task to not block the request
        asyncio.create_task(global_master.reconcile_all_channels())
        return {"status": "success", "message": "Global swarm reconciliation triggered successfully."}
    except Exception as e:
        logger.error(f"❌ [Swarm] Reconcile trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === Hermes / Loopie Async Agent Endpoints ===

class SwarmDispatchRequest(BaseModel):
    mission_type: str
    context: str

from ..services.openclaw.manager import swarm_manager

@router.websocket("/ws")
async def swarm_websocket_endpoint(websocket: WebSocket):
    await swarm_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if "text" in payload:
                    command_text = payload["text"]
                    logger.info(f"📥 [Swarm WS] Received command: {command_text}")
                    
                    # [SOVEREIGN] Trigger actual dispatch logic if it's a command
                    # We can use the existing dispatch_swarm_mission logic
                    from ..services.openclaw.orchestrator import orchestrator
                    session_id = await orchestrator.spawn_agent(
                        topic=command_text,
                        config={"mission_type": "autonomous_instruction"}
                    )
                    
                    # Echo back confirmation to the sender
                    await websocket.send_text(json.dumps({
                        "type": "system",
                        "message": f"명령을 접수했습니다. 세션 ID: {session_id}. 자율 에이전트가 배정되었습니다.",
                        "session_id": session_id
                    }))
            except json.JSONDecodeError:
                logger.warning(f"⚠️ [Swarm WS] Received non-JSON data: {data}")
            except Exception as e:
                logger.error(f"❌ [Swarm WS] Error processing message: {e}")
                
    except WebSocketDisconnect:
        swarm_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Swarm WebSocket Error: {e}")
        swarm_manager.disconnect(websocket)

class SwarmBroadcastRequest(BaseModel):
    message: str
    type: str = "task_progress"
    session_id: Optional[str] = None
    action: Optional[dict] = None

@router.post("/broadcast")
async def broadcast_swarm_message(request: SwarmBroadcastRequest):
    """
    Internal endpoint for workers to broadcast progress to WebSockets.
    """
    await swarm_manager.broadcast({
        "type": request.type,
        "message": request.message,
        "session_id": request.session_id,
        "action": request.action
    })
    return {"status": "broadcasted"}

@router.post("/dispatch")
async def dispatch_swarm_mission(request: SwarmDispatchRequest):
    try:
        from ..services.openclaw.orchestrator import orchestrator
        
        logger.info(f"🚀 [Swarm] Dispatching mission: {request.mission_type} with context: {request.context[:50]}...")
        
        # [SOVEREIGN UPGRADE] Dispatch real mission via Orchestrator (RabbitMQ)
        session_id = await orchestrator.spawn_agent(
            topic=request.context or request.mission_type,
            config={"mission_type": request.mission_type}
        )
        
        return {"status": "dispatched", "session_id": session_id}
    except Exception as e:
        logger.error(f"❌ [Swarm] Dispatch failed: {e}")
        return {"status": "error", "message": str(e)}
