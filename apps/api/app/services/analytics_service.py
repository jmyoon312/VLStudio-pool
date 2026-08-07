"""
Analytics and Reporting Service

Provides:
1. Performance metrics aggregation
2. Channel analytics
3. Video performance tracking
4. Automated reporting
5. Trend analysis
6. Predictive insights

Usage:
    analytics = AnalyticsService()
    
    # Get channel performance
    report = await analytics.get_channel_report(
        channel_id=123,
        period="7d"
    )
    
    # Generate automated report
    await analytics.generate_daily_report()
"""

import os
import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class ReportPeriod(Enum):
    """Report periods"""
    HOUR = "1h"
    DAY = "1d"
    WEEK = "7d"
    MONTH = "30d"
    QUARTER = "90d"


class MetricType(Enum):
    """Metric types"""
    VIEWS = "views"
    WATCH_TIME = "watch_time"
    SUBSCRIBERS = "subscribers"
    ENGAGEMENT = "engagement"
    CTR = "ctr"
    RETENTION = "retention"


@dataclass
class ChannelMetrics:
    """Channel metrics"""
    channel_id: int
    period: str
    total_videos: int = 0
    total_views: int = 0
    total_watch_hours: float = 0.0
    avg_views_per_video: float = 0.0
    avg_ctr: float = 0.0
    subscriber_change: int = 0
    engagement_rate: float = 0.0
    top_videos: List[Dict] = field(default_factory=list)
    published_today: int = 0


@dataclass
class PerformanceTrend:
    """Performance trend"""
    metric: str
    current_value: float
    previous_value: float
    change_percent: float
    trend: str  # "up", "down", "stable"


class AnalyticsService:
    """
    Analytics and Reporting Service
    
    Features:
    - Channel performance metrics
    - Video analytics
    - Trend analysis
    - Automated reporting
    - Predictive insights
    """
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = 300  # 5 minutes
        self._report_templates = self._init_report_templates()
        
        logger.info("AnalyticsService initialized")
    
    def _init_report_templates(self) -> Dict[str, Dict]:
        """Initialize report templates"""
        return {
            "daily": {
                "name": "Daily Performance Report",
                "metrics": ["views", "watch_time", "subscribers", "engagement"],
                "sections": ["overview", "top_videos", "alerts"]
            },
            "weekly": {
                "name": "Weekly Performance Report",
                "metrics": ["views", "watch_time", "subscribers", "engagement", "ctr"],
                "sections": ["overview", "trends", "top_videos", "recommendations"]
            },
            "monthly": {
                "name": "Monthly Performance Report",
                "metrics": ["views", "watch_time", "subscribers", "engagement", "ctr", "retention"],
                "sections": ["overview", "trends", "top_videos", "channel_health", "recommendations"]
            }
        }
    
    async def get_channel_report(
        self,
        channel_id: int,
        period: str = "7d"
    ) -> Dict[str, Any]:
        """Get channel performance report"""
        cache_key = f"channel_report_{channel_id}_{period}"
        
        # Check cache
        if cache_key in self._cache:
            cached, timestamp = self._cache[cache_key]
            if (datetime.now() - timestamp).seconds < self._cache_ttl:
                return cached
        
        # Fetch metrics
        metrics = await self._fetch_channel_metrics(channel_id, period)
        
        # Calculate trends
        trends = await self._calculate_trends(channel_id, period)
        
        # Get top videos
        top_videos = await self._get_top_videos(channel_id, period, limit=5)
        
        # Generate insights
        insights = await self._generate_insights(metrics, trends)
        
        report = {
            "channel_id": channel_id,
            "period": period,
            "generated_at": datetime.now().isoformat(),
            "metrics": metrics,
            "trends": trends,
            "top_videos": top_videos,
            "insights": insights
        }
        
        # Cache
        self._cache[cache_key] = (report, datetime.now())
        
        return report
    
    async def _fetch_channel_metrics(
        self,
        channel_id: int,
        period: str
    ) -> ChannelMetrics:
        """Fetch channel metrics from database"""
        
        # In real implementation, query database
        # For now, return mock data
        return ChannelMetrics(
            channel_id=channel_id,
            period=period,
            total_videos=42,
            total_views=125000,
            total_watch_hours=8500.0,
            avg_views_per_video=2976.0,
            avg_ctr=4.2,
            subscriber_change=150,
            engagement_rate=3.8,
            top_videos=[],
            published_today=2
        )
    
    async def _calculate_trends(
        self,
        channel_id: int,
        period: str
    ) -> List[PerformanceTrend]:
        """Calculate performance trends"""
        
        # Mock trend calculations
        trends = [
            PerformanceTrend(
                metric="views",
                current_value=125000,
                previous_value=98000,
                change_percent=27.6,
                trend="up"
            ),
            PerformanceTrend(
                metric="watch_time",
                current_value=8500,
                previous_value=7200,
                change_percent=18.1,
                trend="up"
            ),
            PerformanceTrend(
                metric="engagement",
                current_value=3.8,
                previous_value=4.1,
                change_percent=-7.3,
                trend="down"
            ),
            PerformanceTrend(
                metric="subscribers",
                current_value=150,
                previous_value=120,
                change_percent=25.0,
                trend="up"
            )
        ]
        
        return trends
    
    async def _get_top_videos(
        self,
        channel_id: int,
        period: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get top performing videos"""
        
        # Mock top videos
        return [
            {
                "video_id": f"vid_{i}",
                "title": f"Top Video {i}",
                "views": 15000 - (i * 2000),
                "likes": 850 - (i * 100),
                "comments": 120 - (i * 15),
                "ctr": 4.5 - (i * 0.3)
            }
            for i in range(1, limit + 1)
        ]
    
    async def _generate_insights(
        self,
        metrics: ChannelMetrics,
        trends: List[PerformanceTrend]
    ) -> List[str]:
        """Generate automated insights"""
        insights = []
        
        # Analyze trends
        for trend in trends:
            if trend.trend == "up" and trend.change_percent > 20:
                insights.append(
                    f"[TREND] {trend.metric} increased by {trend.change_percent:.1f}% - Great momentum!"
                )
            elif trend.trend == "down" and trend.change_percent < -10:
                insights.append(
                    f"[WARN] {trend.metric} decreased by {abs(trend.change_percent):.1f}% - Needs attention"
                )
        
        # Engagement insight
        if metrics.engagement_rate < 3.0:
            insights.append(
                "[INFO] Engagement rate is below 3% - Consider more call-to-actions"
            )
        elif metrics.engagement_rate > 5.0:
            insights.append(
                "[OK] Excellent engagement rate! Your audience is highly active."
            )
        
        # Publishing frequency
        if metrics.published_today == 0:
            insights.append(
                "📅 No videos published today - Consider scheduling more content"
            )
        
        return insights
    
    async def generate_daily_report(self) -> Dict[str, Any]:
        """Generate daily automated report"""
        
        logger.info("[CHART] Generating daily report...")
        
        # Get all active channels
        # In real implementation, query database
        channels = [1, 2, 3, 4, 5]  # Mock
        
        channel_reports = []
        total_views = 0
        total_videos = 0
        
        for channel_id in channels:
            report = await self.get_channel_report(channel_id, "1d")
            channel_reports.append(report)
            total_views += report["metrics"].total_views
            total_videos += report["metrics"].total_videos
        
        report = {
            "type": "daily",
            "date": datetime.now().date().isoformat(),
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "active_channels": len(channels),
                "total_views": total_views,
                "total_videos": total_videos,
                "avg_views_per_channel": total_views // len(channels) if channels else 0
            },
            "channel_reports": channel_reports,
            "system_health": await self._get_system_health()
        }
        
        logger.info(f"[OK] Daily report generated: {total_views} views across {len(channels)} channels")
        
        return report
    
    async def generate_weekly_report(self) -> Dict[str, Any]:
        """Generate weekly automated report"""
        
        channels = [1, 2, 3, 4, 5]
        
        channel_reports = []
        
        for channel_id in channels:
            report = await self.get_channel_report(channel_id, "7d")
            channel_reports.append(report)
        
        # Weekly specific analysis
        week_trends = await self._analyze_weekly_trends(channel_reports)
        
        return {
            "type": "weekly",
            "week_start": (datetime.now() - timedelta(days=7)).date().isoformat(),
            "week_end": datetime.now().date().isoformat(),
            "generated_at": datetime.now().isoformat(),
            "channel_reports": channel_reports,
            "weekly_analysis": week_trends
        }
    
    async def _analyze_weekly_trends(
        self,
        channel_reports: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze weekly trends"""
        
        # Calculate week-over-week comparison
        return {
            "total_new_videos": sum(r["metrics"].total_videos for r in channel_reports),
            "avg_daily_views": sum(r["metrics"].total_views for r in channel_reports) // 7,
            "best_performing_day": "Saturday",
            "emerging_trends": ["travel", "food", "lifestyle"],
            "declining_topics": []
        }
    
    async def _get_system_health(self) -> Dict[str, Any]:
        """Get system health metrics"""
        return {
            "api_health": "healthy",
            "processing_queue": 5,
            "error_rate": 0.02,
            "uptime_hours": 168
        }
    
    async def get_video_analytics(
        self,
        video_id: int,
        detailed: bool = False
    ) -> Dict[str, Any]:
        """Get video-specific analytics"""
        
        # Mock video analytics
        analytics = {
            "video_id": video_id,
            "views": 15234,
            "unique_viewers": 12450,
            "watch_time_hours": 425.5,
            "avg_view_duration": 168.5,  # seconds
            "retention": {
                "0_10": 85,
                "10_30": 72,
                "30_60": 58,
                "60_90": 45,
                "90_plus": 32
            },
            "engagement": {
                "likes": 892,
                "comments": 156,
                "shares": 45,
                "subscribes": 28
            },
            "traffic_sources": {
                "youtube_search": 35,
                "recommended": 42,
                "external": 15,
                "browse_features": 8
            },
            "demographics": {
                "countries": {"KR": 45, "US": 25, "JP": 15, "other": 15},
                "age_groups": {"18-24": 30, "25-34": 40, "35-44": 20, "45_plus": 10}
            }
        }
        
        if detailed:
            analytics["real_time"] = {
                "current_viewers": 42,
                "likes_per_minute": 0.8
            }
        
        return analytics
    
    async def predict_performance(
        self,
        video_title: str,
        channel_id: int,
        niche: str
    ) -> Dict[str, Any]:
        """Predict video performance using ML-like analysis"""
        
        # Simple prediction based on historical data
        # In real implementation, use ML model
        
        # Get similar videos
        similar_performance = 2500  # Mock baseline
        
        factors = {
            "title_quality": 0.85,
            "keyword_relevance": 0.72,
            "niche_popularity": 0.65,
            "channel_authority": 0.78
        }
        
        predicted_views = int(similar_performance * sum(factors.values()) / len(factors))
        
        return {
            "video_title": video_title,
            "channel_id": channel_id,
            "niche": niche,
            "predicted_views": predicted_views,
            "predicted_ctr": round(3.5 + (predicted_views / 10000), 2),
            "confidence": 0.72,
            "factors": factors,
            "recommendations": [
                "Add trending keywords to title",
                "Use eye-catching thumbnail",
                "Include hook in first 5 seconds"
            ]
        }
    
    def export_report(
        self,
        report: Dict[str, Any],
        format: str = "json"
    ) -> str:
        """Export report to various formats"""
        
        if format == "json":
            return json.dumps(report, indent=2, ensure_ascii=False)
        
        elif format == "csv":
            # Simple CSV conversion for metrics
            lines = ["Metric,Value"]
            for key, value in report.get("metrics", {}).items():
                lines.append(f"{key},{value}")
            return "\n".join(lines)
        
        return str(report)
    
    def clear_cache(self):
        """Clear analytics cache"""
        self._cache.clear()
        logger.info("🗑️ Analytics cache cleared")


# Global singleton
_analytics_service = None

def get_analytics_service() -> AnalyticsService:
    """Get global AnalyticsService instance"""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = AnalyticsService()
    return _analytics_service