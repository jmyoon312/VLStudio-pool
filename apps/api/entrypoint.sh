#!/bin/bash
# [Sovereign] API Hub Entrypoint
# Role: Brain Hub - 50+ API routes, MCP skill server, Hybrid Bridge controller
# Agent UIs (Hermes:9119, OpenClaude:28789) run in their own dedicated containers.

echo "🚀 [Sovereign API] Starting Brain Hub on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
