"""Stage A — Deep Research Loop.

Replaces the legacy single-pass "search once + summarize once" research with an
iterative deepening loop inspired by local-deep-researcher (IterDRAG) and
dzhng/deep-research:

    seed query -> search -> extract atomic claims -> reflect on gaps ->
    follow-up query -> search -> accumulate -> (repeat up to max_loops) ->
    cross-validate across sources

Dependencies (`llm_client`, `search_fn`) are injected so the loop is fully unit
testable without the network or a real model.
"""
from __future__ import annotations

import logging
import re
from typing import Callable, List, Optional, Tuple

from .schema import AtomicClaim, Contradiction
from .json_utils import parse_json_list, parse_json_loose

logger = logging.getLogger(__name__)

# search_fn(query: str) -> list[{"title","url","content"}]
SearchFn = Callable[[str], list]


_CLAIM_SYS = (
    "You are a research analyst extracting ATOMIC, verifiable facts from web search "
    "results. Each fact must be self-contained and, wherever possible, include a named "
    "entity, an exact number, a date, or a proper noun. Discard vague or opinion claims.\n\n"
    "Return ONLY a JSON array. Each object:\n"
    '{"claim": "...", "exact_stat": "37 years | $2.1B | 2024 | null", '
    '"source_index": <int index of the source it came from>, '
    '"emotion_trigger": "경이|충격|공감|분노|호기심|null"}\n'
    "Also you MAY suggest follow-up questions by appending one final object: "
    '{"followups": ["question1", "question2"]}'
)

_REFLECT_SYS = (
    "You are a research supervisor. Given the facts gathered so far, identify the single "
    "biggest knowledge gap that, if filled, would most improve a video on this topic. "
    "Return ONLY a JSON object: "
    '{"gap": "what is missing", "follow_up_query": "a self-contained web search query"}. '
    'If the research is already comprehensive, return {"gap": null, "follow_up_query": null}.'
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


class DeepResearchLoop:
    def __init__(
        self,
        llm_client,
        search_fn: SearchFn,
        model: str = "",
        max_loops: int = 3,
        max_results_per_search: int = 8,
    ):
        self.llm = llm_client
        self.search_fn = search_fn
        self.model = model
        self.max_loops = max(1, max_loops)
        self.max_results = max_results_per_search

    # ── LLM helpers ──

    def _llm(self, prompt: str, system: str) -> str:
        try:
            resp = self.llm.generate_content(
                prompt=prompt, model_name=self.model, system_instruction=system
            )
            if isinstance(resp, dict):
                return str(resp.get("content", ""))
            return str(resp) if resp is not None else ""
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"[DeepResearch] LLM call failed: {e}")
            return ""

    # ── Core steps ──

    def _search(self, query: str) -> list:
        try:
            results = self.search_fn(query) or []
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"[DeepResearch] search failed for '{query}': {e}")
            return []
        return results[: self.max_results]

    def extract_claims(self, query: str, results: list) -> Tuple[List[AtomicClaim], List[str]]:
        """Extract atomic claims from search results. Returns (claims, followups)."""
        if not results:
            return [], []

        context = "\n\n".join(
            f"[{i}] {r.get('title','')}\n{(r.get('content','') or '')[:600]}"
            for i, r in enumerate(results)
        )
        raw = self._llm(
            prompt=f"### TOPIC QUERY: {query}\n\n### SOURCES:\n{context}",
            system=_CLAIM_SYS,
        )
        items = parse_json_list(raw)

        claims: List[AtomicClaim] = []
        followups: List[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if "followups" in item:
                fu = item.get("followups") or []
                followups.extend([str(x) for x in fu if x])
                continue
            claim_text = item.get("claim")
            if not claim_text or not str(claim_text).strip():
                continue
            idx = item.get("source_index")
            src = None
            if isinstance(idx, int) and 0 <= idx < len(results):
                src = results[idx]
            stat = item.get("exact_stat")
            if isinstance(stat, str) and stat.strip().lower() in ("null", "none", ""):
                stat = None
            trigger = item.get("emotion_trigger")
            if isinstance(trigger, str) and trigger.strip().lower() in ("null", "none", ""):
                trigger = None
            try:
                claims.append(
                    AtomicClaim(
                        claim=str(claim_text),
                        exact_stat=stat,
                        source_url=(src or {}).get("url", "") if src else "",
                        source_title=(src or {}).get("title", "") if src else "",
                        credibility=0.5,
                        verified=False,
                        emotion_trigger=trigger,
                    )
                )
            except Exception:
                continue
        return claims, followups

    def reflect(self, topic: str, claims: List[AtomicClaim]) -> Optional[str]:
        """Identify the biggest gap and return a follow-up query, or None if done."""
        if not claims:
            return None
        facts = "\n".join(f"- {c.claim}" for c in claims[:40])
        raw = self._llm(
            prompt=f"### TOPIC: {topic}\n\n### FACTS SO FAR:\n{facts}",
            system=_REFLECT_SYS,
        )
        obj = parse_json_loose(raw)
        if not isinstance(obj, dict):
            return None
        fq = obj.get("follow_up_query")
        if not fq or str(fq).strip().lower() in ("null", "none", ""):
            return None
        return str(fq).strip()

    def cross_validate(self, claims: List[AtomicClaim]) -> List[AtomicClaim]:
        """Merge duplicate claims; a claim corroborated by 2+ distinct source URLs
        is marked verified with boosted credibility."""
        groups: dict = {}
        for c in claims:
            key = _normalize(c.claim)
            groups.setdefault(key, []).append(c)

        merged: List[AtomicClaim] = []
        for _, group in groups.items():
            base = group[0]
            distinct_sources = {c.source_url for c in group if c.source_url.strip()}
            n_sources = len(distinct_sources)
            # pick the representative with the most informative stat
            rep = max(group, key=lambda c: (bool(c.exact_stat), len(c.claim)))
            rep.verified = n_sources >= 2 or (n_sources >= 1 and rep.exact_stat is not None)
            rep.credibility = min(1.0, 0.5 + 0.25 * n_sources)
            merged.append(rep)
        # most credible / verified first
        merged.sort(key=lambda c: (c.verified, c.credibility), reverse=True)
        return merged

    # ── Orchestration ──

    def run(self, topic: str, seed_query: Optional[str] = None) -> Tuple[List[AtomicClaim], List[Contradiction]]:
        query = seed_query or topic
        all_claims: List[AtomicClaim] = []
        seen_queries = set()
        pending_followups: List[str] = []

        for loop_i in range(self.max_loops):
            if not query or _normalize(query) in seen_queries:
                break
            seen_queries.add(_normalize(query))

            results = self._search(query)
            claims, followups = self.extract_claims(query, results)
            all_claims.extend(claims)
            pending_followups.extend(followups)

            logger.info(
                f"[DeepResearch] loop {loop_i+1}/{self.max_loops} '{query[:60]}' "
                f"-> {len(claims)} claims (total {len(all_claims)})"
            )

            if loop_i == self.max_loops - 1:
                break

            # Decide next query: prefer reflection's gap, fall back to a followup.
            next_q = self.reflect(topic, all_claims)
            if not next_q:
                next_q = next(
                    (f for f in pending_followups if _normalize(f) not in seen_queries),
                    None,
                )
            if not next_q:
                break
            query = next_q

        validated = self.cross_validate(all_claims)
        return validated, []
