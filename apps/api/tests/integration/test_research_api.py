"""Integration tests for the Research Brain API endpoints.

Builds a minimal FastAPI app with only the research router, an in-memory SQLite
DB, and monkeypatched external calls (yt-dlp / stock HTTP / brain).
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)


@pytest.fixture()
def client(monkeypatch):
    from app import database, models, crud
    from app.routers import research

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine)
    # Create only the tables we need (other models use pgvector types that
    # SQLite cannot create).
    tables = [
        models.Trend.__table__,
        models.ResearchReport.__table__, models.ResearchNiche.__table__,
        models.ResearchTopic.__table__, models.ReferenceVideo.__table__,
        models.SourceAsset.__table__,
    ]
    database.Base.metadata.create_all(bind=engine, tables=tables)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    # Avoid touching the real settings table / API keys.
    class _DummySettings:
        pexels_api_keys = []
        pixabay_api_keys = []
    monkeypatch.setattr(crud, "get_settings", lambda db: _DummySettings())

    app = FastAPI()
    app.include_router(research.router, prefix="/api")
    app.dependency_overrides[database.get_db] = override_get_db

    return TestClient(app), research, TestingSession, models


def test_reference_video_lifecycle(client, monkeypatch):
    c, research, _, _ = client
    from app.services.intelligence.research_brain import source_assets

    monkeypatch.setattr(
        source_assets.ReferenceCollector, "collect",
        lambda self, url: {
            "url": url, "platform": "youtube", "channel_name": "Master Smith",
            "channel_url": "https://yt/@smith", "title": "Forging", "view_count": 4_000_000,
            "like_count": 100_000, "comment_count": 3000, "duration": 50,
            "thumbnail_url": "https://t.jpg", "lang": "en",
        },
    )

    # create
    r = c.post("/api/research/reference-videos", json={"url": "https://yt/v1", "niche": "Craft"})
    assert r.status_code == 200, r.text
    vid_id = r.json()["id"]
    assert r.json()["channel_name"] == "Master Smith"
    assert r.json()["viral_score"] > 0

    # list
    r = c.get("/api/research/reference-videos")
    assert len(r.json()) == 1
    assert r.json()[0]["view_count"] == 4_000_000

    # delete
    r = c.delete(f"/api/research/reference-videos/{vid_id}")
    assert r.status_code == 200
    assert c.get("/api/research/reference-videos").json() == []


def test_reference_video_collect_error_returns_422(client, monkeypatch):
    c, _, _, _ = client
    from app.services.intelligence.research_brain import source_assets
    monkeypatch.setattr(
        source_assets.ReferenceCollector, "collect",
        lambda self, url: {"url": url, "error": "yt-dlp failed"},
    )
    r = c.post("/api/research/reference-videos", json={"url": "https://bad"})
    assert r.status_code == 422


def test_source_asset_search_empty_without_keys(client):
    c, _, _, _ = client
    r = c.post("/api/research/source-assets/search", json={"query": "blacksmith"})
    assert r.status_code == 200
    assert r.json()["results"] == []  # no API key configured -> empty, no crash


def test_source_asset_search_with_monkeypatched_connector(client, monkeypatch):
    c, research, _, _ = client
    from app.services.intelligence.research_brain.source_assets import StockConnector

    monkeypatch.setattr(
        StockConnector, "search",
        lambda self, query, provider="pexels", per_page=6, orientation="portrait": [
            {"provider": "pexels", "source_url": "https://px/1", "download_url": "https://dl/1.mp4",
             "license": "Pexels License", "attribution": "Jane", "query": query, "width": 1920}
        ],
    )
    r = c.post("/api/research/source-assets/search", json={"query": "anvil", "provider": "pexels"})
    assert r.status_code == 200
    assert r.json()["results"][0]["license"] == "Pexels License"


def test_source_asset_save_and_list(client):
    c, _, _, _ = client
    payload = {
        "provider": "pexels", "source_url": "https://px/9", "license": "Pexels License",
        "attribution": "Bob", "query": "forge", "width": 1080, "height": 1920,
    }
    r = c.post("/api/research/source-assets", json=payload)
    assert r.status_code == 200
    r = c.get("/api/research/source-assets")
    assert len(r.json()) == 1
    assert r.json()[0]["attribution"] == "Bob"


def test_get_brief_404_when_missing(client):
    c, _, _, _ = client
    assert c.get("/api/research/briefs/999").status_code == 404


def _stub_jobs(monkeypatch):
    """No-op the scheduler jobs so the endpoint's real (harmless) background
    thread does nothing. We patch the jobs, NOT threading.Thread — patching
    threading globally breaks Starlette's TestClient."""
    import app.scheduler as sch
    for fn in ("discover_niches", "generate_research_topics", "execute_research_brief"):
        monkeypatch.setattr(sch, fn, lambda *a, **k: None)


def test_topic_generation_trigger_reports_empty_state(client, monkeypatch):
    c, research, _, _ = client
    _stub_jobs(monkeypatch)
    # No trends, no niches -> message should tell the user to collect trends first.
    r = c.post("/api/research/topics/generate")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "started"
    assert body["niche_count"] == 0
    assert body["trend_count"] == 0
    assert "트렌드" in body["message"]


def test_research_trigger_bootstraps_when_empty(client, monkeypatch):
    c, research, Session, models = client
    _stub_jobs(monkeypatch)
    r = c.post("/api/research/trigger")
    assert r.status_code == 200
    body = r.json()
    assert body["pending_topics"] == 0
    # message indicates the full bootstrap chain will run
    assert "니치 발견" in body["message"] or "트렌드" in body["message"]


def test_research_trigger_targets_specific_topic_via_query_param(client, monkeypatch):
    c, research, Session, models = client
    _stub_jobs(monkeypatch)
    # Seed a niche + topic.
    db = Session()
    niche = models.ResearchNiche(name="N", description="", status="active")
    db.add(niche); db.flush()
    topic = models.ResearchTopic(niche_id=niche.id, title="T", research_question="q",
                                 priority=10, status="pending")
    db.add(topic); db.commit()
    tid = topic.id
    db.close()

    r = c.post(f"/api/research/trigger?topic_id={tid}")
    assert r.status_code == 200
    assert f"#{tid}" in r.json()["message"]
    # the targeted topic is forced to high priority
    db = Session()
    assert db.get(models.ResearchTopic, tid).priority == 100
    db.close()


def test_deep_research_trigger_starts(client, monkeypatch):
    c, research, Session, _ = client
    # Background thread uses app.database.SessionLocal + build_default_brain;
    # point the session at the test DB and make brain construction a no-op-raise
    # so the thread does no real work / network.
    import app.database as database_mod
    monkeypatch.setattr(database_mod, "SessionLocal", Session)
    import app.services.intelligence.research_brain.orchestrator as orch
    monkeypatch.setattr(orch, "build_default_brain",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("stubbed")))
    r = c.post("/api/research/brief/deep", json={"topic": "Master blacksmith", "niche": "Craft"})
    assert r.status_code == 200
    assert r.json()["status"] == "started"
