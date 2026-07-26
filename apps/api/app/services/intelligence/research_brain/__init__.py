"""research_brain — Production Research Brain.

Three-stage pipeline that turns a topic into a structured, production-ready
research brief for short-form and long-form script generation.

A: DeepResearchLoop   (search + iterative claim extraction)
B: BriefCompiler      (claims -> hooks / narrative beats / b-roll cues)
C: QualityGate        (hard gate + LLM-as-judge rubric)
"""
from .schema import (
    ProductionResearchBrief,
    AtomicClaim,
    Hook,
    HookType,
    ShortBeat,
    BeatRole,
    Chapter,
    NarrativeBeats,
    BrollCue,
    AssetSource,
    Contradiction,
    FormatCard,
    Timeliness,
    TimelinessType,
    QualityGateResult,
)

__all__ = [
    "ProductionResearchBrief",
    "AtomicClaim",
    "Hook",
    "HookType",
    "ShortBeat",
    "BeatRole",
    "Chapter",
    "NarrativeBeats",
    "BrollCue",
    "AssetSource",
    "Contradiction",
    "FormatCard",
    "Timeliness",
    "TimelinessType",
    "QualityGateResult",
]
