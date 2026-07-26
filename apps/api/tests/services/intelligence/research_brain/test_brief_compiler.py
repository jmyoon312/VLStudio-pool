"""Unit tests for Stage B — BriefCompiler. LLM is mocked with queued responses."""
import json
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.brief_compiler import BriefCompiler  # noqa: E402
from app.services.intelligence.research_brain.schema import (  # noqa: E402
    AtomicClaim, HookType, BeatRole,
)


class SequencedLLM:
    """Returns responses keyed by a marker found in the system instruction, so
    test order is robust regardless of internal call sequence."""
    def __init__(self, by_marker):
        self.by_marker = by_marker
        self.calls = []

    def generate_content(self, prompt, model_name=None, system_instruction=None, **kwargs):
        self.calls.append(system_instruction)
        sys_l = (system_instruction or "").lower()
        for marker, resp in self.by_marker.items():
            if marker in sys_l:
                return resp
        return ""


def _claims():
    return [
        AtomicClaim(claim="Forge hits 1300C", exact_stat="1300C", verified=True, source_url="https://a.com"),
        AtomicClaim(claim="37 years experience", exact_stat="37 years", verified=True, source_url="https://b.com"),
    ]


ANGLE = json.dumps({"angle": "Why he is the world's best", "promise": "You'll see mastery in 40s"})
HOOKS = json.dumps([
    {"type": "curiosity_gap", "text": "You won't believe step 3", "strength": 8.5, "claim_ref": 0},
    {"type": "bold_claim", "text": "The world's best blacksmith", "strength": 7, "claim_ref": 1},
    {"type": "question", "text": "Can you guess his age?", "strength": 6, "claim_ref": None},
])
SHORTS = json.dumps([
    {"role": "hook", "text": "Watch this", "seconds": 3, "claim_ref": 0},
    {"role": "point", "text": "1300 degrees", "seconds": 10, "claim_ref": 0},
    {"role": "point", "text": "37 years", "seconds": 10, "claim_ref": 1},
    {"role": "payoff", "text": "A masterpiece", "seconds": 8, "claim_ref": None},
    {"role": "loop", "text": "And that's step 3", "seconds": 3, "claim_ref": None},
])
LONGFORM = json.dumps([
    {"index": 1, "title": "Origins", "beat": "his start", "rehook": "but then...", "seconds": 80, "broll_query": "blacksmith forge"},
    {"index": 2, "title": "Mastery", "beat": "the technique", "rehook": "the secret is next", "seconds": 90, "broll_query": "hammer anvil sparks"},
])
FORMATCARD = json.dumps({
    "hook_type": "curiosity_gap",
    "story_arc": ["raw material", "process", "reveal"],
    "source_replacement_query": "leather craft artisan",
})


def _compiler():
    llm = SequencedLLM({
        "angle": ANGLE,
        "3-second scroll-stopping": HOOKS,
        "35-55 second": SHORTS,
        "3-8 minute": LONGFORM,
        "replicable format": FORMATCARD,
    })
    return BriefCompiler(llm), llm


def test_compile_full_brief():
    compiler, _ = _compiler()
    brief = compiler.compile("Master blacksmith", "Craftsmanship", _claims())

    assert brief.angle == "Why he is the world's best"
    assert brief.promise.startswith("You'll see")
    assert brief.niche == "Craftsmanship"
    assert brief.degraded is False


def test_compile_builds_hook_bank_all_types():
    compiler, _ = _compiler()
    brief = compiler.compile("t", "n", _claims())
    types = {h.type for h in brief.hook_bank}
    assert HookType.curiosity_gap in types
    assert HookType.bold_claim in types
    assert brief.best_hook().strength == 8.5


def test_compile_shorts_beats_have_hook_and_points():
    compiler, _ = _compiler()
    brief = compiler.compile("t", "n", _claims())
    roles = [b.role for b in brief.narrative_beats.shorts]
    assert BeatRole.hook in roles
    assert roles.count(BeatRole.point) >= 2


def test_compile_longform_chapters_and_broll_cues():
    compiler, _ = _compiler()
    brief = compiler.compile("t", "n", _claims())
    assert len(brief.narrative_beats.longform) == 2
    # b-roll cues auto-derived from chapter broll_query
    assert len(brief.broll_cues) == 2
    assert brief.broll_cues[0].beat_ref == "chapter:1"
    assert "forge" in brief.broll_cues[0].query


def test_compile_format_card():
    compiler, _ = _compiler()
    brief = compiler.compile("t", "n", _claims())
    assert brief.format_card.hook_type == HookType.curiosity_gap
    assert brief.format_card.story_arc == ["raw material", "process", "reveal"]
    assert brief.format_card.source_replacement_query == "leather craft artisan"


def test_compile_resulting_brief_is_structurally_ready():
    compiler, _ = _compiler()
    brief = compiler.compile("t", "n", _claims())
    assert brief.is_structurally_ready() is True


def test_compile_degrades_when_hooks_missing():
    llm = SequencedLLM({"angle": ANGLE, "35-55 second": SHORTS, "3-8 minute": LONGFORM})
    brief = BriefCompiler(llm).compile("t", "n", _claims())
    assert brief.hook_bank == []
    assert brief.degraded is True


def test_compile_drops_out_of_range_claim_ref():
    # claim_ref 9 is out of range for 2 claims -> should become None, not crash
    bad_hooks = json.dumps([{"type": "question", "text": "hm?", "strength": 5, "claim_ref": 9}])
    llm = SequencedLLM({
        "angle": ANGLE, "3-second scroll-stopping": bad_hooks,
        "35-55 second": SHORTS, "3-8 minute": LONGFORM, "replicable format": FORMATCARD,
    })
    brief = BriefCompiler(llm).compile("t", "n", _claims())
    assert brief.hook_bank[0].claim_ref is None


def test_compile_survives_garbage_llm_output():
    llm = SequencedLLM({
        "angle": "not json", "3-second scroll-stopping": "garbage",
        "35-55 second": "nope", "3-8 minute": "", "replicable format": "??",
    })
    brief = BriefCompiler(llm).compile("t", "n", _claims())
    # degraded but does not raise; claims still preserved
    assert brief.degraded is True
    assert len(brief.atomic_claims) == 2
