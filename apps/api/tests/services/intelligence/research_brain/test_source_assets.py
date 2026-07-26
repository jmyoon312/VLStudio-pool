"""Unit tests for the Source Asset Manager (reference collector + stock connector)."""
import json
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.source_assets import (  # noqa: E402
    ReferenceCollector, StockConnector,
)


# ── ReferenceCollector ──

def test_reference_collect_normalizes_metadata():
    ytdlp_json = json.dumps({
        "uploader": "Master Smith",
        "uploader_url": "https://youtube.com/@smith",
        "title": "Forging a katana",
        "view_count": 5_000_000,
        "like_count": 200_000,
        "comment_count": 8_000,
        "duration": 58,
        "thumbnail": "https://i.ytimg.com/x.jpg",
        "extractor_key": "Youtube",
        "automatic_captions": {"en": [{"url": "x"}]},
    })
    rc = ReferenceCollector(runner=lambda cmd, timeout=45: ytdlp_json)
    meta = rc.collect("https://youtube.com/watch?v=abc")
    assert meta["channel_name"] == "Master Smith"
    assert meta["channel_url"] == "https://youtube.com/@smith"
    assert meta["view_count"] == 5_000_000
    assert meta["platform"] == "youtube"
    assert meta["lang"] == "en"


def test_reference_collect_handles_runner_error():
    def boom(cmd, timeout=45):
        raise RuntimeError("yt-dlp exploded")
    meta = ReferenceCollector(runner=boom).collect("https://x.com/v")
    assert "error" in meta
    assert meta["url"] == "https://x.com/v"


def test_reference_collect_picks_first_json_line():
    multiline = 'warning: something\n' + json.dumps({"title": "T", "view_count": 10}) + '\n'
    rc = ReferenceCollector(runner=lambda cmd, timeout=45: multiline)
    meta = rc.collect("u")
    assert meta["title"] == "T"


def test_viral_score_engagement_and_magnitude():
    high = ReferenceCollector.compute_viral_score(
        {"view_count": 10_000_000, "like_count": 800_000, "comment_count": 50_000}
    )
    low = ReferenceCollector.compute_viral_score(
        {"view_count": 1000, "like_count": 1, "comment_count": 0}
    )
    assert high > low
    assert 0 <= high <= 100
    assert ReferenceCollector.compute_viral_score({"view_count": 0}) == 0.0


# ── StockConnector: Pexels ──

PEXELS_RESPONSE = {
    "videos": [
        {
            "url": "https://pexels.com/video/123",
            "image": "https://pexels.com/preview.jpg",
            "duration": 12,
            "user": {"name": "Jane Doe"},
            "video_files": [
                {"link": "https://dl/sd.mp4", "width": 640, "height": 360},
                {"link": "https://dl/hd.mp4", "width": 1920, "height": 1080},
            ],
        }
    ]
}


def test_pexels_search_picks_highest_resolution_and_license():
    def fake_get(url, headers=None, params=None):
        assert headers["Authorization"] == "KEY123"
        assert params["query"] == "blacksmith forge"
        return PEXELS_RESPONSE
    conn = StockConnector(pexels_key="KEY123", http_get=fake_get)
    results = conn.search("blacksmith forge", provider="pexels")
    assert len(results) == 1
    r = results[0]
    assert r["download_url"] == "https://dl/hd.mp4"  # highest width chosen
    assert r["width"] == 1920
    assert r["license"] == "Pexels License"
    assert r["attribution"] == "Jane Doe"


def test_pexels_returns_empty_without_key():
    conn = StockConnector(pexels_key="", http_get=lambda *a, **k: PEXELS_RESPONSE)
    assert conn.search("x", provider="pexels") == []


def test_pexels_handles_http_error_gracefully():
    def boom(url, headers=None, params=None):
        raise RuntimeError("429 rate limited")
    conn = StockConnector(pexels_key="KEY", http_get=boom)
    assert conn.search("x", provider="pexels") == []


# ── StockConnector: Pixabay ──

PIXABAY_RESPONSE = {
    "hits": [
        {
            "pageURL": "https://pixabay.com/v/9",
            "user": "bob",
            "duration": 20,
            "videos": {"large": {"url": "https://px/large.mp4", "width": 1920, "height": 1080}},
        }
    ]
}


def test_pixabay_search_maps_license_and_fields():
    conn = StockConnector(pixabay_key="PXKEY", http_get=lambda *a, **k: PIXABAY_RESPONSE)
    results = conn.search("anvil", provider="pixabay")
    assert results[0]["provider"] == "pixabay"
    assert results[0]["license"] == "Pixabay License"
    assert results[0]["download_url"] == "https://px/large.mp4"


def test_unsupported_provider_raises():
    import pytest
    with pytest.raises(ValueError):
        StockConnector().search("x", provider="shutterstock")
