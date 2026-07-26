"""
Captain Cache Service - DB-only data retrieval
NO YouTube Analytics API calls - uses cached data only
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models import (
    BrandChannel as YouTubeChannel, VideoMetadataCache, 
    ChannelDailyStats, Profile
)

logger = logging.getLogger(__name__)


class CaptainCacheService:
    """
    캐시된 데이터만 사용하는 Captain 분석 서비스
    YouTube Analytics API 호출 없음 - 속도 최적화
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_managed_channels(self, profile_id: str) -> List[YouTubeChannel]:
        """Get all channels managed by this Captain"""
        channel_accesses = self.db.query(ChannelAccess).filter(
            ChannelAccess.profile_id == profile_id,
            ChannelAccess.role == ChannelRole.MANAGER
        ).all()
        
        channel_ids = [access.channel_id for access in channel_accesses]
        
        channels = self.db.query(YouTubeChannel).filter(
            YouTubeChannel.channel_id.in_(channel_ids)
        ).all()
        
        return channels
    
    def get_dashboard_summary(self, profile_id: str, days: int = 30) -> Dict[str, Any]:
        """
        대시보드 요약 데이터 (DB 캐시만 사용)
        """
        channels = self.get_managed_channels(profile_id)
        
        if not channels:
            return {
                "total_subscribers": 0,
                "total_views": 0,
                "total_videos": 0,
                "avg_engagement_rate": 0,
                "channels_count": 0,
                "last_updated": None
            }
        
        total_subscribers = sum(ch.subscriber_count or 0 for ch in channels)
        total_views = sum(ch.view_count or 0 for ch in channels)
        total_videos = sum(ch.video_count or 0 for ch in channels)
        
        # Get recent engagement from VideoMetadataCache
        channel_ids = [ch.channel_id for ch in channels]
        
        recent_videos = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.channel_id.in_(channel_ids)
        ).order_by(desc(VideoMetadataCache.last_updated)).limit(100).all()
        
        if recent_videos:
            total_engagement = 0
            total_video_views = 0
            
            for video in recent_videos:
                views = video.view_count or 0
                likes = video.like_count or 0
                comments = video.comment_count or 0
                
                if views > 0:
                    engagement = ((likes + comments) / views) * 100
                    total_engagement += engagement
                    total_video_views += views
            
            avg_engagement_rate = total_engagement / len(recent_videos) if recent_videos else 0
        else:
            avg_engagement_rate = 0
        
        # Get last update time
        last_updated = max(
            (ch.metadata_updated_at for ch in channels if ch.metadata_updated_at),
            default=None
        )
        
        return {
            "total_subscribers": total_subscribers,
            "total_views": total_views,
            "total_videos": total_videos,
            "avg_engagement_rate": round(avg_engagement_rate, 2),
            "channels_count": len(channels),
            "last_updated": last_updated.isoformat() if last_updated else None
        }
    
    def get_engagement_metrics(self, profile_id: str, days: int = 30) -> Dict[str, Any]:
        """
        참여도 메트릭 (VideoMetadataCache에서 집계)
        """
        channels = self.get_managed_channels(profile_id)
        channel_ids = [ch.channel_id for ch in channels]
        
        if not channel_ids:
            return {"daily_data": [], "total_engagement_rate": 0}
        
        # Get videos from cache
        cutoff_date = datetime.now() - timedelta(days=days)
        
        videos = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.channel_id.in_(channel_ids),
            VideoMetadataCache.last_updated >= cutoff_date
        ).all()
        
        # Group by date
        date_map = {}
        for video in videos:
            # Use upload_date or last_updated as date
            date_obj = video.upload_date or video.last_updated
            if not date_obj:
                continue
                
            date_str = date_obj.strftime('%Y-%m-%d')
            
            if date_str not in date_map:
                date_map[date_str] = {
                    'date': date_str,
                    'likes': 0,
                    'comments': 0,
                    'views': 0,
                    'video_count': 0
                }
            
            entry = date_map[date_str]
            entry['likes'] += video.like_count or 0
            entry['comments'] += video.comment_count or 0
            entry['views'] += video.view_count or 0
            entry['video_count'] += 1
        
        # Calculate engagement rate for each day
        daily_data = []
        total_engagement = 0
        
        for date_str in sorted(date_map.keys()):
            day_data = date_map[date_str]
            views = day_data['views']
            
            if views > 0:
                engagement_rate = ((day_data['likes'] + day_data['comments']) / views) * 100
            else:
                engagement_rate = 0
            
            day_data['engagement_rate'] = round(engagement_rate, 2)
            total_engagement += engagement_rate
            daily_data.append(day_data)
        
        avg_engagement = total_engagement / len(daily_data) if daily_data else 0
        
        return {
            "daily_data": daily_data,
            "total_engagement_rate": round(avg_engagement, 2)
        }
    
    def get_watch_time_trend(self, profile_id: str, days: int = 30) -> Dict[str, Any]:
        """
        시청 시간 추이 (VideoMetadataCache의 조회수 기반 추정)
        """
        channels = self.get_managed_channels(profile_id)
        channel_ids = [ch.channel_id for ch in channels]
        
        if not channel_ids:
            return {"daily_data": [], "total_views": 0}
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        videos = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.channel_id.in_(channel_ids),
            VideoMetadataCache.last_updated >= cutoff_date
        ).all()
        
        # Group by date
        date_map = {}
        for video in videos:
            date_obj = video.upload_date or video.last_updated
            if not date_obj:
                continue
                
            date_str = date_obj.strftime('%Y-%m-%d')
            
            if date_str not in date_map:
                date_map[date_str] = {
                    'date': date_str,
                    'views': 0,
                    'estimated_watch_time': 0,  # minutes
                    'video_count': 0
                }
            
            entry = date_map[date_str]
            views = video.view_count or 0
            duration = video.duration or 0  # seconds
            
            entry['views'] += views
            # Estimate watch time (assume 50% average view duration)
            entry['estimated_watch_time'] += (views * duration * 0.5) / 60
            entry['video_count'] += 1
        
        daily_data = [date_map[date_str] for date_str in sorted(date_map.keys())]
        total_views = sum(day['views'] for day in daily_data)
        
        return {
            "daily_data": daily_data,
            "total_views": total_views
        }
    
    def get_video_performance(self, profile_id: str, limit: int = 30) -> Dict[str, Any]:
        """
        영상 성과 목록 (VideoMetadataCache에서 조회)
        """
        channels = self.get_managed_channels(profile_id)
        channel_ids = [ch.channel_id for ch in channels]
        
        if not channel_ids:
            return {"videos": [], "summary": {}}
        
        videos = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.channel_id.in_(channel_ids)
        ).order_by(desc(VideoMetadataCache.view_count)).limit(limit).all()
        
        video_list = []
        total_views = 0
        total_likes = 0
        total_comments = 0
        
        for video in videos:
            views = video.view_count or 0
            likes = video.like_count or 0
            comments = video.comment_count or 0
            
            engagement_rate = ((likes + comments) / views * 100) if views > 0 else 0
            
            video_list.append({
                "video_id": video.video_id,
                "title": video.title,
                "channel_id": video.channel_id,
                "views": views,
                "likes": likes,
                "comments": comments,
                "engagement_rate": round(engagement_rate, 2),
                "published_at": video.upload_date.isoformat() if video.upload_date else None,
                "duration": video.duration
            })
            
            total_views += views
            total_likes += likes
            total_comments += comments
        
        avg_engagement = ((total_likes + total_comments) / total_views * 100) if total_views > 0 else 0
        
        return {
            "videos": video_list,
            "summary": {
                "total_videos": len(video_list),
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "avg_engagement_rate": round(avg_engagement, 2)
            }
        }
    
    def get_last_update_time(self, profile_id: str) -> Optional[datetime]:
        """마지막 데이터 업데이트 시간"""
        channels = self.get_managed_channels(profile_id)
        
        if not channels:
            return None
        
        last_updated = max(
            (ch.metadata_updated_at for ch in channels if ch.metadata_updated_at),
            default=None
        )
        
        return last_updated
