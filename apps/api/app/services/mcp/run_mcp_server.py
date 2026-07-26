"""
ViraLoop MCP Standalone Runner
================================
fastmcp v3는 FastAPI 이벤트 루프와 충돌하므로 독립 프로세스로 실행합니다.

실행:
    cd /app/backend
    venv/bin/python -m app.services.mcp.run_mcp_server

접속:
    SSE: http://localhost:4100/mcp/sse
    Tools: http://localhost:4100/mcp/tools
"""
import sys
import os

# backend/ 를 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.mcp.mcp_server import mcp

if __name__ == "__main__":
    print("🚀 [MCP] Starting ViraLoop Sovereign MCP Server on port 4100...")
    mcp.run(transport="streamable-http", host="0.0.0.0", port=4100, path="/mcp")
