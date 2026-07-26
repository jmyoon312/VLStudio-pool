
import logging
import json
import asyncio
import traceback
from typing import Dict, Any, Callable, Optional
from datetime import datetime

from app.llm_manager import LLMClient
from app.config import settings

logger = logging.getLogger(__name__)

class RenderHarness:
    """
    Self-Healing Render Harness: Enables autonomous production continuity 
    by automatically resolving rendering failures using LLM-based prop patching.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    async def run_with_healing(self, render_func: Callable, props: Dict[str, Any], max_retries: int = 2) -> Dict[str, Any]:
        """
        Executes a rendering function with autonomous error recovery.
        """
        current_props = props
        attempts = 0

        while attempts <= max_retries:
            try:
                logger.info(f"🎬 [RenderHarness] Attempt {attempts + 1}/{max_retries + 1}...")
                result = await render_func(current_props)
                logger.info("✅ [RenderHarness] Render successful!")
                return result

            except Exception as e:
                attempts += 1
                error_log = traceback.format_exc()
                logger.error(f"❌ [RenderHarness] Render failed: {str(e)}")

                if attempts > max_retries:
                    logger.error("🛑 [RenderHarness] Max retries reached. Failing.")
                    raise e

                # --- Self-Healing Logic ---
                logger.info("🛠️ [RenderHarness] Initiating Self-Healing Protocol...")
                
                patched_props = await self._patch_props(current_props, error_log)
                if not patched_props:
                    logger.warning("⚠️ [RenderHarness] LLM failed to suggest a patch. Retrying with original props...")
                    continue
                
                logger.info(f"✨ [RenderHarness] Applied Patch: {json.dumps(patched_props)[:200]}...")
                current_props = patched_props

    async def _patch_props(self, props: Dict[str, Any], error_log: str) -> Optional[Dict[str, Any]]:
        """
        Asks the LLM to analyze the error and suggest a correction to the props.
        """
        prompt = f"""
        You are the 'Critic' in a Reflexive Render Harness.
        A video rendering task failed with the following error:
        
        [ERROR LOG]
        {error_log[-2000:]} 
        
        [ORIGINAL PROPS]
        {json.dumps(props, indent=2)}
        
        [TASK]
        Analyze the error. Is it caused by a specific prop? (e.g., text too long for a container, invalid font name, missing asset path, null value where number expected).
        Suggest a PATCHED version of the JSON props that resolves the error.
        Focus on:
        1. Truncating overly long text.
        2. Adjusting numeric values (scale, duration).
        3. Replacing missing assets with placeholders if safe.
        
        Output ONLY the patched JSON object.
        """

        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name="gemini-2.0-flash-exp",
                system_instruction="You are a senior video engineer. Return ONLY valid JSON."
            )
            
            # Clean response
            cleaned_resp = response.strip()
            if "```json" in cleaned_resp:
                cleaned_resp = cleaned_resp.split("```json")[1].split("```")[0].strip()
            
            return json.loads(cleaned_resp)
        except Exception as e:
            logger.error(f"Failed to generate patch: {e}")
            return None

render_harness = RenderHarness(LLMClient(settings))
