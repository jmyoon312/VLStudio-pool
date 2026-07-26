"""Unit tests for the ProductionResearchBrief schema and its derived helpers.

Run: python -m pytest apps/api/tests/services/intelligence/research_brain/test_schema.py
"""
import os
import sys

import pytest
from pydantic import ValidationError

# Make `app` importable when tests are run from the repo root.
_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.schema import (  # noqa: E402
    ProductionResearchBrief,
    AtomicClaim,
    Hook,
    HookType,
    ShortBeat,
    BeatRole,
    Chapter,
    NarrativeBeats,
    Timeliness,
    TimelinessType,
)


def _claim(claim="A thing happened", verified=True, url="https://example.com/a"):
    return AtomicClaim(claim=claim, verified=verified, source_url=url, credibility=0.9)


def _ready_brief():
    return ProductionResearchBrief(
        topic="Master blacksmith",
        niche="Craftsmanship",
        atomic_claims=[_claim("Claim 1"), _claim("Claim 2", url="https://example.com/b")],
        hook_bank=[Hook(type=HookType.curiosity_gap, text="You won't believe this", strength=8.0)],
        narrative_beats=NarrativeBeats(
            shorts=[
                ShortBeat(role=BeatRole.hook, text="Hook", seconds=3),
                ShortBeat(role=BeatRole.point, text="Point 1", seconds=10),
                ShortBeat(role=BeatRole.payoff, text="Payoff", seconds=8),
            ]
        ),
    )


# ── Validation ──

def test_atomic_claim_rejects_empty_claim():
    with pytest.raises(ValidationError):
        AtomicClaim(claim="   ")


def test_atomic_claim_strips_whitespace():
    c = AtomicClaim(claim="  hello  ")
    assert c.claim == "hello"


def test_hook_rejects_empty_text():
    with pytest.raises(ValidationError):
        Hook(type=HookType.bold_claim, text="")


def test_credibility_bounds_enforced():
    with pytest.raises(ValidationError):
        AtomicClaim(claim="x", credibility=1.5)


def test_hook_strength_bounds_enforced():
    with pytest.raises(ValidationError):
        Hook(type=HookType.question, text="why?", strength=99)


def test_timeliness_velocity_bounds():
    with pytest.raises(ValidationError):
        Timeliness(type=TimelinessType.timely, trend_velocity=2.0)


# ── Derived helpers ──

def test_verified_claim_count():
    b = ProductionResearchBrief(
        topic="t",
        atomic_claims=[_claim(verified=True), _claim(verified=False), _claim(verified=True)],
    )
    assert b.verified_claim_count() == 2


def test_best_hook_picks_highest_strength():
    b = ProductionResearchBrief(
        topic="t",
        hook_bank=[
            Hook(type=HookType.question, text="a", strength=3.0),
            Hook(type=HookType.bold_claim, text="b", strength=9.5),
            Hook(type=HookType.micro_story, text="c", strength=7.0),
        ],
    )
    assert b.best_hook().text == "b"


def test_best_hook_none_when_empty():
    assert ProductionResearchBrief(topic="t").best_hook() is None


def test_structurally_ready_true_for_complete_brief():
    assert _ready_brief().is_structurally_ready() is True


def test_not_ready_when_too_few_verified_claims():
    b = _ready_brief()
    b.atomic_claims = [_claim("only one")]
    assert b.is_structurally_ready() is False


def test_not_ready_when_no_hooks():
    b = _ready_brief()
    b.hook_bank = []
    assert b.is_structurally_ready() is False


def test_not_ready_when_fewer_than_three_short_beats():
    b = _ready_brief()
    b.narrative_beats.shorts = b.narrative_beats.shorts[:2]
    assert b.is_structurally_ready() is False


def test_not_ready_when_no_hook_beat():
    b = _ready_brief()
    b.narrative_beats.shorts = [
        ShortBeat(role=BeatRole.point, text="p1", seconds=10),
        ShortBeat(role=BeatRole.point, text="p2", seconds=10),
        ShortBeat(role=BeatRole.payoff, text="pay", seconds=8),
    ]
    assert b.is_structurally_ready() is False


def test_not_ready_when_verified_claim_missing_source():
    b = _ready_brief()
    b.atomic_claims = [
        AtomicClaim(claim="no source", verified=True, source_url=""),
        _claim("has source"),
    ]
    assert b.is_structurally_ready() is False


def test_min_verified_claims_param_is_respected():
    b = _ready_brief()
    # has exactly 2 verified claims -> requiring 3 should fail
    assert b.is_structurally_ready(min_verified_claims=3) is False


# ── Serialization round-trip (used for DB brief_json storage) ──

def test_json_round_trip_preserves_structure():
    b = _ready_brief()
    dumped = b.model_dump_json()
    restored = ProductionResearchBrief.model_validate_json(dumped)
    assert restored.topic == b.topic
    assert restored.verified_claim_count() == 2
    assert restored.best_hook().strength == 8.0
    assert restored.is_structurally_ready() is True
