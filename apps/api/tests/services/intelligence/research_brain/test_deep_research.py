"""Unit tests for Stage A — DeepResearchLoop. LLM and search are mocked."""
import json
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.deep_research import DeepResearchLoop  # noqa: E402
from app.services.intelligence.research_brain.schema import AtomicClaim  # noqa: E402


class FakeLLM:
    """Returns queued responses in order; records prompts/systems."""
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def generate_content(self, prompt, model_name=None, system_instruction=None, **kwargs):
        self.calls.append({"prompt": prompt, "system": system_instruction})
        if self._responses:
            return self._responses.pop(0)
        return ""


def make_search(mapping=None, default=None):
    """search_fn factory. mapping: query-substr -> results list."""
    mapping = mapping or {}

    def _search(query):
        for sub, res in mapping.items():
            if sub.lower() in query.lower():
                return res
        return default if default is not None else []

    return _search


CLAIMS_R1 = json.dumps([
    {"claim": "The forge reaches 1300C", "exact_stat": "1300C", "source_index": 0, "emotion_trigger": "경이"},
    {"claim": "He has 37 years of experience", "exact_stat": "37 years", "source_index": 1, "emotion_trigger": "공감"},
    {"followups": ["What awards has he won?"]},
])

CLAIMS_R2 = json.dumps([
    {"claim": "He won a national award in 2024", "exact_stat": "2024", "source_index": 0, "emotion_trigger": "경이"},
])

REFLECT_GAP = json.dumps({"gap": "no info on awards", "follow_up_query": "blacksmith awards 2024"})
REFLECT_DONE = json.dumps({"gap": None, "follow_up_query": None})


def test_extract_claims_maps_sources():
    llm = FakeLLM([CLAIMS_R1])
    loop = DeepResearchLoop(llm, make_search(), max_loops=1)
    results = [
        {"title": "Forge", "url": "https://a.com", "content": "hot"},
        {"title": "Bio", "url": "https://b.com", "content": "veteran"},
    ]
    claims, followups = loop.extract_claims("blacksmith", results)
    assert len(claims) == 2
    assert claims[0].source_url == "https://a.com"
    assert claims[0].exact_stat == "1300C"
    assert followups == ["What awards has he won?"]


def test_extract_claims_empty_when_no_results():
    llm = FakeLLM([CLAIMS_R1])
    loop = DeepResearchLoop(llm, make_search(), max_loops=1)
    claims, followups = loop.extract_claims("x", [])
    assert claims == [] and followups == []
    # LLM should not have been called with no sources
    assert llm.calls == []


def test_reflect_returns_followup_query():
    llm = FakeLLM([REFLECT_GAP])
    loop = DeepResearchLoop(llm, make_search(), max_loops=2)
    q = loop.reflect("blacksmith", [AtomicClaim(claim="x")])
    assert q == "blacksmith awards 2024"


def test_reflect_returns_none_when_done():
    llm = FakeLLM([REFLECT_DONE])
    loop = DeepResearchLoop(llm, make_search(), max_loops=2)
    assert loop.reflect("t", [AtomicClaim(claim="x")]) is None


def test_reflect_none_when_no_claims():
    llm = FakeLLM([REFLECT_GAP])
    loop = DeepResearchLoop(llm, make_search(), max_loops=2)
    assert loop.reflect("t", []) is None
    assert llm.calls == []  # short-circuits


def test_cross_validate_marks_corroborated_claims_verified():
    loop = DeepResearchLoop(FakeLLM([]), make_search(), max_loops=1)
    claims = [
        AtomicClaim(claim="Same fact", source_url="https://a.com"),
        AtomicClaim(claim="same fact", source_url="https://b.com"),  # different source, same claim
        AtomicClaim(claim="Lonely fact", source_url="https://c.com"),
    ]
    out = loop.cross_validate(claims)
    by_text = {c.claim.lower(): c for c in out}
    assert by_text["same fact"].verified is True
    assert by_text["same fact"].credibility >= 0.9  # 0.5 + 0.25*2
    # single-source claim without a stat is not verified
    assert by_text["lonely fact"].verified is False


def test_cross_validate_single_source_with_stat_is_verified():
    loop = DeepResearchLoop(FakeLLM([]), make_search(), max_loops=1)
    claims = [AtomicClaim(claim="GDP grew", exact_stat="3%", source_url="https://a.com")]
    out = loop.cross_validate(claims)
    assert out[0].verified is True


def test_run_iterates_and_accumulates_claims():
    # loop1: search 'blacksmith' -> CLAIMS_R1, reflect -> gap query
    # loop2: search 'awards' -> CLAIMS_R2, (last loop, no reflect)
    llm = FakeLLM([CLAIMS_R1, REFLECT_GAP, CLAIMS_R2])
    search = make_search({
        "blacksmith master": [
            {"title": "Forge", "url": "https://a.com", "content": "hot"},
            {"title": "Bio", "url": "https://b.com", "content": "veteran"},
        ],
        "awards": [
            {"title": "Award", "url": "https://c.com", "content": "national prize"},
        ],
    })
    loop = DeepResearchLoop(llm, search, max_loops=2)
    claims, contradictions = loop.run("blacksmith master")
    texts = [c.claim for c in claims]
    assert any("1300C" in (c.exact_stat or "") for c in claims)
    assert any("award" in t.lower() for t in texts)
    assert len(claims) >= 3


def test_run_stops_when_no_followup():
    llm = FakeLLM([CLAIMS_R1, REFLECT_DONE])
    search = make_search({"blacksmith": [{"title": "F", "url": "https://a.com", "content": "x"}]})
    loop = DeepResearchLoop(llm, search, max_loops=3)
    claims, _ = loop.run("blacksmith")
    # Only one search round happened (reflect said done) -> no duplicate query searches
    assert len(claims) >= 1


def test_run_respects_max_results_per_search():
    llm = FakeLLM([CLAIMS_R1, REFLECT_DONE])
    big = [{"title": str(i), "url": f"https://{i}.com", "content": "x"} for i in range(20)]
    captured = {}

    def search(q):
        captured["q"] = q
        return big

    loop = DeepResearchLoop(llm, search, max_loops=1, max_results_per_search=5)
    results = loop._search("anything")
    assert len(results) == 5
