"""Source Asset Manager.

Two responsibilities, both kept strictly on the legal side of the line:

1. ReferenceCollector — given a public video URL, pull channel info, link and
   metadata + auto-transcript (via yt-dlp `--dump-json`). We store the LINK and
   METADATA for format analysis; we do NOT redistribute the source media.

2. StockConnector — search/download production b-roll from LEGAL providers
   (Pexels, Pixabay) and record license + attribution per asset.

HTTP and subprocess calls are injected (`http_get`, `runner`) so the logic is
unit-testable without the network.
"""
from __future__ import annotations

import json
import logging
import subprocess
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Reference video collection (metadata + transcript only) ──

def _default_runner(cmd: List[str], timeout: int = 45) -> str:
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=timeout
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[:300])
    return proc.stdout


class ReferenceCollector:
    """Collects link + metadata + transcript for a reference video. No media download."""

    def __init__(self, runner: Optional[Callable[..., str]] = None):
        self.runner = runner or _default_runner

    def collect(self, url: str) -> Dict:
        """Return a normalized metadata dict for a public video URL."""
        try:
            raw = self.runner([
                "yt-dlp", "--dump-json", "--no-playlist",
                "--write-auto-sub", "--skip-download", url,
            ])
        except Exception as e:
            logger.warning(f"[ReferenceCollector] yt-dlp failed for {url}: {e}")
            return {"url": url, "error": str(e)[:200]}

        # yt-dlp may print one JSON object per line; take the first valid one.
        data = {}
        for line in raw.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                data = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
        if not data:
            return {"url": url, "error": "no metadata"}

        return self._normalize(url, data)

    @staticmethod
    def _normalize(url: str, data: Dict) -> Dict:
        subs = data.get("subtitles") or data.get("automatic_captions") or {}
        lang = next(iter(subs.keys()), "") if isinstance(subs, dict) else ""
        return {
            "url": url,
            "platform": (data.get("extractor_key") or "youtube").lower(),
            "channel_name": data.get("uploader") or data.get("channel") or "",
            "channel_url": data.get("uploader_url") or data.get("channel_url") or "",
            "title": data.get("title") or "",
            "view_count": int(data.get("view_count") or 0),
            "like_count": int(data.get("like_count") or 0),
            "comment_count": int(data.get("comment_count") or 0),
            "duration": int(data.get("duration") or 0),
            "thumbnail_url": data.get("thumbnail") or "",
            "lang": lang,
            "description": (data.get("description") or "")[:2000],
        }

    @staticmethod
    def compute_viral_score(meta: Dict) -> float:
        """Outlier signal: engagement + view magnitude, normalized 0-100.
        Cheap heuristic computed from metadata only."""
        views = max(0, meta.get("view_count", 0))
        likes = max(0, meta.get("like_count", 0))
        comments = max(0, meta.get("comment_count", 0))
        if views == 0:
            return 0.0
        engagement = (likes + comments) / views  # typically 0.0 - 0.1
        # log-ish view magnitude: 1M views ~ 60, 10M ~ 70
        import math
        view_mag = min(70.0, 10.0 * math.log10(views + 1))
        score = view_mag + min(30.0, engagement * 300.0)
        return round(min(100.0, score), 1)


# ── Legal stock connectors ──

class StockConnector:
    """Search + (optionally) download legal stock video/photo with license tracking."""

    PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"
    PIXABAY_URL = "https://pixabay.com/api/videos/"

    def __init__(
        self,
        pexels_key: str = "",
        pixabay_key: str = "",
        http_get: Optional[Callable] = None,
    ):
        self.pexels_key = pexels_key
        self.pixabay_key = pixabay_key
        self._http_get = http_get  # injected for tests; falls back to requests

    def _get(self, url: str, headers=None, params=None) -> Dict:
        if self._http_get is not None:
            return self._http_get(url, headers=headers, params=params)
        import requests
        res = requests.get(url, headers=headers or {}, params=params or {}, timeout=20)
        res.raise_for_status()
        return res.json()

    def search(self, query: str, provider: str = "pexels", per_page: int = 5,
               orientation: str = "portrait") -> List[Dict]:
        if provider == "pexels":
            return self._search_pexels(query, per_page, orientation)
        if provider == "pixabay":
            return self._search_pixabay(query, per_page)
        raise ValueError(f"unsupported provider: {provider}")

    def _search_pexels(self, query: str, per_page: int, orientation: str) -> List[Dict]:
        if not self.pexels_key:
            return []
        try:
            data = self._get(
                self.PEXELS_VIDEO_URL,
                headers={"Authorization": self.pexels_key},
                params={"query": query, "per_page": per_page, "orientation": orientation},
            )
        except Exception as e:
            logger.warning(f"[StockConnector] Pexels search failed: {e}")
            return []
        out = []
        for v in (data.get("videos") or []):
            files = v.get("video_files") or []
            best = max(files, key=lambda f: f.get("width", 0)) if files else {}
            out.append({
                "provider": "pexels",
                "source_url": v.get("url", ""),
                "preview_url": (v.get("image") or ""),
                "download_url": best.get("link", ""),
                "media_type": "video",
                "license": "Pexels License",
                "attribution": (v.get("user") or {}).get("name", ""),
                "query": query,
                "duration": int(v.get("duration") or 0),
                "width": int(best.get("width") or 0),
                "height": int(best.get("height") or 0),
            })
        return out

    def _search_pixabay(self, query: str, per_page: int) -> List[Dict]:
        if not self.pixabay_key:
            return []
        try:
            data = self._get(
                self.PIXABAY_URL,
                params={"key": self.pixabay_key, "q": query, "per_page": max(3, per_page)},
            )
        except Exception as e:
            logger.warning(f"[StockConnector] Pixabay search failed: {e}")
            return []
        out = []
        for v in (data.get("hits") or []):
            videos = v.get("videos") or {}
            large = videos.get("large") or videos.get("medium") or {}
            out.append({
                "provider": "pixabay",
                "source_url": v.get("pageURL", ""),
                "preview_url": "",
                "download_url": large.get("url", ""),
                "media_type": "video",
                "license": "Pixabay License",
                "attribution": v.get("user", ""),
                "query": query,
                "duration": int(v.get("duration") or 0),
                "width": int(large.get("width") or 0),
                "height": int(large.get("height") or 0),
            })
        return out
