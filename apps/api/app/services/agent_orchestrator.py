"""
Agent Orchestrator - Multi-Agent Coordination System

Manages:
1. Agent lifecycle (start, stop, restart)
2. Task distribution across agents
3. Agent communication and messaging
4. Load balancing
5. Failover handling

Usage:
    orchestrator = AgentOrchestrator()
    
    # Register agents
    orchestrator.register_agent("channel_1", AgentType.CHANNEL_DIRECTOR)
    orchestrator.register_agent("researcher_1", AgentType.RESEARCHER)
    
    # Assign task
    task_id = await orchestrator.assign_task(
        task={"type": "produce_video", "channel": 123},
        agent_type=AgentType.CHANNEL_DIRECTOR
    )
    
    # Get task status
    status = await orchestrator.get_task_status(task_id)
"""

import os
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


class AgentType(Enum):
    """Agent types"""
    COORDINATOR = "coordinator"
    CHANNEL_DIRECTOR = "channel_director"
    RESEARCHER = "researcher"
    WRITER = "writer"
    MEDIA_PRODUCER = "media_producer"
    EDITOR = "editor"
    PUBLISHER = "publisher"
    ANALYST = "analyst"
    PORTFOLIO_STRATEGIST = "portfolio_strategist"


class AgentStatus(Enum):
    """Agent status"""
    IDLE = "idle"
    BUSY = "busy"
    PAUSED = "paused"
    ERROR = "error"
    OFFLINE = "offline"


class TaskStatus(Enum):
    """Task status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Agent:
    """Agent definition"""
    agent_id: str
    agent_type: AgentType
    name: str
    status: AgentStatus = AgentStatus.IDLE
    current_task_id: Optional[str] = None
    capabilities: List[str] = field(default_factory=list)
    max_concurrent_tasks: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    registered_at: datetime = field(default_factory=datetime.now)
    last_heartbeat: datetime = field(default_factory=datetime.now)


@dataclass
class Task:
    """Task definition"""
    task_id: str
    task_type: str
    payload: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    assigned_agent_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    priority: int = 5  # 1-10, higher = more urgent


class AgentOrchestrator:
    """
    Agent Orchestrator for multi-agent coordination
    
    Features:
    - Agent registration and lifecycle management
    - Task distribution with load balancing
    - Agent communication (pub/sub)
    - Failover and retry logic
    - Resource allocation
    """
    
    def __init__(self):
        self._agents: Dict[str, Agent] = {}
        self._tasks: Dict[str, Task] = {}
        self._agent_queues: Dict[AgentType, List[str]] = defaultdict(list)
        self._task_handlers: Dict[str, Callable] = {}
        self._message_bus: Dict[str, List[Dict]] = defaultdict(list)
        
        # Configuration
        self._max_retries = 3
        self._heartbeat_timeout = 300  # 5 minutes
        self._task_timeout = 3600  # 1 hour
        
        # Stats
        self._stats = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "active_agents": 0
        }
        
        logger.info("AgentOrchestrator initialized")
    
    def register_agent(
        self,
        agent_id: str,
        agent_type: AgentType,
        name: str = None,
        capabilities: List[str] = None,
        max_concurrent: int = 1
    ) -> bool:
        """
        Register an agent
        
        Args:
            agent_id: Unique agent ID
            agent_type: Type of agent
            name: Display name
            capabilities: List of capabilities
            max_concurrent: Max concurrent tasks
            
        Returns:
            Success status
        """
        try:
            agent = Agent(
                agent_id=agent_id,
                agent_type=agent_type,
                name=name or f"{agent_type.value}_{agent_id}",
                capabilities=capabilities or [],
                max_concurrent_tasks=max_concurrent
            )
            
            self._agents[agent_id] = agent
            self._agent_queues[agent_type].append(agent_id)
            
            logger.info(f"✅ Agent registered: {agent_id} ({agent_type.value})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register agent: {e}")
            return False
    
    def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent"""
        if agent_id in self._agents:
            agent = self._agents[agent_id]
            agent.status = AgentStatus.OFFLINE
            
            # Remove from queue
            if agent.agent_type in self._agent_queues:
                self._agent_queues[agent.agent_type] = [
                    a for a in self._agent_queues[agent.agent_type]
                    if a != agent_id
                ]
            
            logger.info(f"🗑️ Agent unregistered: {agent_id}")
            return True
        return False
    
    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID"""
        return self._agents.get(agent_id)
    
    def get_agents_by_type(self, agent_type: AgentType) -> List[Agent]:
        """Get all agents of a type"""
        return [
            a for a in self._agents.values()
            if a.agent_type == agent_type and a.status != AgentStatus.OFFLINE
        ]
    
    def get_available_agents(self, agent_type: AgentType) -> List[Agent]:
        """Get available agents of a type (not busy)"""
        return [
            a for a in self.get_agents_by_type(agent_type)
            if a.status == AgentStatus.IDLE
        ]
    
    async def assign_task(
        self,
        task_type: str,
        payload: Dict[str, Any],
        agent_type: AgentType,
        priority: int = 5,
        target_agent_id: str = None
    ) -> Optional[str]:
        """
        Assign task to agent
        
        Args:
            task_type: Type of task
            payload: Task data
            agent_type: Required agent type
            priority: Task priority (1-10)
            target_agent_id: Specific agent ID (optional)
            
        Returns:
            Task ID or None
        """
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        
        task = Task(
            task_id=task_id,
            task_type=task_type,
            payload=payload,
            priority=priority
        )
        
        self._tasks[task_id] = task
        self._stats["total_tasks"] += 1
        
        # Find agent
        if target_agent_id:
            agent = self._agents.get(target_agent_id)
            if not agent or agent.agent_type != agent_type:
                logger.error(f"Invalid target agent: {target_agent_id}")
                return None
        else:
            # Find available agent with load balancing
            agents = self.get_available_agents(agent_type)
            
            if not agents:
                # Add to queue
                logger.warning(f"No available agents for {agent_type.value}, queuing task")
                self._agent_queues[agent_type].append(task_id)
                return task_id
            
            # Select agent with least load
            agent = min(agents, key=lambda a: a.current_task_id is None)
        
        # Assign task
        task.assigned_agent_id = agent.agent_id
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        
        agent.status = AgentStatus.BUSY
        agent.current_task_id = task_id
        
        # Execute task
        asyncio.create_task(self._execute_task(task_id))
        
        logger.info(f"📤 Task {task_id} assigned to {agent.agent_id}")
        return task_id
    
    async def _execute_task(self, task_id: str):
        """Execute a task"""
        task = self._tasks.get(task_id)
        if not task:
            return
        
        try:
            # Get handler
            handler = self._task_handlers.get(task.task_type)
            
            if handler:
                result = await handler(task.payload)
                task.result = result
                task.status = TaskStatus.COMPLETED
                self._stats["completed_tasks"] += 1
            else:
                # No handler, just mark as completed
                task.status = TaskStatus.COMPLETED
                task.result = {"status": "no_handler"}
                self._stats["completed_tasks"] += 1
            
            logger.info(f"✅ Task {task_id} completed")
            
        except Exception as e:
            logger.error(f"❌ Task {task_id} failed: {e}")
            task.error = str(e)
            task.status = TaskStatus.FAILED
            self._stats["failed_tasks"] += 1
            
            # Retry if possible
            if task.retry_count < self._max_retries:
                task.retry_count += 1
                task.status = TaskStatus.PENDING
                asyncio.create_task(self._retry_task(task_id))
        
        finally:
            # Free agent
            if task.assigned_agent_id:
                agent = self._agents.get(task.assigned_agent_id)
                if agent:
                    agent.status = AgentStatus.IDLE
                    agent.current_task_id = None
            
            task.completed_at = datetime.now()
    
    async def _retry_task(self, task_id: str):
        """Retry a failed task"""
        await asyncio.sleep(2 ** self._tasks[task_id].retry_count)
        
        task = self._tasks[task_id]
        
        # Reassign to available agent
        agents = self.get_available_agents(
            self._agents[task.assigned_agent_id].agent_type
        )
        
        if agents:
            agent = agents[0]
            task.assigned_agent_id = agent.agent_id
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now()
            agent.status = AgentStatus.BUSY
            agent.current_task_id = task_id
            
            asyncio.create_task(self._execute_task(task_id))
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register task handler"""
        self._task_handlers[task_type] = handler
        logger.info(f"✅ Handler registered: {task_type}")
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task status"""
        task = self._tasks.get(task_id)
        
        if not task:
            return None
        
        return {
            "task_id": task.task_id,
            "type": task.task_type,
            "status": task.status.value,
            "assigned_agent": task.assigned_agent_id,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "result": task.result,
            "error": task.error,
            "retry_count": task.retry_count
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a task"""
        task = self._tasks.get(task_id)
        
        if not task or task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            return False
        
        task.status = TaskStatus.CANCELLED
        
        # Free agent if running
        if task.assigned_agent_id:
            agent = self._agents.get(task.assigned_agent_id)
            if agent:
                agent.status = AgentStatus.IDLE
                agent.current_task_id = None
        
        return True
    
    def get_agent_stats(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get agent statistics"""
        agent = self._agents.get(agent_id)
        
        if not agent:
            return None
        
        # Count tasks
        agent_tasks = [
            t for t in self._tasks.values()
            if t.assigned_agent_id == agent_id
        ]
        
        completed = sum(1 for t in agent_tasks if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in agent_tasks if t.status == TaskStatus.FAILED)
        
        return {
            "agent_id": agent_id,
            "type": agent.agent_type.value,
            "name": agent.name,
            "status": agent.status.value,
            "total_tasks": len(agent_tasks),
            "completed": completed,
            "failed": failed,
            "registered_at": agent.registered_at.isoformat(),
            "last_heartbeat": agent.last_heartbeat.isoformat()
        }
    
    def get_orchestrator_stats(self) -> Dict[str, Any]:
        """Get orchestrator statistics"""
        return {
            "total_agents": len(self._agents),
            "active_agents": sum(
                1 for a in self._agents.values()
                if a.status == AgentStatus.BUSY
            ),
            "idle_agents": sum(
                1 for a in self._agents.values()
                if a.status == AgentStatus.IDLE
            ),
            "total_tasks": self._stats["total_tasks"],
            "completed_tasks": self._stats["completed_tasks"],
            "failed_tasks": self._stats["failed_tasks"],
            "pending_tasks": sum(
                1 for t in self._tasks.values()
                if t.status == TaskStatus.PENDING
            ),
            "running_tasks": sum(
                1 for t in self._tasks.values()
                if t.status == TaskStatus.RUNNING
            ),
            "success_rate": (
                self._stats["completed_tasks"] / self._stats["total_tasks"] * 100
                if self._stats["total_tasks"] > 0 else 0
            )
        }
    
    # Pub/Sub messaging
    def subscribe(self, channel: str, agent_id: str):
        """Subscribe agent to channel"""
        if channel not in self._message_bus:
            self._message_bus[channel] = []
        
        if agent_id not in self._message_bus[channel]:
            self._message_bus[channel].append(agent_id)
    
    def unsubscribe(self, channel: str, agent_id: str):
        """Unsubscribe agent from channel"""
        if channel in self._message_bus:
            self._message_bus[channel] = [
                a for a in self._message_bus[channel]
                if a != agent_id
            ]
    
    def publish(self, channel: str, message: Dict):
        """Publish message to channel"""
        for agent_id in self._message_bus.get(channel, []):
            agent = self._agents.get(agent_id)
            if agent:
                logger.info(f"📬 Message to {agent_id} on {channel}: {message}")
    
    def heartbeat(self, agent_id: str):
        """Update agent heartbeat"""
        if agent_id in self._agents:
            self._agents[agent_id].last_heartbeat = datetime.now()


# Global singleton
_agent_orchestrator = None

def get_agent_orchestrator() -> AgentOrchestrator:
    """Get global AgentOrchestrator instance"""
    global _agent_orchestrator
    if _agent_orchestrator is None:
        _agent_orchestrator = AgentOrchestrator()
    return _agent_orchestrator