"""
Search Engine Service

Provides:
1. Full-text search
2. Faceted search
3. Autocomplete
4. Search analytics

Usage:
    search = SearchEngine()
    
    # Index content
    await search.index("video_123", {"title": " Travel", "description": "..."})
    
    # Search
    results = await search.query("travel beach", filters={"niche": "travel"})
"""

import os
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class SearchEngine:
    def __init__(self):
        self._index: Dict[str, Dict] = {}
        self._search_history: List[Dict] = []
        
        logger.info("SearchEngine initialized")
    
    async def index(self, doc_id: str, document: Dict[str, Any]):
        self._index[doc_id] = document
        logger.info(f"📚 Indexed: {doc_id}")
    
    async def query(
        self,
        query: str,
        filters: Dict[str, Any] = None,
        limit: int = 10
    ) -> List[Dict]:
        query_lower = query.lower()
        
        results = []
        
        for doc_id, doc in self._index.items():
            score = 0
            
            # Simple text matching
            for field, value in doc.items():
                if isinstance(value, str) and query_lower in value.lower():
                    score += 1
            
            # Apply filters
            if filters:
                match = True
                for key, val in filters.items():
                    if doc.get(key) != val:
                        match = False
                        break
                if not match:
                    continue
            
            if score > 0:
                results.append({"doc_id": doc_id, "score": score, "document": doc})
        
        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Record search
        self._search_history.append({
            "query": query,
            "filters": filters,
            "results_count": len(results),
            "timestamp": datetime.now()
        })
        
        return results[:limit]
    
    async def autocomplete(self, prefix: str, limit: int = 5) -> List[str]:
        prefix_lower = prefix.lower()
        suggestions = set()
        
        for doc in self._index.values():
            for field, value in doc.items():
                if isinstance(value, str) and value.lower().startswith(prefix_lower):
                    suggestions.add(value)
        
        return list(suggestions)[:limit]
    
    def get_analytics(self) -> Dict:
        return {
            "total_documents": len(self._index),
            "total_searches": len(self._search_history),
            "recent_queries": [s["query"] for s in self._search_history[-10:]]
        }


_search_engine = None

def get_search_engine() -> SearchEngine:
    global _search_engine
    if _search_engine is None:
        _search_engine = SearchEngine()
    return _search_engine