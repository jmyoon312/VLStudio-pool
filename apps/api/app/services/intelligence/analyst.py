import logging
import json
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class Analyst:
    """
    Intelligence Analysis Service.
    Handles Reference Channel Analysis and trend pattern extraction.
    """
    def __init__(self, settings, llm_client=None):
        self.settings = settings
        self.llm_client = llm_client

    def _get_model(self, override_model: str = None) -> str:
        """Resolves the model name from settings or override."""
        if override_model:
            return override_model
        
        # Default to OpenClaw agent model if not specified
        model_name = getattr(self.settings, "openclaw_model", self.settings.default_model)
        provider = getattr(self.settings, "openclaw_preferred_provider", "auto")
        
        if provider == "openrouter" and not model_name.startswith("openrouter/"):
            return f"openrouter/{model_name}"
        if provider == "groq" and not model_name.startswith("groq/"):
            return f"groq/{model_name}"
            
        return model_name

    async def extract_viral_patterns(self, source_text: str, model: str = None):
        """
        [Premium Pipeline] Analyzes source scripts/trends to extract 'Viral Success Patterns'.
        Uses high-intelligence models to identify hooks, pacing, and visual styles.
        """
        target_model = self._get_model(model)
        logger.info(f"🕵️‍♂️ Deep Analyzing viral patterns via {target_model}...")
        
        if not self.llm_client:
            # Fallback to stub if llm_client not provided
            return {
                "hooks": ["Question-based opening", "Visual paradox"],
                "pacing": "Fast-cut every 1.5s",
                "visual_style": "High-contrast visuals"
            }

        prompt = f"""
        Analyze the following reference video transcripts/data to extract 'Winning Patterns' for a short-form video.
        
        DATA:
        {source_text}
        
        Extract:
        1. 'hooks': Top 3 hook patterns that work for this niche.
        2. 'pacing': Recommended transition speed and structure.
        3. 'visual_style': Key visual elements or signatures to mirror.
        4. 'emotional_arc': The psychological journey of the viewer.
        
        Output ONLY JSON: {{ "hooks": [], "pacing": "", "visual_style": "", "emotional_arc": "" }}
        """
        
        try:
            response = self.llm_client.generate_content(prompt, model_name=target_model)
            # Find JSON
            import re
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return {}
        except Exception as e:
            logger.error(f"Failed to analyze viral patterns: {e}")
            return {}

    async def ingest_to_notebook_lm(self, data: list):
        """
        Prepares and 'submits' data to the NotebookLM knowledge base.
        """
        logger.info(f"Ingesting {len(data)} items for NotebookLM analysis.")
        return True
