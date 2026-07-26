"""Stage B — Brief Compiler.

Turns the validated atomic claims from Stage A into a ProductionResearchBrief:
angle/promise, a hook bank (5 hook types), narrative beats for BOTH shorts and
longform, and b-roll cues. Each sub-step is a single LLM call; failures degrade
gracefully (partial brief with `degraded=True`) rather than aborting.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from .schema import (
    ProductionResearchBrief,
    AtomicClaim,
    Contradiction,
    Hook,
    HookType,
    ShortBeat,
    BeatRole,
    Chapter,
    NarrativeBeats,
    BrollCue,
    AssetSource,
    FormatCard,
)
from .json_utils import parse_json_list, parse_json_loose

logger = logging.getLogger(__name__)


_ANGLE_SYS = (
    "You are a viral Shorts content strategist. Given a reference video's transcript/facts, decide the single "
    "strongest ANGLE (a focused point of view, e.g. 'why this artisan is the world's best') and "
    "a one-line PROMISE of what the viewer will gain. Return ONLY JSON: "
    '{"angle": "...", "promise": "..."}'
)

_HOOK_SYS = (
    "You reverse-engineer 3-second scroll-stopping hooks for short-form video from reference content. "
    "Using the facts/transcript, write hooks across these 5 types: curiosity_gap, bold_claim, question, micro_story, visual_shock. "
    "Produce 1-2 hooks per type. Each hook must be punchy (<=12 words for the on-screen line) and, "
    "where possible, reference a specific fact. Return ONLY a JSON array of: "
    '{"type": "curiosity_gap|bold_claim|question|micro_story|visual_shock", "text": "...", '
    '"strength": <0-10 self-rated scroll-stopping power>, "claim_ref": <fact index or null>}'
)

_SHORTS_SYS = (
    "You structure a 35-55 second vertical short for maximum retention based on a reference. Use the beat roles: "
    "hook (0-3s), point (8-12s each, 3-5 of them), payoff, loop (a closing line that loops back to "
    "the hook). Ground each point in a fact. The text MUST be easy to mutate/warp with synonyms. "
    "Return ONLY a JSON array of: "
    '{"role": "hook|point|payoff|loop", "text": "...", "seconds": <int>, "claim_ref": <fact index or null>}'
)

_LONGFORM_SYS = (
    "You structure a 3-8 minute long-form video from the same facts. Create 4-8 chapters. Re-hook "
    "the viewer every 60-90 seconds (open a new curiosity loop). For each chapter suggest a short "
    "English b-roll search query. Return ONLY a JSON array of: "
    '{"index": <int from 1>, "title": "...", "beat": "what is covered", "rehook": "...", '
    '"seconds": <int>, "broll_query": "english stock query"}'
)

_FORMATCARD_SYS = (
    "Reverse-engineer the replicable FORMAT of this reference video (the 'DNA' that makes it go viral). "
    "Identify the primary hook type, the narrative pacing (story_arc), and suggest an English search query "
    "to find B-roll or alternative videos that fit this exact format. Return ONLY JSON: "
    '{"hook_type": "curiosity_gap|bold_claim|question|micro_story|visual_shock", '
    '"story_arc": ["beat1","beat2","beat3"], "source_replacement_query": "english query to find a '
    'DIFFERENT video with the same format"}'
)


def _facts_block(claims: List[AtomicClaim], limit: int = 30) -> str:
    lines = []
    for i, c in enumerate(claims[:limit]):
        stat = f" [{c.exact_stat}]" if c.exact_stat else ""
        lines.append(f"{i}. {c.claim}{stat}")
    return "\n".join(lines)


class BriefCompiler:
    def __init__(self, llm_client, model: str = ""):
        self.llm = llm_client
        self.model = model

    def _llm(self, prompt: str, system: str) -> str:
        try:
            resp = self.llm.generate_content(
                prompt=prompt, model_name=self.model, system_instruction=system
            )
            if isinstance(resp, dict):
                return str(resp.get("content", ""))
            return str(resp) if resp is not None else ""
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"[BriefCompiler] LLM call failed: {e}")
            return ""

    # ── Sub-steps ──

    def _angle_promise(self, topic: str, facts: str) -> tuple:
        obj = parse_json_loose(self._llm(f"### TOPIC: {topic}\n### FACTS:\n{facts}", _ANGLE_SYS))
        if isinstance(obj, dict):
            return str(obj.get("angle", "")).strip(), str(obj.get("promise", "")).strip()
        return "", ""

    def _hooks(self, topic: str, facts: str, n_claims: int) -> List[Hook]:
        items = parse_json_list(self._llm(f"### TOPIC: {topic}\n### FACTS:\n{facts}", _HOOK_SYS))
        hooks: List[Hook] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            try:
                ref = it.get("claim_ref")
                ref = ref if isinstance(ref, int) and 0 <= ref < n_claims else None
                strength = float(it.get("strength", 5) or 5)
                hooks.append(Hook(
                    type=HookType(str(it.get("type", "curiosity_gap"))),
                    text=str(it.get("text", "")),
                    strength=max(0.0, min(10.0, strength)),
                    claim_ref=ref,
                ))
            except Exception:
                continue
        return hooks

    def _shorts(self, topic: str, facts: str, n_claims: int) -> List[ShortBeat]:
        items = parse_json_list(self._llm(f"### TOPIC: {topic}\n### FACTS:\n{facts}", _SHORTS_SYS))
        beats: List[ShortBeat] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            try:
                ref = it.get("claim_ref")
                ref = ref if isinstance(ref, int) and 0 <= ref < n_claims else None
                secs = int(it.get("seconds", 5) or 5)
                beats.append(ShortBeat(
                    role=BeatRole(str(it.get("role", "point"))),
                    text=str(it.get("text", "")),
                    seconds=max(1, min(60, secs)),
                    claim_ref=ref,
                ))
            except Exception:
                continue
        return beats

    def _longform(self, topic: str, facts: str) -> List[Chapter]:
        items = parse_json_list(self._llm(f"### TOPIC: {topic}\n### FACTS:\n{facts}", _LONGFORM_SYS))
        chapters: List[Chapter] = []
        for i, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            try:
                idx = it.get("index")
                idx = idx if isinstance(idx, int) and idx >= 1 else i + 1
                secs = int(it.get("seconds", 60) or 60)
                chapters.append(Chapter(
                    index=idx,
                    title=str(it.get("title", f"Chapter {idx}")),
                    beat=str(it.get("beat", "")),
                    rehook=(str(it["rehook"]) if it.get("rehook") else None),
                    seconds=max(5, secs),
                    broll_query=(str(it["broll_query"]) if it.get("broll_query") else None),
                ))
            except Exception:
                continue
        return chapters

    def _format_card(self, topic: str, facts: str) -> FormatCard:
        obj = parse_json_loose(self._llm(f"### TOPIC: {topic}\n### FACTS:\n{facts}", _FORMATCARD_SYS))
        if not isinstance(obj, dict):
            return FormatCard()
        try:
            ht = obj.get("hook_type")
            hook_type = HookType(str(ht)) if ht else None
        except Exception:
            hook_type = None
        arc = obj.get("story_arc") or []
        arc = [str(x) for x in arc if x] if isinstance(arc, list) else []
        srq = obj.get("source_replacement_query")
        return FormatCard(
            hook_type=hook_type,
            story_arc=arc,
            source_replacement_query=(str(srq) if srq else None),
        )

    @staticmethod
    def _broll_from_chapters(chapters: List[Chapter]) -> List[BrollCue]:
        cues: List[BrollCue] = []
        for ch in chapters:
            if ch.broll_query:
                cues.append(BrollCue(
                    beat_ref=f"chapter:{ch.index}",
                    query=ch.broll_query,
                    source=AssetSource.pexels,
                ))
        return cues

    # ── Orchestration ──

    def compile(
        self,
        topic: str,
        niche: str,
        claims: List[AtomicClaim],
        contradictions: Optional[List[Contradiction]] = None,
    ) -> ProductionResearchBrief:
        facts = _facts_block(claims)
        n = len(claims)
        degraded = False

        angle, promise = self._angle_promise(topic, facts)
        hooks = self._hooks(topic, facts, n)
        shorts = self._shorts(topic, facts, n)
        longform = self._longform(topic, facts)
        format_card = self._format_card(topic, facts)

        if not hooks or not shorts:
            degraded = True

        broll = self._broll_from_chapters(longform)

        return ProductionResearchBrief(
            topic=topic,
            niche=niche or "General",
            angle=angle,
            promise=promise,
            atomic_claims=claims,
            hook_bank=hooks,
            narrative_beats=NarrativeBeats(shorts=shorts, longform=longform),
            broll_cues=broll,
            contradictions=contradictions or [],
            format_card=format_card,
            degraded=degraded,
        )
