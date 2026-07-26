"""Regression tests for the scheduler research jobs.

Covers the root-cause bug where discover_niches() crashed on a non-existent
Trend.status column, leaving the whole niche/topic/report pipeline empty.
LLM is mocked; the DB is an isolated in-memory SQLite.
"""
import json
import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)


@pytest.fixture()
def wired(monkeypatch):
    from app import database, models, crud
    import app.scheduler as sch

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    tables = [
        models.Trend.__table__, models.ResearchNiche.__table__,
        models.ResearchTopic.__table__, models.ResearchReport.__table__,
    ]
    database.Base.metadata.create_all(bind=engine, tables=tables)

    # Point the scheduler module's SessionLocal at the test DB.
    monkeypatch.setattr(sch, "SessionLocal", TestingSession)

    class _DummySettings:
        script_analysis_model = "test-model"
        agent_model = "test-model"
    monkeypatch.setattr(sch.crud, "get_settings", lambda db: _DummySettings())

    return sch, models, TestingSession


class FakeLLMClient:
    """Drop-in replacement for scheduler's LLMClient — avoids real construction."""
    _responder = staticmethod(lambda prompt, system: "[]")

    def __init__(self, settings=None):
        pass

    def generate_content(self, prompt, model_name=None, system_instruction=None, **kwargs):
        return type(self)._responder(prompt, system_instruction or "")


def _seed_trend(Session, models):
    db = Session()
    db.add(models.Trend(
        keyword="AI video", category="Tech", micro_topic="AI shorts",
        related_keywords_json=[{"ko": "에이아이", "en": "AI"}], search_volume=80,
    ))
    db.commit()
    db.close()


def test_discover_niches_does_not_crash_and_creates_niche(wired, monkeypatch):
    sch, models, Session = wired
    _seed_trend(Session, models)

    FakeLLMClient._responder = staticmethod(lambda prompt, system: json.dumps([
        {"name": "AI Shorts", "description": "d", "category": "Tech", "keywords": ["AI"]}
    ]))
    monkeypatch.setattr(sch, "LLMClient", FakeLLMClient)

    sch.discover_niches()  # must NOT raise (regression: Trend.status AttributeError)

    db = Session()
    assert db.query(models.ResearchNiche).filter(models.ResearchNiche.status == "active").count() == 1
    db.close()


def test_full_chain_discover_then_topics(wired, monkeypatch):
    sch, models, Session = wired
    _seed_trend(Session, models)

    def responder(prompt, system):
        if "Niche Analyst" in system:
            return json.dumps([{"name": "AI Shorts", "description": "d", "category": "Tech", "keywords": ["AI"]}])
        if "Research Topic Strategist" in system:
            return json.dumps([{"title": "AI 영상 트렌드", "research_question": "2026 AI 영상 트렌드?", "priority": 90}])
        return "[]"

    FakeLLMClient._responder = staticmethod(responder)
    monkeypatch.setattr(sch, "LLMClient", FakeLLMClient)

    sch.discover_niches()
    sch.generate_research_topics()

    db = Session()
    assert db.query(models.ResearchNiche).count() >= 1
    assert db.query(models.ResearchTopic).filter(models.ResearchTopic.status == "pending").count() >= 1
    db.close()


def test_discover_niches_no_trends_is_noop(wired):
    sch, models, Session = wired
    sch.discover_niches()  # no trends seeded -> should print and return, not crash
    db = Session()
    assert db.query(models.ResearchNiche).count() == 0
    db.close()


def test_execute_recovers_orphaned_topic_and_creates_report(wired, monkeypatch):
    """A stale in_progress topic (interrupted prior run) must be recovered to
    pending, then executed into a report — not stuck forever."""
    from datetime import datetime, timedelta
    sch, models, Session = wired

    db = Session()
    niche = models.ResearchNiche(name="N", status="active")
    db.add(niche); db.flush()
    t = models.ResearchTopic(
        niche_id=niche.id, title="T", research_question="q", priority=50,
        status="in_progress", scheduled_at=datetime.now() - timedelta(hours=2),
    )
    db.add(t); db.commit(); tid = t.id; db.close()

    from app.services.intelligence.research_brain.schema import (
        ProductionResearchBrief, AtomicClaim, Hook, HookType, ShortBeat, BeatRole,
        NarrativeBeats, QualityGateResult,
    )
    brief = ProductionResearchBrief(
        topic="T",
        atomic_claims=[AtomicClaim(claim="c", verified=True, source_url="https://a.com")],
        hook_bank=[Hook(type=HookType.bold_claim, text="x", strength=8)],
        narrative_beats=NarrativeBeats(shorts=[
            ShortBeat(role=BeatRole.hook, text="h", seconds=3),
            ShortBeat(role=BeatRole.point, text="p", seconds=10),
            ShortBeat(role=BeatRole.payoff, text="pay", seconds=8),
        ]),
        production_readiness=9.0, gate=QualityGateResult(status="pass"),
    )

    class FakeBrain:
        def run(self, topic, niche="General", seed_query=None):
            return brief

    import app.services.intelligence.research_brain.orchestrator as orch
    monkeypatch.setattr(orch, "build_default_brain", lambda *a, **k: FakeBrain())

    sch.execute_research_brief()

    db = Session()
    assert db.query(models.ResearchReport).count() == 1
    report = db.query(models.ResearchReport).first()
    assert report.gate_status == "pass"
    assert report.brief_json is not None
    assert db.get(models.ResearchTopic, tid).status == "completed"
    db.close()


def test_execute_no_topics_is_noop(wired):
    sch, models, Session = wired
    sch.execute_research_brief()  # nothing pending/in_progress -> no crash
    db = Session()
    assert db.query(models.ResearchReport).count() == 0
    db.close()
