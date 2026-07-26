"""ResearchBrain — orchestrates the three stages into a single production brief.

    A. DeepResearchLoop -> atomic claims (+ contradictions)
    B. BriefCompiler    -> ProductionResearchBrief (hooks / beats / b-roll)
    C. QualityGate      -> production_readiness + gate status

Designed to run inside a scheduler thread or an API request. The web-search
function and LLM client are injected; if not provided, sensible production
defaults are wired from the app (tool_manager + LLMClient).
"""
from __future__ import annotations

import logging
from typing import Callable, Optional

from .deep_research import DeepResearchLoop
from .brief_compiler import BriefCompiler
from .quality_gate import QualityGate
from .schema import ProductionResearchBrief

logger = logging.getLogger(__name__)


class ResearchBrain:
    def __init__(
        self,
        llm_client,
        search_fn: Callable[[str], list],
        model: str = "",
        max_loops: int = 3,
        min_verified_claims: int = 2,
    ):
        self.deep = DeepResearchLoop(llm_client, search_fn, model=model, max_loops=max_loops)
        self.compiler = BriefCompiler(llm_client, model=model)
        self.gate = QualityGate(llm_client, model=model, min_verified_claims=min_verified_claims)

    def run(
        self,
        topic: str,
        niche: str = "General",
        seed_query: Optional[str] = None,
        reference_url: Optional[str] = None,
    ) -> ProductionResearchBrief:
        logger.info(f"🧠 [ResearchBrain] Stage A: deep research for '{topic}'")
        
        claims = []
        contradictions = []
        
        if reference_url:
            try:
                from app.services.intelligence.research_brain.source_assets import ReferenceCollector
                from app.services.intelligence.research_brain.schema import AtomicClaim
                collector = ReferenceCollector()
                meta = collector.collect(reference_url)
                transcript = meta.get("transcript", "")
                if transcript:
                    logger.info(f"🧠 [ResearchBrain] Extracted transcript from {reference_url} (length: {len(transcript)})")
                    claims.append(AtomicClaim(
                        claim=f"Reference Transcript: {transcript[:8000]}",
                        source_url=reference_url,
                        source_title=meta.get("title", "Reference Video"),
                        credibility=1.0,
                        verified=True
                    ))
            except Exception as e:
                logger.warning(f"Failed to extract transcript: {e}")

        if not claims:
            claims, contradictions = self.deep.run(topic, seed_query=seed_query)

        logger.info(f"🧠 [ResearchBrain] Stage B: compiling brief ({len(claims)} claims)")
        brief = self.compiler.compile(topic, niche, claims, contradictions)

        logger.info("🧠 [ResearchBrain] Stage C: quality gate")
        brief = self.gate.evaluate(brief)

        logger.info(
            f"🧠 [ResearchBrain] done — readiness={brief.production_readiness} "
            f"status={brief.gate.status if brief.gate else 'n/a'}"
        )
        return brief


def build_default_brain(settings, model: str = "", max_loops: int = 3) -> ResearchBrain:
    """Wire a ResearchBrain from the app's LLM + search infrastructure.

    Honors the user's configured AI provider/model from Settings (OpenClaw
    selection and its fallbacks) instead of hardcoding a model.
    """
    from app.llm_manager import LLMClient
    from app.services.tool_manager import tool_manager
    from .model_resolver import resolve_agent_model

    llm_client = LLMClient(settings)
    resolved_model = model or resolve_agent_model(settings)

    def search_fn(query: str) -> list:
        try:
            res = tool_manager.search(
                query, include_images=False, settings=settings, time_range="year"
            )
            return res.get("results", []) if isinstance(res, dict) else []
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"[ResearchBrain] search failed: {e}")
            return []

    return ResearchBrain(llm_client, search_fn, model=resolved_model, max_loops=max_loops)
