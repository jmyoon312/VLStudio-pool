"""
ViraLoop LangGraph State Management

[Phase 1 Week 3] State machine for mission workflow with checkpoint support

Note: This module requires langgraph to be installed:
    pip install langgraph langgraph-checkpoint-postgres

For now, provides a simplified state management that works without LangGraph,
with structure ready for LangGraph migration.
"""

import logging
import json
import os
from typing import TypedDict, Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


class Phase(str, Enum):
    """Mission Phases"""
    RESEARCH = "1"      # Phase 1: Market Research
    DIRECTOR = "2"      # Phase 2: DNA Direction
    WRITER = "3"        # Phase 3: Script Writing
    MEDIA = "4"         # Phase 4: Asset Generation
    VOICE = "5"         # Phase 5: Voice/TTS
    EDITOR = "6"        # Phase 6: Editing/Rendering
    AUDITOR = "7"       # Phase 7: Quality Verification
    PUBLISHER = "8"     # Phase 8: Publishing
    ANALYST = "9"       # Phase 9: Analytics
    EVOLUTION = "10"    # Phase 10: DNA Evolution


class MissionStatus(str, Enum):
    """Mission Status"""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"
    AWAITING_REVIEW = "AWAITING_REVIEW"
    PAUSED = "PAUSED"


class QualityDecision(str, Enum):
    """Quality Gate Decision"""
    PASS = "pass"           # Score >= 70, continue
    REVIEW = "review"       # 50 <= Score < 70, human review
    REVISE = "revise"       # Score < 50, rollback to Phase 3
    STOP = "stop"           # Max retries exceeded


class MissionState(TypedDict):
    """
    Mission State Schema for LangGraph
    
    This TypedDict represents the complete state of a mission throughout
    its lifecycle. Used for state machine management and checkpointing.
    """
    # Core identifiers
    mission_id: str
    channel_id: int
    topic: str
    niche: str
    
    # Phase tracking
    current_phase: int          # 1-10
    phase_status: str           # PENDING, RUNNING, COMPLETED, FAILED
    status: str                 # MissionStatus enum
    
    # Quality tracking
    quality_score: Optional[float]  # 0-100 from Phase 7
    quality_decision: Optional[str] # QualityDecision enum
    retry_count: int               # Current retry count
    max_retries: int               # Max allowed retries (default: 3)
    
    # Artifacts (Phase outputs)
    artifacts: Dict[str, Any]   # Phase outputs (research, script, assets, etc.)
    
    # Metadata
    config: Dict[str, Any]      # Mission configuration
    error_history: List[Dict]   # List of errors encountered
    logs: List[Dict]            # Execution logs
    started_at: Optional[str]   # ISO timestamp
    completed_at: Optional[str] # ISO timestamp
    updated_at: Optional[str]   # ISO timestamp
    
    # Feedback
    human_review_required: bool
    rollback_count: int


@dataclass
class MissionStateData:
    """
    Dataclass representation of MissionState for easier manipulation
    """
    mission_id: str
    channel_id: int
    topic: str
    niche: str = "general"
    
    current_phase: int = 1
    phase_status: str = "PENDING"
    status: str = "PENDING"
    
    quality_score: Optional[float] = None
    quality_decision: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    artifacts: Dict[str, Any] = field(default_factory=dict)
    config: Dict[str, Any] = field(default_factory=dict)
    error_history: List[Dict] = field(default_factory=list)
    logs: List[Dict] = field(default_factory=list)
    
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    human_review_required: bool = False
    rollback_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MissionStateData':
        """Create from dictionary"""
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})
    
    def add_log(self, level: str, message: str):
        """Add a log entry"""
        self.logs.append({
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message
        })
        self.updated_at = datetime.now().isoformat()
    
    def add_error(self, phase: int, error: str):
        """Add an error entry"""
        self.error_history.append({
            "phase": phase,
            "error": error,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now().isoformat()
    
    def can_proceed_to_next_phase(self) -> bool:
        """Check if can proceed to next phase"""
        if self.status in [MissionStatus.FAILED, MissionStatus.PAUSED]:
            return False
        if self.current_phase >= 10:  # Already at final phase
            return False
        return True
    
    def should_rollback(self) -> bool:
        """Check if should rollback based on quality"""
        if self.quality_decision == QualityDecision.REVISE:
            return True
        return False
    
    def should_stop(self) -> bool:
        """Check if should stop mission"""
        if self.retry_count >= self.max_retries:
            return True
        if self.status == MissionStatus.FAILED:
            return True
        return False


class MissionStateManager:
    """
    [Simplified] Mission State Manager
    
    Provides basic state management functionality.
    Can be upgraded to full LangGraph implementation later.
    
    Currently stores state in memory and optionally to database.
    For production, should use PostgreSQL checkpoint.
    """
    
    def __init__(self, db_session=None):
        self.db = db_session
        self._states: Dict[str, MissionStateData] = {}
    
    def create_mission(
        self,
        mission_id: str,
        channel_id: int,
        topic: str,
        niche: str = "general",
        config: Dict[str, Any] = None
    ) -> MissionStateData:
        """Create a new mission state"""
        
        state = MissionStateData(
            mission_id=mission_id,
            channel_id=channel_id,
            topic=topic,
            niche=niche,
            config=config or {},
            started_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        
        state.add_log("INFO", f"Mission created: {mission_id}")
        
        # Store in memory
        self._states[mission_id] = state
        
        # TODO: Save to database for persistence
        
        logger.info(f"📝 Mission state created: {mission_id}")
        return state
    
    def get_state(self, mission_id: str) -> Optional[MissionStateData]:
        """Get mission state"""
        return self._states.get(mission_id)
    
    def update_phase(self, mission_id: str, phase: int, phase_status: str = "COMPLETED") -> bool:
        """Update current phase"""
        state = self._states.get(mission_id)
        if not state:
            logger.warning(f"State not found: {mission_id}")
            return False
        
        old_phase = state.current_phase
        state.current_phase = phase
        state.phase_status = phase_status
        state.updated_at = datetime.now().isoformat()
        
        state.add_log("INFO", f"Phase changed: {old_phase} -> {phase} ({phase_status})")
        
        return True
    
    def set_quality_result(
        self,
        mission_id: str,
        score: float,
        decision: str
    ) -> bool:
        """Set quality verification result"""
        state = self._states.get(mission_id)
        if not state:
            return False
        
        state.quality_score = score
        state.quality_decision = decision
        state.updated_at = datetime.now().isoformat()
        
        state.add_log("INFO", f"Quality result: score={score}, decision={decision}")
        
        # Handle retry count
        if decision == QualityDecision.REVISE:
            state.retry_count += 1
            state.rollback_count += 1
            state.status = MissionStatus.ROLLED_BACK.value
        
        return True
    
    def rollback_to_phase(self, mission_id: str, target_phase: int = 3) -> bool:
        """Rollback to target phase"""
        state = self._states.get(mission_id)
        if not state:
            return False
        
        old_phase = state.current_phase
        state.current_phase = target_phase
        state.phase_status = "RUNNING"
        state.status = MissionStatus.ROLLED_BACK.value
        state.updated_at = datetime.now().isoformat()
        
        state.add_log("WARNING", f"Rolling back: Phase {old_phase} -> Phase {target_phase}")
        
        return True
    
    def complete_mission(self, mission_id: str) -> bool:
        """Mark mission as completed"""
        state = self._states.get(mission_id)
        if not state:
            return False
        
        state.status = MissionStatus.COMPLETED.value
        state.completed_at = datetime.now().isoformat()
        state.updated_at = datetime.now().isoformat()
        
        state.add_log("INFO", f"Mission completed: {mission_id}")
        
        return True
    
    def fail_mission(self, mission_id: str, error: str) -> bool:
        """Mark mission as failed"""
        state = self._states.get(mission_id)
        if not state:
            return False
        
        state.status = MissionStatus.FAILED.value
        state.completed_at = datetime.now().isoformat()
        state.updated_at = datetime.now().isoformat()
        
        state.add_error(state.current_phase, error)
        state.add_log("ERROR", f"Mission failed: {error}")
        
        return True
    
    def get_all_states(self) -> List[MissionStateData]:
        """Get all mission states"""
        return list(self._states.values())
    
    def get_active_missions(self) -> List[MissionStateData]:
        """Get all active (non-completed) missions"""
        return [
            s for s in self._states.values()
            if s.status not in [MissionStatus.COMPLETED.value, MissionStatus.FAILED.value]
        ]


# Singleton instance
_state_manager = None

def get_state_manager() -> MissionStateManager:
    """Get or create state manager singleton"""
    global _state_manager
    if _state_manager is None:
        _state_manager = MissionStateManager()
    return _state_manager


# LangGraph integration (for future upgrade)
def create_langgraph_workflow():
    """
    Create LangGraph workflow (when langgraph is installed)
    
    This is a placeholder for when LangGraph is installed.
    Currently returns None to indicate LangGraph is not available.
    """
    try:
        from langgraph.graph import StateGraph, END
        from langgraph.checkpoint.postgres import PostgresSaver
        
        class MissionStateGraph(StateGraph):
            pass
        
        # This would be the full LangGraph implementation
        # Currently not active due to langgraph not being installed
        
        logger.info("LangGraph is available - workflow can be created")
        return None  # Placeholder
        
    except ImportError:
        logger.warning("LangGraph not installed. Using simplified state manager.")
        return None


# For backward compatibility
QualityAuditResult = MissionStateData