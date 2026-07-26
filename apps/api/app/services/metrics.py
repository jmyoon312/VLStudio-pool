import threading
from datetime import datetime
from collections import deque
import logging
from typing import Dict, List, Optional
import json

# Thread-safe Singleton
class MetricsCollector:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(MetricsCollector, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._initialized = True
        self.events = deque(maxlen=1000) # Keep last 1000 events in memory
        self.stats = {
            "search": {
                "searxng": {"success": 0, "fail": 0, "latency": []},
                "tavily": {"success": 0, "fail": 0, "latency": []}
            },
            "llm": {
                "requests": 0,
                "errors": 0,
                "rate_limits": 0,
                "tokens": 0
            },
            "scans": {
                "channels": 0,
                "videos_new": 0,
                "videos_updated": 0
            }
        }
        self.logger = logging.getLogger("MetricsCollector")

    def record_event(self, category: str, action: str, status: str, details: Dict = None):
        """
        Record a system even safely. Swallows all exceptions to prevent app crash.
        """
        try:
            # DEBUG PRINT
            # print(f"[Metrics DEBUG] {category}.{action}.{status} - {json.dumps(details)}")
            
            timestamp = datetime.now()
            event = {
                "time": timestamp.isoformat(),
                "category": category,
                "action": action,
                "status": status,
                "details": details or {}
            }
            
            # 1. Add to buffer
            self.events.append(event)
            
            # 2. Update Aggregates (Simple Logic)
            if category == "search":
                provider = details.get("provider", "unknown")
                if provider in self.stats["search"]:
                    latency = details.get("latency", 0)
                    if status == "success":
                        self.stats["search"][provider]["success"] += 1
                        if latency > 0:
                            self.stats["search"][provider]["latency"].append(latency)
                            # Keep latency list small
                            if len(self.stats["search"][provider]["latency"]) > 100:
                                self.stats["search"][provider]["latency"] = self.stats["search"][provider]["latency"][-100:]
                    else:
                        self.stats["search"][provider]["fail"] += 1
                        
            elif category == "llm":
                self.stats["llm"]["requests"] += 1
                if status == "error":
                    self.stats["llm"]["errors"] += 1
                    if "429" in str(details.get("error", "")):
                        self.stats["llm"]["rate_limits"] += 1
                        
            elif category == "scan":
                if action == "channel_scan":
                    self.stats["scans"]["channels"] += 1
                    self.stats["scans"]["videos_new"] += details.get("new_videos", 0)
                    
        except Exception as e:
            # SAFETY: Never crash the caller
            print(f"Metrics Error: {e}")

    def get_snapshot(self):
        """Returns a snapshot of current stats for the UI."""
        return {
            "events": list(self.events)[-50:], # Return last 50 events for ticker
            "stats": self.stats
        }

# Global Instance
collector = MetricsCollector()
