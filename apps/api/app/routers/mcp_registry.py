from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import logging
from app.services.mcp_client import root_mcp

logger = logging.getLogger("mcp_api")
router = APIRouter(tags=["Root MCP Integration"])

@router.get("/skills", response_model=Dict[str, Any])
async def list_mcp_skills():
    """
    Returns a structured list of all registered Root MCP Skills (Tools).
    Connects via stdio to the Node.js MCP Server at the root of the workspace.
    """
    try:
        # Fetch tools from the external Root MCP Server
        mcp_tools = await root_mcp.list_tools()
    except Exception as e:
        logger.error(f"❌ Failed to fetch Root MCP tools: {e}")
        return {"status": "error", "message": f"Root MCP connection failed: {str(e)}", "skills": []}

    if not mcp_tools:
        return {"status": "error", "message": "No tools found or MCP Server not initialized.", "skills": []}

    skills = []
    
    try:
        for tool in mcp_tools:
            params = []
            input_schema = tool.get("inputSchema", {})
            props = input_schema.get("properties", {})
            required_fields = input_schema.get("required", [])
            
            for prop_name, prop_data in props.items():
                params.append({
                    "name": prop_name,
                    "type": prop_data.get("type", "string"),
                    "description": prop_data.get("description", ""),
                    "required": prop_name in required_fields
                })
            
            # Estimate Category based on description keywords for UI
            desc = tool.get("description", "")
            category = "GENERAL"
            upper_desc = desc.upper()
            if "VIDEO" in upper_desc or "CAPCUT" in upper_desc or "RENDER" in upper_desc:
                category = "MEDIA"
            elif "FILE" in upper_desc or "DIR" in upper_desc or "READ" in upper_desc:
                category = "OPERATOR"
            elif "SCRIPT" in upper_desc or "DNA" in upper_desc:
                category = "WRITER"

            skills.append({
                "name": tool.get("name"),
                "description": desc,
                "category": category,
                "parameters": params
            })
            
    except Exception as e:
        logger.error(f"Failed to parse Root MCP skills: {e}")
        return {"status": "error", "message": str(e), "skills": []}

    return {
        "status": "success",
        "total_count": len(skills),
        "skills": sorted(skills, key=lambda x: x['name'])
    }

