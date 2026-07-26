import logging
import random
import requests
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from ddgs import DDGS
    HAS_DDG = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        HAS_DDG = True
    except ImportError:
        HAS_DDG = False
        logger.warning("duckduckgo_search not installed. Run: pip install duckduckgo_search")

SEARXNG_INSTANCES = [
    "https://searx.work/search",
    "https://searx.be/search",
    "https://searxng.site/search",
    "https://priv.au/search",
    "https://searx.org/search",
    "https://search.md4.org/search"
]

MOCK_IMAGES = [
    "https://images.unsplash.com/photo-1546422904-90eab23c3d7e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80"
]

class WebSearchTool:
    def __init__(self, api_key: Optional[str] = None):
        pass

    def search(self, query: str, include_images: bool = False, db: Session = None, settings=None, time_range: str = "week") -> Dict[str, Any]:
        result = self._search_ddg(query)
        if result:
            return result

        result = self._search_searxng(query)
        if result:
            return result

        return self._get_mock_results(query, include_images, "DuckDuckGo and SearXNG both failed.")

    def _search_ddg(self, query: str) -> Optional[Dict[str, Any]]:
        if not HAS_DDG:
            return None
        try:
            logger.info(f"🔍 [DDG] Searching for '{query}'...")
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
                if not results:
                    return None
                formatted = []
                for r in results:
                    formatted.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "content": r.get("body", ""),
                        "score": 0.9
                    })
                logger.info(f"✅ [DDG] Found {len(formatted)} results.")
                return {
                    "summary": formatted[0]["content"][:200] if formatted else "",
                    "results": formatted,
                    "images": []
                }
        except Exception as e:
            logger.warning(f"❌ [DDG] Failed: {e}")
            return None

    def _search_searxng(self, query: str) -> Optional[Dict[str, Any]]:
        for instance in SEARXNG_INSTANCES:
            try:
                logger.info(f"🔍 [SearXNG] Trying {instance}...")
                resp = requests.get(instance, params={"q": query, "format": "json", "categories": "general"}, timeout=8)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                results = data.get("results", [])[:5]
                if not results:
                    continue
                formatted = []
                for r in results:
                    formatted.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "content": r.get("content", ""),
                        "score": r.get("score", 0.5)
                    })
                logger.info(f"✅ [SearXNG] {instance} returned {len(formatted)} results.")
                return {
                    "summary": formatted[0]["content"][:200] if formatted else "",
                    "results": formatted,
                    "images": []
                }
            except Exception as e:
                logger.warning(f"❌ [SearXNG] {instance} failed: {e}")
                continue
        return None

    def _get_mock_results(self, query: str, include_images: bool, error_msg: str = "") -> Dict[str, Any]:
        logger.info(f"🔍 [Mock] All backends failed. Returning mock for '{query}'")
        return {
            "summary": f"This is a mock summary for '{query}'. {error_msg}",
            "results": [
                {"title": f"Mock Result 1 for {query}", "url": "https://example.com/1", "content": "This is mock content for testing.", "score": 0.95},
                {"title": f"Mock Result 2 for {query}", "url": "https://example.com/2", "content": "Another mock result content.", "score": 0.88}
            ],
            "images": MOCK_IMAGES if include_images else []
        }

tool_manager = WebSearchTool()
