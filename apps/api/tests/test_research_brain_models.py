"""Verify Research Brain DB models create and persist against SQLite."""
import os
import sys

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)


@pytest.fixture()
def db():
    from app.database import Base
    from app import models  # noqa: F401  (populate metadata)

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session, engine
    session.close()


def test_research_report_has_brief_columns(db):
    _, engine = db
    cols = {c["name"] for c in inspect(engine).get_columns("research_reports")}
    assert {"brief_json", "research_depth", "production_readiness", "gate_status"} <= cols


def test_reference_videos_table_created(db):
    _, engine = db
    assert inspect(engine).has_table("reference_videos")
    cols = {c["name"] for c in inspect(engine).get_columns("reference_videos")}
    assert {"url", "channel_name", "channel_url", "transcript", "format_card_json"} <= cols


def test_source_assets_table_created(db):
    _, engine = db
    assert inspect(engine).has_table("source_assets")
    cols = {c["name"] for c in inspect(engine).get_columns("source_assets")}
    assert {"provider", "license", "attribution", "local_path"} <= cols


def test_persist_reference_video(db):
    session, _ = db
    from app import models

    rv = models.ReferenceVideo(
        url="https://youtube.com/watch?v=abc",
        platform="youtube",
        channel_name="Master Smith",
        view_count=5_000_000,
        niche="Craftsmanship",
        format_card_json={"hook_type": "curiosity_gap", "story_arc": ["a", "b"]},
    )
    session.add(rv)
    session.commit()
    fetched = session.query(models.ReferenceVideo).first()
    assert fetched.view_count == 5_000_000
    assert fetched.format_card_json["hook_type"] == "curiosity_gap"


def test_persist_source_asset(db):
    session, _ = db
    from app import models

    a = models.SourceAsset(
        provider="pexels",
        source_url="https://pexels.com/video/123",
        license="Pexels License",
        attribution="John Doe",
        query="blacksmith forge",
        media_type="video",
    )
    session.add(a)
    session.commit()
    fetched = session.query(models.SourceAsset).first()
    assert fetched.provider == "pexels"
    assert fetched.license == "Pexels License"
