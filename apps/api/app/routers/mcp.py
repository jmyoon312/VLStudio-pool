from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["MCP"])
@router.get("/", response_class=HTMLResponse)
async def mcp_info():
    """
    MCP 서버 상태 정보 페이지.
    fastmcp v3는 독립 프로세스(포트 4100)로 운영됩니다.
    """
    return """
    <html>
        <head><title>ViraLoop MCP</title></head>
        <body style="font-family: monospace; background: #0a0a0a; color: #00ff88; padding: 2rem;">
            <h1>📡 ViraLoop Sovereign MCP Server</h1>
            <p>Status: <b style="color:#ff6b00">Standalone Process (Port 4100)</b></p>
            <p>Protocol: Model Context Protocol v2026.1 (fastmcp v3)</p>
            <p>Transport: <code>streamable-http</code> + SSE</p>
            <hr style="border-color: #333"/>
            <h3>Active Tools (16):</h3>
            <ul>
                <li><b>WRITER:</b> inject_native_ssml, generate_director_schema, mutate_script_persona, generate_vocal_track</li>
                <li><b>RESEARCHER:</b> scout_market_gap, predict_thumbnail_ctr, analyze_viral_trend</li>
                <li><b>MEDIA:</b> apply_sovereign_shield, generate_scene_asset, verify_and_upscale_asset</li>
                <li><b>EDITOR:</b> validate_scene_consistency, trigger_capcut_automation</li>
                <li><b>PUBLISHER:</b> execute_global_syndication, generate_platform_metadata</li>
                <li><b>OPERATOR:</b> trigger_stealth_browser</li>
                <li><b>COORDINATOR:</b> start_niche_mission, panic_stop_all</li>
            </ul>
            <h3>How to Start MCP Server:</h3>
            <pre style="background:#111; padding: 1rem; border-radius: 8px;">
cd /app/backend
venv/bin/python -m app.services.mcp.run_mcp_server
            </pre>
            <p>MCP Endpoint: <a href="http://localhost:4100/mcp" style="color:#00aaff">http://localhost:4100/mcp</a></p>
        </body>
    </html>
    """
