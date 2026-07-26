import logging
import json
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class SwarmConnectionManager:
    """
    Global WebSocket Manager for Swarm Events.
    Centralized to allow broadcasting from any part of the system (API, Worker, Orchestrator).
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("[OK] Global Swarm WebSocket Client connected")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("[END] Global Swarm WebSocket Client disconnected")

    async def broadcast(self, message: dict):
        """Sends a message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                # Cleanup dead connections lazily
                pass

# Singleton instance
swarm_manager = SwarmConnectionManager()
