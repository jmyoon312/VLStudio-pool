import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import CallToolResult

logger = logging.getLogger("mcp_client")

class RootMCPClient:
    """
    Bridge class to connect the Python FastAPI LangGraph Brain
    to the ViraLoop Node.js Root MCP Server via stdio.
    """
    def __init__(self):
        self.mcp_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))),
            "mcp-server",
            "index.js"
        )
        self.node_path = "node" # Assumes node is in PATH
        self.session: Optional[ClientSession] = None
        self._exit_stack = None

    async def connect(self):
        """Initializes the stdio connection to the Root MCP Server."""
        if not os.path.exists(self.mcp_path):
            logger.error(f"Root MCP Server not found at {self.mcp_path}")
            return False

        logger.info(f"Connecting to Root MCP Server at {self.mcp_path}...")
        
        server_params = StdioServerParameters(
            command=self.node_path,
            args=[self.mcp_path],
            env=os.environ.copy()
        )

        from contextlib import AsyncExitStack
        self._exit_stack = AsyncExitStack()
        
        try:
            stdio_transport = await self._exit_stack.enter_async_context(stdio_client(server_params))
            read, write = stdio_transport
            self.session = await self._exit_stack.enter_async_context(ClientSession(read, write))
            await self.session.initialize()
            logger.info("[OK] Successfully connected to Root MCP Server!")
            return True
        except Exception as e:
            logger.error(f"[FAIL] Failed to connect to Root MCP Server: {e}")
            if self._exit_stack:
                await self._exit_stack.aclose()
            return False

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Fetches available tools from the Root MCP Server."""
        if not self.session:
            await self.connect()
            
        if not self.session:
            return []

        try:
            response = await self.session.list_tools()
            tools = []
            for tool in response.tools:
                tools.append({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.inputSchema
                })
            return tools
        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            return []

    async def call_tool(self, name: str, arguments: dict) -> Any:
        """Executes a tool on the Root MCP Server."""
        if not self.session:
            await self.connect()
            
        try:
            logger.info(f"Calling Root MCP Tool: {name}")
            result: CallToolResult = await self.session.call_tool(name, arguments)
            return result
        except Exception as e:
            logger.error(f"Tool execution failed ({name}): {e}")
            raise e

    async def disconnect(self):
        if self._exit_stack:
            await self._exit_stack.aclose()
            self.session = None
            logger.info("Disconnected from Root MCP Server.")

# Global instance for the backend
root_mcp = RootMCPClient()
