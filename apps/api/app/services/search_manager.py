import logging
import requests
from typing import Optional

logger = logging.getLogger("viral_loop.search")

class SearchEngine:
    TAVILY = "tavily"
    SEARXNG = "searxng"
    AUTO = "auto"

class SearchManager:
    def __init__(self):
        pass

    def search(self, query: str, engine: str = "auto", config: dict = None) -> dict:
        if not config:
            config = {}

        result = self._try_searxng(query, config.get("searxng_url"))
        if result:
            return result

        result = self._try_tavily(query, config.get("tavily_key"))
        if result:
            return result

        return self._mock(query)

    def _try_searxng(self, query: str, url: Optional[str]) -> Optional[dict]:
        instances = [url] if url else [
            "https://searx.work/search",
            "https://searx.be/search",
            "https://searxng.site/search",
        ]
        for instance in instances:
            if not instance:
                continue
            try:
                resp = requests.get(instance, params={"q": query, "format": "json"}, timeout=8)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                results = []
                for r in data.get("results", [])[:5]:
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "content": r.get("content", ""),
                        "score": r.get("score", 0.5)
                    })
                if results:
                    logger.info(f"✅ [SearchManager/SearXNG] {instance} returned {len(results)} results")
                    return {"results": results, "answer": results[0]["content"][:200], "source": "SearXNG"}
            except Exception as e:
                logger.debug(f"[SearchManager/SearXNG] {instance} failed: {e}")
        return None

    def _try_tavily(self, query: str, api_key: Optional[str]) -> Optional[dict]:
        if not api_key:
            return None
        try:
            payload = {"api_key": api_key, "query": query, "search_depth": "basic", "max_results": 5}
            resp = requests.post("https://api.tavily.com/search", json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for r in data.get("results", [])[:5]:
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "content": r.get("content", ""),
                        "score": r.get("score", 0.9)
                    })
                logger.info(f"✅ [SearchManager/Tavily] Found {len(results)} results")
                return {"results": results, "answer": data.get("answer", ""), "source": "Tavily"}
        except Exception as e:
            logger.warning(f"[SearchManager/Tavily] Failed: {e}")
        return None

    def _mock(self, query: str) -> dict:
        logger.info(f"[SearchManager/Mock] Returning mock for '{query}'")
        return {
            "results": [
                {"title": f"Result 1 for {query}", "url": "https://example.com/1",
                 "content": f"Mock content about {query}.", "score": 0.95},
                {"title": f"Result 2 for {query}", "url": "https://example.com/2",
                 "content": f"More mock content about {query}.", "score": 0.88}
            ],
            "answer": f"Mock answer for '{query}'.",
            "source": "MockFallback",
            "_is_mock": True
        }

search_manager = SearchManager()
