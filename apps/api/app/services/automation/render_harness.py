"""
RenderHarness - Self-Correcting Render State Machine
======================================================
Pattern: Drafter-Critic Loop (LangGraph architecture in pure Python)
Verified reference: LangGraph CRAG (Corrective RAG) pattern
  https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#reflection

No langgraph dependency required - implements the same stateful graph
pattern using Python TypedDict + tenacity for retry control.

Execution Flow:
  [RENDER ATTEMPT] --> success? --> [END: return path]
                    --> error?  --> [DEBUGGER AGENT: patch props]
                               --> retry (up to max_retries)
                               --> max exceeded? --> raise TerminalError
"""

import logging
import json
import os
import re
import asyncio
from typing import TypedDict, Optional, List

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────
# 1. STATE DEFINITION (LangGraph-style TypedDict)
#    Pure Python equivalent of LangGraph's AgentState
# ──────────────────────────────────────────
class RenderState(TypedDict):
    scene_data: dict
    output_path: str
    iteration_count: int
    max_iterations: int
    error_history: List[str]
    success: bool
    final_path: Optional[str]


# ──────────────────────────────────────────
# 2. NODE FUNCTIONS (stateless transformers, same as LangGraph nodes)
# ──────────────────────────────────────────

def _critic_node(state: RenderState, renderer) -> RenderState:
    """
    CRITIC NODE: Attempts the actual Remotion render.
    Deterministic feedback - either succeeds or appends error_history.
    """
    try:
        final_path = renderer.render_scene(
            state["scene_data"],
            state["output_path"]
        )
        return {**state, "success": True, "final_path": final_path}
    except RuntimeError as e:
        logger.warning(f"[WARN] [Critic] Render failed (attempt {state['iteration_count'] + 1}): {str(e)[:200]}")
        return {
            **state,
            "success": False,
            "iteration_count": state["iteration_count"] + 1,
            "error_history": state["error_history"] + [str(e)],
        }


def _drafter_node(state: RenderState, llm_callable) -> RenderState:
    """
    DRAFTER NODE: LLM-powered JSON patch generator.
    Takes the last error log + current props and produces a patched scene_data.
    
    Strict JSON output enforced via system prompt injection.
    Falls back gracefully if the LLM returns invalid JSON
    (removes the broken layer rather than crashing).
    """
    last_error = state["error_history"][-1] if state["error_history"] else "Unknown error"
    current_props = json.dumps(state["scene_data"], indent=2, ensure_ascii=False)

    system_prompt = (
        "You are an expert Remotion.js video props debugger.\n"
        "A video rendering subprocess failed. Analyze the stack trace and the current JSON props deeply.\n"
        "Common failure causes:\n"
        "  - Missing or invalid file URIs (fix: use a safe fallback static color layer)\n"
        "  - Text content too long causing layout overflow (fix: truncate to 120 chars)\n"
        "  - Unsupported image format or corrupted asset path\n"
        "  - Null/undefined values in required fields\n\n"
        "RULES:\n"
        "1. Output ONLY the raw, valid JSON object for the fixed scene_data.\n"
        "2. Do NOT wrap in markdown code blocks.\n"
        "3. Do NOT add explanations. Just the JSON.\n"
        "4. Remove any layer/asset that has an invalid path - replace with a safe fallback."
    )

    user_msg = (
        f"=== CURRENT PROPS ===\n{current_props}\n\n"
        f"=== STACK TRACE ===\n{last_error[:3000]}\n\n"
        "Output the fully corrected scene_data JSON now."
    )

    try:
        raw_response = llm_callable(system_prompt, user_msg)

        # Strip accidental markdown wrappers (even if LLM disobeys)
        cleaned = raw_response.strip()
        cleaned = re.sub(r"^```json\s*", "", cleaned)
        cleaned = re.sub(r"^```\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

        patched = json.loads(cleaned)
        logger.info("[TOOL] [Drafter] Successfully generated scene prop patch.")
        return {**state, "scene_data": patched}

    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"🚑 [Drafter] LLM returned invalid JSON or failed: {e}. Applying safe fallback.")
        # Safe fallback: strip all asset layers and keep only text
        safe_scene = {k: v for k, v in state["scene_data"].items()
                      if not isinstance(v, str) or not v.startswith("/")}
        safe_scene["_fallback"] = True
        return {**state, "scene_data": safe_scene}


# ──────────────────────────────────────────
# 3. CONDITIONAL EDGE (Router function - exact LangGraph pattern)
# ──────────────────────────────────────────

def _should_retry(state: RenderState) -> str:
    """
    Router function for the conditional edge.
    Returns 'end', 'retry', or 'fail' - maps to graph paths.
    """
    if state["success"]:
        return "end"
    if state["iteration_count"] >= state["max_iterations"]:
        return "fail"
    return "retry"


# ──────────────────────────────────────────
# 4. GRAPH EXECUTOR - The Harness Runtime
# ──────────────────────────────────────────

class RenderHarness:
    """
    Executes the Drafter-Critic render state machine.
    Drop-in replacement for direct RemotionRenderer.render_scene() calls.

    Usage:
        harness = RenderHarness(renderer=remotion_renderer, llm_callable=my_llm_fn)
        final_path = harness.run(scene_data=props, output_path="/tmp/out.mp4")
    """

    def __init__(self, renderer, llm_callable, max_retries: int = 3):
        self.renderer = renderer
        self.llm_callable = llm_callable
        self.max_retries = max_retries

    def run(self, scene_data: dict, output_path: str) -> str:
        """
        Synchronous entry point. Runs the state machine loop.
        """
        state: RenderState = {
            "scene_data": scene_data,
            "output_path": output_path,
            "iteration_count": 0,
            "max_iterations": self.max_retries,
            "error_history": [],
            "success": False,
            "final_path": None,
        }

        logger.info(f"🏗️ [RenderHarness] Starting self-correcting render. Max retries: {self.max_retries}")

        while True:
            # CRITIC: try rendering
            state = _critic_node(state, self.renderer)

            # ROUTER: decide next step
            route = _should_retry(state)

            if route == "end":
                logger.info(f"[OK] [RenderHarness] Render succeeded on attempt {state['iteration_count']}.")
                return state["final_path"]

            elif route == "fail":
                err_summary = "\n---\n".join(state["error_history"])
                raise RuntimeError(
                    f"[RenderHarness] Terminal failure after {self.max_retries} attempts.\n{err_summary}"
                )

            elif route == "retry":
                # DRAFTER: patch the props
                logger.info(f"🔁 [RenderHarness] Routing to Drafter (attempt {state['iteration_count']}/{self.max_retries})...")
                state = _drafter_node(state, self.llm_callable)

    async def run_async(self, scene_data: dict, output_path: str) -> str:
        """
        Async wrapper - delegates blocking render to thread pool,
        keeps the drafter LLM call also in a thread to avoid blocking event loop.
        """
        return await asyncio.to_thread(self.run, scene_data, output_path)
