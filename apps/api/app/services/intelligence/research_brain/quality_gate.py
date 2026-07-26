"""Stage C — Quality Gate (LLM-as-Judge with a deterministic hard gate first).

Follows the DeepEval "DAG" pattern: fail fast on objective, deterministic checks
before spending an LLM call on subjective rubric scoring. A grader parse failure
NEVER becomes a silent pass — it routes to human review.

    hard gate (deterministic) -> rubric (1 LLM call) -> production_readiness -> status
"""
from __future__ import annotations

import logging
import re
from typing import List

from .schema import ProductionResearchBrief, QualityGateResult
from .json_utils import parse_json_loose

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 8.5
REVIEW_THRESHOLD = 6.5

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)

_RUBRIC_SYS = (
    "You are a strict short-form video quality judge. Score the research brief blueprint on three axes from 0-10. "
    "Be conservative; reserve 9-10 for excellent.\n"
    "- hook_strength: would the best hook absolutely stop a scroll in the first 3 seconds?\n"
    "- warpability: is the script written in clear, simple language that can be easily mutated/rewritten (synonym swapping) without losing the core meaning?\n"
    "- visual_feasibility: are the B-roll cues concrete and easy to visualize/generate with AI or stock footage?\n"
    "Return ONLY JSON: "
    '{"hook_strength": <0-10>, "warpability": <0-10>, "visual_feasibility": <0-10>, "reason": "..."}'
)


class QualityGate:
    def __init__(self, llm_client, model: str = "", min_verified_claims: int = 2):
        self.llm = llm_client
        self.model = model
        self.min_verified_claims = min_verified_claims

    # ── Hard gate (deterministic) ──

    def hard_gate(self, brief: ProductionResearchBrief) -> List[str]:
        """Return a list of failure reasons. Empty list == passed."""
        reasons: List[str] = []
        vc = brief.verified_claim_count()
        if vc < self.min_verified_claims:
            reasons.append(f"verified_claims {vc} < {self.min_verified_claims}")
        if not brief.hook_bank:
            reasons.append("no hooks")
        shorts = brief.narrative_beats.shorts
        if len([b for b in shorts if b.role.value == "hook"]) < 1:
            reasons.append("no hook beat in shorts")
        if len(shorts) < 3:
            reasons.append("fewer than 3 short beats")
        for c in brief.atomic_claims:
            if c.verified and not _URL_RE.match(c.source_url.strip()):
                reasons.append(f"verified claim missing valid source url: {c.claim[:40]}")
                break
        return reasons

    # ── Rubric (LLM) ──

    def _rubric_summary(self, brief: ProductionResearchBrief) -> str:
        best = brief.best_hook()
        claims = "\n".join(
            f"- {c.claim}" + (f" [{c.exact_stat}]" if c.exact_stat else "") +
            (f" (src: {c.source_url})" if c.source_url else "")
            for c in brief.atomic_claims[:15]
        )
        beats = "\n".join(f"- [{b.role.value}] {b.text}" for b in brief.narrative_beats.shorts)
        return (
            f"TOPIC: {brief.topic}\nANGLE: {brief.angle}\nPROMISE: {brief.promise}\n\n"
            f"BEST HOOK: {best.text if best else '(none)'}\n\n"
            f"CLAIMS:\n{claims}\n\nSHORTS BEATS:\n{beats}"
        )

    def rubric(self, brief: ProductionResearchBrief) -> QualityGateResult:
        try:
            resp = self.llm.generate_content(
                prompt=self._rubric_summary(brief),
                model_name=self.model,
                system_instruction=_RUBRIC_SYS,
            )
            content = resp.get("content", "") if isinstance(resp, dict) else resp
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"[QualityGate] rubric LLM failed: {e}")
            content = ""

        obj = parse_json_loose(content)
        if not isinstance(obj, dict):
            # Grader failure -> route to human review, never a silent pass.
            return QualityGateResult(
                status="review",
                hard_gate_passed=True,
                reasons=["grader parse failure"],
            )

        def _score(key):
            try:
                return max(0.0, min(10.0, float(obj.get(key, 0) or 0)))
            except (TypeError, ValueError):
                return 0.0

        hook = _score("hook_strength")
        warp = _score("warpability")
        visual = _score("visual_feasibility")
        readiness = 0.4 * hook + 0.3 * warp + 0.3 * visual
        reason = str(obj.get("reason", "")).strip()

        result = QualityGateResult(
            hook_strength=hook,
            warpability=warp,
            visual_feasibility=visual,
            hard_gate_passed=True,
            reasons=[reason] if reason else [],
        )
        result.status = self._classify(readiness)
        return result

    @staticmethod
    def _classify(readiness: float) -> str:
        if readiness >= PASS_THRESHOLD:
            return "pass"
        if readiness >= REVIEW_THRESHOLD:
            return "review"
        return "reject"

    # ── Orchestration ──

    def evaluate(self, brief: ProductionResearchBrief) -> ProductionResearchBrief:
        """Mutates and returns the brief with gate result + production_readiness."""
        hard_failures = self.hard_gate(brief)
        if hard_failures:
            brief.gate = QualityGateResult(
                status="reject",
                hard_gate_passed=False,
                reasons=hard_failures,
            )
            brief.production_readiness = 0.0
            return brief

        result = self.rubric(brief)
        brief.gate = result
        brief.production_readiness = round(
            0.4 * result.hook_strength + 0.3 * result.warpability + 0.3 * result.visual_feasibility,
            2,
        )
        return brief
