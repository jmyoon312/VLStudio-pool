"""
Metrics Aggregator Service

Provides:
1. Centralized metrics collection from all services
2. Real-time KPI tracking
3. Historical data aggregation
4. Trend calculation
5. Custom metric definitions

Usage:
    metrics = MetricsAggregator()
    
    # Record a metric
    await metrics.record("upload.success", 1, {"channel": "travel"})
    
    # Get KPI
    kpi = await metrics.get_kpi("daily_uploads")
    
    # Get trends
    trends = await metrics.get_trends("views", days=7)
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


@dataclass
class MetricPoint:
    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)


class MetricsAggregator:
    def __init__(self):
        self._metrics: Dict[str, List[MetricPoint]] = defaultdict(list)
        self._kpi_definitions: Dict[str, Dict] = {}
        
        self._setup_default_kpis()
        
        logger.info("MetricsAggregator initialized")
    
    def _setup_default_kpis(self):
        self._kpi_definitions = {
            "daily_uploads": {
                "query": "upload.success",
                "aggregation": "sum",
                "window": "1d"
            },
            "daily_views": {
                "query": "video.views",
                "aggregation": "sum",
                "window": "1d"
            },
            "avg_engagement": {
                "query": "video.engagement",
                "aggregation": "avg",
                "window": "1d"
            },
            "upload_success_rate": {
                "query": "upload.success",
                "query_fail": "upload.failed",
                "aggregation": "ratio",
                "window": "1d"
            },
            "avg_processing_time": {
                "query": "processing.time",
                "aggregation": "avg",
                "window": "1d"
            },
            "queue_depth": {
                "query": "queue.pending",
                "aggregation": "latest",
                "window": "5m"
            }
        }
    
    async def record(
        self,
        metric_name: str,
        value: float,
        tags: Dict[str, str] = None,
        timestamp: datetime = None
    ):
        if timestamp is None:
            timestamp = datetime.now()
        
        point = MetricPoint(
            timestamp=timestamp,
            value=value,
            tags=tags or {}
        )
        
        self._metrics[metric_name].append(point)
        
        cutoff = datetime.now() - timedelta(days=30)
        self._metrics[metric_name] = [
            p for p in self._metrics[metric_name]
            if p.timestamp > cutoff
        ]
    
    async def increment(
        self,
        metric_name: str,
        tags: Dict[str, str] = None
    ):
        await self.record(metric_name, 1, tags)
    
    async def get_metric(
        self,
        metric_name: str,
        hours: int = 24,
        tags: Dict[str, str] = None
    ) -> List[Dict]:
        cutoff = datetime.now() - timedelta(hours=hours)
        
        points = self._metrics.get(metric_name, [])
        
        filtered = [
            p for p in points
            if p.timestamp > cutoff
        ]
        
        if tags:
            filtered = [
                p for p in filtered
                if all(p.tags.get(k) == v for k, v in tags.items())
            ]
        
        return [
            {
                "timestamp": p.timestamp.isoformat(),
                "value": p.value,
                "tags": p.tags
            }
            for p in sorted(filtered, key=lambda x: x.timestamp)
        ]
    
    async def get_kpi(self, kpi_name: str) -> Optional[Dict]:
        kpi = self._kpi_definitions.get(kpi_name)
        if not kpi:
            return None
        
        query = kpi["query"]
        aggregation = kpi.get("aggregation", "sum")
        window_hours = self._parse_window(kpi.get("window", "1d"))
        
        points = await self.get_metric(query, hours=window_hours)
        
        if not points:
            return {"value": 0, "kpi": kpi_name}
        
        values = [p["value"] for p in points]
        
        if aggregation == "sum":
            result = sum(values)
        elif aggregation == "avg":
            result = sum(values) / len(values) if values else 0
        elif aggregation == "max":
            result = max(values) if values else 0
        elif aggregation == "min":
            result = min(values) if values else 0
        elif aggregation == "latest":
            result = values[-1] if values else 0
        elif aggregation == "ratio":
            fail_metric = kpi.get("query_fail")
            if fail_metric:
                fail_points = await self.get_metric(fail_metric, hours=window_hours)
                fail_values = [p["value"] for p in fail_points]
                success_sum = sum(values)
                fail_sum = sum(fail_values)
                result = success_sum / (success_sum + fail_sum) if (success_sum + fail_sum) > 0 else 0
            else:
                result = 0
        else:
            result = sum(values)
        
        return {
            "kpi": kpi_name,
            "value": round(result, 2),
            "aggregation": aggregation,
            "window": kpi.get("window"),
            "data_points": len(values)
        }
    
    def _parse_window(self, window: str) -> int:
        if window.endswith("m"):
            return int(window[:-1]) // 60
        elif window.endswith("h"):
            return int(window[:-1])
        elif window.endswith("d"):
            return int(window[:-1]) * 24
        return 24
    
    async def get_trends(
        self,
        metric_name: str,
        days: int = 7,
        interval: str = "1d"
    ) -> List[Dict]:
        points = await self.get_metric(metric_name, hours=days * 24)
        
        if not points:
            return []
        
        interval_hours = self._parse_window(interval)
        
        buckets = defaultdict(list)
        for p in points:
            if interval_hours >= 60:
                key = p["timestamp"][:10]
            else:
                key = p["timestamp"][:16]
            buckets[key].append(p["value"])
        
        trends = []
        for key in sorted(buckets.keys()):
            values = buckets[key]
            trends.append({
                "timestamp": key,
                "value": sum(values) / len(values) if values else 0,
                "count": len(values)
            })
        
        if len(trends) >= 2:
            first = trends[0]["value"]
            last = trends[-1]["value"]
            if first > 0:
                change_pct = ((last - first) / first) * 100
                trends.append({
                    "timestamp": "change",
                    "value": round(change_pct, 2),
                    "count": 0,
                    "direction": "up" if change_pct > 0 else "down" if change_pct < 0 else "flat"
                })
        
        return trends
    
    async def get_all_kpis(self) -> Dict:
        kpis = {}
        
        for kpi_name in self._kpi_definitions.keys():
            kpis[kpi_name] = await self.get_kpi(kpi_name)
        
        return kpis
    
    async def get_dashboard_metrics(self) -> Dict:
        kpis = await self.get_all_kpis()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "kpis": kpis,
            "system_health": {
                "services_healthy": 0,
                "services_degraded": 0,
                "services_critical": 0
            },
            "queue_status": {
                "pending": 0,
                "processing": 0,
                "completed": 0,
                "failed": 0
            }
        }
    
    def register_kpi(
        self,
        name: str,
        query: str,
        aggregation: str = "sum",
        window: str = "1d",
        query_fail: str = None
    ):
        self._kpi_definitions[name] = {
            "query": query,
            "aggregation": aggregation,
            "window": window,
            "query_fail": query_fail
        }
        
        logger.info(f"[CHART] Registered KPI: {name}")
    
    def get_metric_names(self) -> List[str]:
        return list(self._metrics.keys())
    
    def get_kpi_names(self) -> List[str]:
        return list(self._kpi_definitions.keys())


_metrics_aggregator = None

def get_metrics_aggregator() -> MetricsAggregator:
    global _metrics_aggregator
    if _metrics_aggregator is None:
        _metrics_aggregator = MetricsAggregator()
    return _metrics_aggregator