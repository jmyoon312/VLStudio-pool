"""Integration test — full ResearchBrain pipeline (A -> B -> C) with mocked
LLM and search, verifying the stages combine into a production-ready brief."""
import json
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.orchestrator import ResearchBrain  # noqa: E402


# ── Mocked model: routes by a marker in the system prompt ──

CLAIMS = json.dumps([
    {"claim": "The forge reaches 1300C", "exact_stat": "1300C", "source_index": 0, "emotion_trigger": "경이"},
    {"claim": "He has 37 years of experience", "exact_stat": "37 years", "source_index": 1, "emotion_trigger": "공감"},
])
REFLECT_DONE = json.dumps({"gap": None, "follow_up_query": None})
ANGLE = json.dumps({"angle": "Why he's the world's best", "promise": "Mastery in 40 seconds"})
HOOKS = json.dumps([
    {"type": "curiosity_gap", "text": "You won't believe step 3", "strength": 9, "claim_ref": 0},
    {"type": "bold_claim", "text": "World's greatest blacksmith", "strength": 8, "claim_ref": 1},
])
SHORTS = json.dumps([
    {"role": "hook", "text": "Watch this", "seconds": 3, "claim_ref": 0},
    {"role": "point", "text": "1300 degrees of heat", "seconds": 10, "claim_ref": 0},
    {"role": "point", "text": "37 years of mastery", "seconds": 10, "claim_ref": 1},
    {"role": "payoff", "text": "A perfect blade", "seconds": 8},
    {"role": "loop", "text": "That's step 3", "seconds": 3},
])
LONGFORM = json.dumps([
    {"index": 1, "title": "Origins", "beat": "his start", "rehook": "but then", "seconds": 80, "broll_query": "blacksmith forge"},
    {"index": 2, "title": "Craft", "beat": "the method", "rehook": "the secret next", "seconds": 85, "broll_query": "anvil sparks"},
])
FORMATCARD = json.dumps({
    "hook_type": "curiosity_gap",
    "story_arc": ["raw iron", "forging", "the reveal"],
    "source_replacement_query": "knife making artisan",
})
RUBRIC = json.dumps({"hook_strength": 9, "content_clarity": 9, "faithfulness": 9, "reason": "strong"})


class SmartFakeLLM:
    def generate_content(self, prompt, model_name=None, system_instruction=None, **kwargs):
        s = (system_instruction or "").lower()
        if "extracting atomic" in s:
            return CLAIMS
        if "research supervisor" in s:
            return REFLECT_DONE
        if "decide the single strongest angle" in s:
            return ANGLE
        if "3-second scroll-stopping" in s:
            return HOOKS
        if "35-55 second" in s:
            return SHORTS
        if "3-8 minute" in s:
            return LONGFORM
        if "replicable format" in s:
            return FORMATCARD
        if "quality judge" in s:
            return RUBRIC
        return ""


def make_search():
    sources = [
        {"title": "Forge specs", "url": "https://a.com", "content": "The forge runs at 1300C"},
        {"title": "Master bio", "url": "https://b.com", "content": "37 years at the anvil"},
    ]
    return lambda q: sources


def test_full_pipeline_produces_passing_brief():
    brain = ResearchBrain(SmartFakeLLM(), make_search(), max_loops=2)
    brief = brain.run("Master blacksmith", niche="Craftsmanship")

    # Stage A
    assert brief.verified_claim_count() >= 2
    # Stage B
    assert brief.angle == "Why he's the world's best"
    assert len(brief.hook_bank) == 2
    assert len(brief.narrative_beats.shorts) == 5
    assert len(brief.narrative_beats.longform) == 2
    assert len(brief.broll_cues) == 2
    assert brief.format_card.source_replacement_query == "knife making artisan"
    # Stage C
    assert brief.gate.status == "pass"
    assert brief.production_readiness == 9.0
    assert brief.is_structurally_ready() is True


def test_pipeline_json_serializable_for_db_storage():
    brain = ResearchBrain(SmartFakeLLM(), make_search(), max_loops=1)
    brief = brain.run("Master blacksmith", niche="Craftsmanship")
    dumped = brief.model_dump_json()
    assert "atomic_claims" in dumped
    # round-trips
    from app.services.intelligence.research_brain.schema import ProductionResearchBrief
    restored = ProductionResearchBrief.model_validate_json(dumped)
    assert restored.topic == "Master blacksmith"


def test_pipeline_rejects_when_no_search_results():
    brain = ResearchBrain(SmartFakeLLM(), lambda q: [], max_loops=2)
    brief = brain.run("Empty topic")
    # No claims -> hard gate rejects, no crash
    assert brief.gate.status == "reject"
    assert brief.gate.hard_gate_passed is False
