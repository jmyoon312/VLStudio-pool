import logging
from typing import TypedDict, Annotated, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from app.agent.brain_router import brain_router
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("video_graph")

# 1. Define the State
class VideoProductionState(TypedDict):
    project_id: str
    channel_dna: Dict[str, Any]
    production_type: str # 'Type_A' (Remix) or 'Type_B' (Generative)
    
    script_content: str
    scenes: List[Dict[str, Any]]
    
    hitl_status: str # 'IDLE', 'PENDING_APPROVAL', 'APPROVED'
    current_phase: str
    errors: List[str]

# 2. Define Nodes (Agent Steps)
def planner_node(state: VideoProductionState) -> VideoProductionState:
    """Decides whether to use Type A (Remix) or Type B (Generative) based on DNA."""
    logger.info("🧠 [Planner Node] Analyzing DNA...")
    llm = brain_router.get_active_llm()
    # In a real scenario, LLM decides. Here we mock logic based on DNA.
    dna = state.get("channel_dna", {})
    
    # Example logic: If dna specifies 'curation', go Type A. Otherwise Type B.
    is_curation = dna.get("strategy", "") == "curation"
    state["production_type"] = "Type_A" if is_curation else "Type_B"
    state["current_phase"] = "PLANNING_COMPLETE"
    return state

def type_a_remix_node(state: VideoProductionState) -> VideoProductionState:
    """Executes Type A workflow: Scrape, Cut, Remix."""
    logger.info("✂️ [Type A Node] Executing Remix Workflow...")
    # TODO: Call Root MCP tools for downloading and cutting
    state["current_phase"] = "ASSEMBLY_READY"
    return state

def type_b_gen_node(state: VideoProductionState) -> VideoProductionState:
    """Executes Type B workflow: Write Script, Generate Assets."""
    logger.info("🎨 [Type B Node] Executing Generative Workflow...")
    llm = brain_router.get_active_llm()
    
    # Generate Script
    dna = state.get("channel_dna", {})
    messages = [
        SystemMessage(content="You are an expert YouTube script writer."),
        HumanMessage(content=f"Write a short script using this DNA: {dna}")
    ]
    response = llm.invoke(messages)
    state["script_content"] = response.content
    
    # TODO: Call Root MCP tools for Asset Generation (Flow AI, TTS)
    state["current_phase"] = "ASSEMBLY_READY"
    return state

def hitl_gateway_node(state: VideoProductionState) -> VideoProductionState:
    """Halts the graph to wait for Human Approval."""
    if state.get("hitl_status") != "APPROVED":
        logger.info("🚨 [HITL Gateway] Waiting for Human Approval...")
        state["hitl_status"] = "PENDING_APPROVAL"
    else:
        logger.info("✅ [HITL Gateway] Approval received. Proceeding to Render...")
    return state

def final_render_node(state: VideoProductionState) -> VideoProductionState:
    """Renders the final video via Root MCP."""
    logger.info("🎬 [Render Node] Sending to Root MCP Renderer...")
    # TODO: Call root_mcp.call_tool("app_render_video", ...)
    state["current_phase"] = "COMPLETED"
    return state

# 3. Define Routing Logic
def route_production(state: VideoProductionState) -> str:
    if state["production_type"] == "Type_A":
        return "type_a_node"
    return "type_b_node"

def check_approval(state: VideoProductionState) -> str:
    if state["hitl_status"] == "APPROVED":
        return "render_node"
    # If not approved (or pending), we end the graph run early (Suspend).
    # The UI will resume it later.
    return END

# 4. Build the Graph
workflow = StateGraph(VideoProductionState)

# Add Nodes
workflow.add_node("planner", planner_node)
workflow.add_node("type_a_node", type_a_remix_node)
workflow.add_node("type_b_node", type_b_gen_node)
workflow.add_node("hitl_gateway", hitl_gateway_node)
workflow.add_node("render_node", final_render_node)

# Add Edges
workflow.set_entry_point("planner")
workflow.add_conditional_edges("planner", route_production)
workflow.add_edge("type_a_node", "hitl_gateway")
workflow.add_edge("type_b_node", "hitl_gateway")
workflow.add_conditional_edges("hitl_gateway", check_approval)
workflow.add_edge("render_node", END)

# Compile with a Checkpointer (In-memory for testing, SQLite in production)
from langgraph.checkpoint.memory import MemorySaver
memory = MemorySaver()
app_graph = workflow.compile(checkpointer=memory, interrupt_before=["hitl_gateway"])
