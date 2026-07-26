"""Unit tests for Stage C — QualityGate."""
import json
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.quality_gate import QualityGate  # noqa: E402
from app.services.intelligence.research_brain.schema import (  # noqa: E402
    ProductionResearchBrief, AtomicClaim, Hook, HookType, ShortBeat, BeatRole, NarrativeBeats,
)


class FakeLLM:
    def __init__(self, response=""):
        self.response = response
        self.called = 0

    def generate_content(self, prompt, model_name=None, system_instruction=None, **kwargs):
        self.called += 1
        return self.response


def _ready_brief():
    return ProductionResearchBrief(
        topic="Master blacksmith",
        atomic_claims=[
            AtomicClaim(claim="Forge hits 1300C", exact_stat="1300C", verified=True, source_url="https://a.com"),
            AtomicClaim(claim="37 years", exact_stat="37y", verified=True, source_url="https://b.com"),
        ],
        hook_bank=[Hook(type=HookType.curiosity_gap, text="Watch step 3", strength=8.0)],
        narrative_beats=NarrativeBeats(shorts=[
            ShortBeat(role=BeatRole.hook, text="Hook", seconds=3),
            ShortBeat(role=BeatRole.point, text="P1", seconds=10),
            ShortBeat(role=BeatRole.payoff, text="Pay", seconds=8),
        ]),
    )


# ── Hard gate ──

def test_hard_gate_passes_for_ready_brief():
    gate = QualityGate(FakeLLM())
    assert gate.hard_gate(_ready_brief()) == []


def test_hard_gate_fails_too_few_verified_claims():
    b = _ready_brief()
    b.atomic_claims = [b.atomic_claims[0]]
    reasons = QualityGate(FakeLLM()).hard_gate(b)
    assert any("verified_claims" in r for r in reasons)


def test_hard_gate_fails_no_hooks():
    b = _ready_brief()
    b.hook_bank = []
    assert any("no hooks" in r for r in QualityGate(FakeLLM()).hard_gate(b))


def test_hard_gate_fails_invalid_source_url():
    b = _ready_brief()
    b.atomic_claims[0].source_url = "not-a-url"
    assert any("source url" in r for r in QualityGate(FakeLLM()).hard_gate(b))


# ── evaluate(): hard gate short-circuits the LLM ──

def test_evaluate_rejects_without_calling_llm_on_hard_failure():
    b = _ready_brief()
    b.hook_bank = []
    llm = FakeLLM(json.dumps({"hook_strength": 10, "content_clarity": 10, "faithfulness": 10}))
    QualityGate(llm).evaluate(b)
    assert b.gate.status == "reject"
    assert b.gate.hard_gate_passed is False
    assert llm.called == 0  # fail-fast, no LLM spend
    assert b.production_readiness == 0.0


# ── Rubric scoring & classification ──

def test_evaluate_pass_high_scores():
    llm = FakeLLM(json.dumps({"hook_strength": 9, "content_clarity": 9, "faithfulness": 9, "reason": "great"}))
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.gate.status == "pass"
    assert b.production_readiness == 9.0


def test_evaluate_review_mid_scores():
    llm = FakeLLM(json.dumps({"hook_strength": 7, "content_clarity": 7, "faithfulness": 7}))
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.gate.status == "review"
    assert 6.5 <= b.production_readiness < 8.5


def test_evaluate_reject_low_scores():
    llm = FakeLLM(json.dumps({"hook_strength": 3, "content_clarity": 4, "faithfulness": 2}))
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.gate.status == "reject"


def test_grader_parse_failure_routes_to_review_not_pass():
    llm = FakeLLM("the script looks amazing, 10/10!")  # not JSON
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.gate.status == "review"
    assert "grader parse failure" in b.gate.reasons


def test_rubric_clamps_out_of_range_scores():
    llm = FakeLLM(json.dumps({"hook_strength": 99, "content_clarity": -5, "faithfulness": 8}))
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.gate.hook_strength == 10.0
    assert b.gate.content_clarity == 0.0


def test_weighting_formula():
    # readiness = 0.4*hook + 0.3*faith + 0.3*clarity
    llm = FakeLLM(json.dumps({"hook_strength": 10, "content_clarity": 0, "faithfulness": 0}))
    b = QualityGate(llm).evaluate(_ready_brief())
    assert b.production_readiness == 4.0
