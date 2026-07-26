"""
ProductionResearchBrief schema — the structured intermediate representation that
connects automated research to short-form / long-form script generation.

This module is intentionally dependency-free (pydantic only) so it can be unit
tested in isolation without the database, LLM, or web-search layers.

See docs/superpowers/specs/research-brain-implementation.md
"""
from __future__ import annotations

from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


# ── Enums ──

class HookType(str, Enum):
    curiosity_gap = "curiosity_gap"
    bold_claim = "bold_claim"
    question = "question"
    micro_story = "micro_story"
    visual_shock = "visual_shock"


class BeatRole(str, Enum):
    hook = "hook"
    point = "point"
    payoff = "payoff"
    loop = "loop"


class TimelinessType(str, Enum):
    timely = "timely"
    evergreen = "evergreen"


class AssetSource(str, Enum):
    pexels = "pexels"
    pixabay = "pixabay"
    archive = "archive"
    wikimedia = "wikimedia"


# ── Leaf models ──

class Timeliness(BaseModel):
    type: TimelinessType = TimelinessType.evergreen
    trend_velocity: float = Field(0.0, ge=0.0, le=1.0)
    expiry: Optional[str] = None  # ISO date string, when the topic goes stale


class AtomicClaim(BaseModel):
    """A single verified fact — the fuel for scripts. Must carry a source."""
    claim: str
    exact_stat: Optional[str] = None  # named number/date/entity if present
    source_url: str = ""
    source_title: str = ""
    credibility: float = Field(0.5, ge=0.0, le=1.0)
    verified: bool = False
    emotion_trigger: Optional[str] = None  # 경이|충격|공감|분노 ...

    @field_validator("claim")
    @classmethod
    def _claim_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("claim must not be empty")
        return v.strip()


class Hook(BaseModel):
    type: HookType
    text: str
    strength: float = Field(0.0, ge=0.0, le=10.0)
    claim_ref: Optional[int] = None  # index into atomic_claims

    @field_validator("text")
    @classmethod
    def _text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("hook text must not be empty")
        return v.strip()


class ShortBeat(BaseModel):
    role: BeatRole
    text: str
    seconds: int = Field(5, ge=1, le=60)
    claim_ref: Optional[int] = None


class Chapter(BaseModel):
    index: int = Field(..., ge=1)
    title: str
    beat: str
    rehook: Optional[str] = None
    seconds: int = Field(60, ge=5)
    broll_query: Optional[str] = None


class NarrativeBeats(BaseModel):
    shorts: List[ShortBeat] = Field(default_factory=list)
    longform: List[Chapter] = Field(default_factory=list)


class BrollCue(BaseModel):
    beat_ref: str  # e.g. "hook", "point:1", "chapter:2"
    query: str  # English visual search query for legal stock sources
    source: AssetSource = AssetSource.pexels
    asset_id: Optional[str] = None


class Contradiction(BaseModel):
    claim_a: str
    claim_b: str
    note: str = ""


class FormatCard(BaseModel):
    """The replicable 'DNA' — copy the format, not the footage."""
    hook_type: Optional[HookType] = None
    story_arc: List[str] = Field(default_factory=list)
    source_replacement_query: Optional[str] = None


class QualityGateResult(BaseModel):
    status: str = "review"  # pass | review | reject
    hook_strength: float = 0.0
    content_clarity: float = 0.0
    faithfulness: float = 0.0
    warpability: float = 0.0
    visual_feasibility: float = 0.0
    hard_gate_passed: bool = False
    reasons: List[str] = Field(default_factory=list)


# ── Root model ──

class ProductionResearchBrief(BaseModel):
    topic: str
    niche: str = "General"
    angle: str = ""
    promise: str = ""
    timeliness: Timeliness = Field(default_factory=Timeliness)
    atomic_claims: List[AtomicClaim] = Field(default_factory=list)
    hook_bank: List[Hook] = Field(default_factory=list)
    narrative_beats: NarrativeBeats = Field(default_factory=NarrativeBeats)
    broll_cues: List[BrollCue] = Field(default_factory=list)
    contradictions: List[Contradiction] = Field(default_factory=list)
    format_card: FormatCard = Field(default_factory=FormatCard)
    production_readiness: float = Field(0.0, ge=0.0, le=10.0)
    gate: Optional[QualityGateResult] = None
    degraded: bool = False  # set when compilation was partial

    # ── Derived helpers ──

    def verified_claim_count(self) -> int:
        return sum(1 for c in self.atomic_claims if c.verified)

    def best_hook(self) -> Optional[Hook]:
        if not self.hook_bank:
            return None
        return max(self.hook_bank, key=lambda h: h.strength)

    def is_structurally_ready(self, min_verified_claims: int = 2) -> bool:
        """Deterministic hard-gate check (no LLM)."""
        if self.verified_claim_count() < min_verified_claims:
            return False
        if not self.hook_bank:
            return False
        if len([b for b in self.narrative_beats.shorts if b.role == BeatRole.hook]) < 1:
            return False
        if len(self.narrative_beats.shorts) < 3:
            return False
        # every claim that is verified must carry a source url
        for c in self.atomic_claims:
            if c.verified and not c.source_url.strip():
                return False
        return True
