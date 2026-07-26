"""
YouTube Analytics Service
Handles YouTube Data API and Analytics API interactions
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.models import Profile
from app.services.oauth2_manager import OAuth2Manager

logger = logging.getLogger(__name__)


class YouTubeAnalyticsService:
    """
    YouTube Analytics API 서비스
    """
    
    def __init__(self, db: Session, profile: Profile):
        """
        Initialize YouTube Analytics Service
        
        Args:
            db: Database session
            profile: Profile object with OAuth2 credentials
        """
        self.db = db
        self.profile = profile
        
        # Load and refresh credentials
        self.credentials = OAuth2Manager.refresh_token_if_needed(profile, db)
        
        if not self.credentials:
            logger.error(f"Failed to load credentials for profile {profile.id}")
            self.youtube = None
            self.analytics = None
            return
        
        # Build API services
        try:
            self.youtube = OAuth2Manager.build_youtube_service(
                self.credentials, 
                'youtube', 
                'v3'
            )
            self.analytics = OAuth2Manager.build_youtube_service(
                self.credentials,
                'youtubeAnalytics',
                'v2'
            )
            logger.info(f"YouTubeAnalyticsService initialized for profile: {profile.id}")
        except Exception as e:
            logger.error(f"Failed to build YouTube services: {e}")
            self.youtube = None
            self.analytics = None
    
    def get_channel_basic_stats(self, channel_id: str) -> Dict[str, Any]:
        """
        Get basic channel statistics and metadata using YouTube Data API
        
        Args:
            channel_id: YouTube channel ID
            
        Returns:
            Dictionary with subscriber_count, view_count, video_count, channel_name, thumbnail_url
        """
        if not self.youtube:
            logger.error("YouTube service not initialized")
            return {
                "subscriber_count": 0,
                "view_count": 0,
                "video_count": 0,
                "channel_name": None,
                "thumbnail_url": None
            }
        
        try:
            # Call YouTube Data API with snippet and statistics
            request = self.youtube.channels().list(
                part='snippet,statistics',
                id=channel_id
            )
            response = request.execute()
            
            if not response.get('items'):
                logger.warning(f"No channel found for ID: {channel_id}")
                return {
                    "subscriber_count": 0,
                    "view_count": 0,
                    "video_count": 0,
                    "channel_name": None,
                    "thumbnail_url": None
                }
            
            item = response['items'][0]
            stats = item.get('statistics', {})
            snippet = item.get('snippet', {})
            
            # Get thumbnail URL (prefer high quality)
            thumbnails = snippet.get('thumbnails', {})
            thumbnail_url = (
                thumbnails.get('high', {}).get('url') or
                thumbnails.get('medium', {}).get('url') or
                thumbnails.get('default', {}).get('url')
            )
            
            result = {
                "subscriber_count": int(stats.get('subscriberCount', 0)),
                "view_count": int(stats.get('viewCount', 0)),
                "video_count": int(stats.get('videoCount', 0)),
                "channel_name": snippet.get('title'),
                "channel_handle": snippet.get('customUrl'),
                "thumbnail_url": thumbnail_url
            }
            
            logger.info(f"Retrieved basic stats for channel {channel_id}: {result}")
            return result
            
        except HttpError as e:
            logger.error(f"YouTube API error for channel {channel_id}: {e}")
            return {"subscriber_count": 0, "view_count": 0, "video_count": 0}
        except Exception as e:
            logger.error(f"Unexpected error getting basic stats for {channel_id}: {e}")
            return {"subscriber_count": 0, "view_count": 0, "video_count": 0}
    
    def get_channel_revenue(self, channel_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get channel revenue data using YouTube Analytics API
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to query
            
        Returns:
            Dictionary with estimated_revenue, ad_impressions, cpm
        """
        if not self.analytics:
            logger.error("YouTube Analytics service not initialized")
            return {"estimated_revenue": 0.0, "ad_impressions": 0, "cpm": 0.0}
        
        try:
            # Calculate date range
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days)
            
            # Call YouTube Analytics API for revenue data
            request = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics='estimatedRevenue,adImpressions,cpm',
                dimensions='day'
            )
            response = request.execute()
            
            if not response.get('rows'):
                logger.warning(f"No revenue data for channel {channel_id}")
                return {"estimated_revenue": 0.0, "ad_impressions": 0, "cpm": 0.0}
            
            # Aggregate data
            total_revenue = 0.0
            total_impressions = 0
            
            for row in response['rows']:
                total_revenue += float(row[1]) if len(row) > 1 else 0.0
                total_impressions += int(row[2]) if len(row) > 2 else 0
            
            # Calculate average CPM
            avg_cpm = (total_revenue / total_impressions * 1000) if total_impressions > 0 else 0.0
            
            result = {
                "estimated_revenue": round(total_revenue, 2),
                "ad_impressions": total_impressions,
                "cpm": round(avg_cpm, 2)
            }
            
            logger.info(f"Retrieved revenue data for channel {channel_id}: {result}")
            return result
            
        except HttpError as e:
            # Revenue data might not be accessible for MANAGER role
            if e.resp.status == 403:
                logger.warning(f"No permission to access revenue data for {channel_id} (MANAGER role)")
            else:
                logger.error(f"YouTube Analytics API error for {channel_id}: {e}")
            return {"estimated_revenue": 0.0, "ad_impressions": 0, "cpm": 0.0}
        except Exception as e:
            logger.error(f"Unexpected error getting revenue for {channel_id}: {e}")
            return {"estimated_revenue": 0.0, "ad_impressions": 0, "cpm": 0.0}
    
    def get_channel_engagement(self, channel_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get channel engagement metrics using YouTube Analytics API
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to query
            
        Returns:
            Dictionary with likes, comments, shares, watch_time_minutes, etc.
        """
        if not self.analytics:
            logger.error("YouTube Analytics service not initialized")
            return {
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "watch_time_minutes": 0,
                "subscribers_gained": 0,
                "subscribers_lost": 0
            }
        
        try:
            # Calculate date range
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days)
            
            # Call YouTube Analytics API for engagement metrics
            request = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.isoformat(),
                endDate=end_date.isoformat(),
                metrics='likes,comments,shares,estimatedMinutesWatched,subscribersGained,subscribersLost',
                dimensions='day'
            )
            response = request.execute()
            
            if not response.get('rows'):
                logger.warning(f"No engagement data for channel {channel_id}")
                return {
                    "likes": 0,
                    "comments": 0,
                    "shares": 0,
                    "watch_time_minutes": 0,
                    "subscribers_gained": 0,
                    "subscribers_lost": 0
                }
            
            # Aggregate data
            total_likes = 0
            total_comments = 0
            total_shares = 0
            total_watch_time = 0
            total_subs_gained = 0
            total_subs_lost = 0
            
            for row in response['rows']:
                total_likes += int(row[1]) if len(row) > 1 else 0
                total_comments += int(row[2]) if len(row) > 2 else 0
                total_shares += int(row[3]) if len(row) > 3 else 0
                total_watch_time += int(row[4]) if len(row) > 4 else 0
                total_subs_gained += int(row[5]) if len(row) > 5 else 0
                total_subs_lost += int(row[6]) if len(row) > 6 else 0
            
            result = {
                "likes": total_likes,
                "comments": total_comments,
                "shares": total_shares,
                "watch_time_minutes": total_watch_time,
                "subscribers_gained": total_subs_gained,
                "subscribers_lost": total_subs_lost
            }
            
            logger.info(f"Retrieved engagement data for channel {channel_id}: {result}")
            return result
            
        except HttpError as e:
            logger.error(f"YouTube Analytics API error for {channel_id}: {e}")
            return {
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "watch_time_minutes": 0,
                "subscribers_gained": 0,
                "subscribers_lost": 0
            }
        except Exception as e:
            logger.error(f"Unexpected error getting engagement for {channel_id}: {e}")
            return {
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "watch_time_minutes": 0,
                "subscribers_gained": 0,
                "subscribers_lost": 0
            }
    
    def check_channel_health(self, channel_id: str) -> Dict[str, Any]:
        """
        Check channel health status
        
        Args:
            channel_id: YouTube channel ID
            
        Returns:
            Dictionary with health_score, can_upload, is_monetized
        """
        if not self.youtube:
            logger.error("YouTube service not initialized")
            return {"health_score": 0, "can_upload": None, "is_monetized": None}
        
        try:
            # Get channel status
            request = self.youtube.channels().list(
                part='status,contentDetails',
                id=channel_id
            )
            response = request.execute()
            
            if not response.get('items'):
                logger.warning(f"No channel found for ID: {channel_id}")
                return {"health_score": 0, "can_upload": None, "is_monetized": None}
            
            channel_data = response['items'][0]
            status = channel_data.get('status', {})
            
            # Check upload status
            can_upload = not status.get('longUploadsStatus') == 'disallowed'
            
            # Check monetization (if available)
            is_monetized = status.get('isLinked', False)
            
            # Calculate health score (simple heuristic)
            health_score = 100
            
            if not can_upload:
                health_score -= 50
            
            if not is_monetized:
                health_score -= 20
            
            # Check for privacy status
            privacy_status = status.get('privacyStatus', 'public')
            if privacy_status != 'public':
                health_score -= 10
            
            result = {
                "health_score": max(0, health_score),
                "can_upload": can_upload,
                "is_monetized": is_monetized
            }
            
            logger.info(f"Retrieved health status for channel {channel_id}: {result}")
            return result
            
        except HttpError as e:
            logger.error(f"YouTube API error checking health for {channel_id}: {e}")
            return {"health_score": 0, "can_upload": None, "is_monetized": None}
        except Exception as e:
            logger.error(f"Unexpected error checking health for {channel_id}: {e}")
            return {"health_score": 0, "can_upload": None, "is_monetized": None}
    
    def get_traffic_sources(self, channel_id: str, days: int = 30) -> list:
        """
        Get traffic source breakdown for a channel
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to analyze
            
        Returns:
            List of traffic source data
        """
        if not self.analytics:
            logger.error("Analytics service not initialized")
            return []
        
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            response = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.strftime('%Y-%m-%d'),
                endDate=end_date.strftime('%Y-%m-%d'),
                metrics='views',
                dimensions='insightTrafficSourceType',
                sort='-views',
                maxResults=10
            ).execute()
            
            rows = response.get('rows', [])
            logger.info(f"Retrieved {len(rows)} traffic sources for channel {channel_id}")
            
            return [
                {
                    'source': row[0],
                    'views': int(row[1])
                }
                for row in rows
            ]
            
        except HttpError as e:
            logger.error(f"Failed to get traffic sources for channel {channel_id}: {e}")
            return []
    
    def get_demographics(self, channel_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get demographic data (age and gender) for a channel
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with age and gender demographics
        """
        if not self.analytics:
            logger.error("Analytics service not initialized")
            return {'age_groups': [], 'gender': []}
        
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get age group data
            age_response = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.strftime('%Y-%m-%d'),
                endDate=end_date.strftime('%Y-%m-%d'),
                metrics='viewerPercentage',
                dimensions='ageGroup',
                sort='-viewerPercentage'
            ).execute()
            
            # Get gender data
            gender_response = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.strftime('%Y-%m-%d'),
                endDate=end_date.strftime('%Y-%m-%d'),
                metrics='viewerPercentage',
                dimensions='gender',
                sort='-viewerPercentage'
            ).execute()
            
            age_groups = [
                {
                    'age_group': row[0],
                    'percentage': float(row[1])
                }
                for row in age_response.get('rows', [])
            ]
            
            gender_data = [
                {
                    'gender': row[0],
                    'percentage': float(row[1])
                }
                for row in gender_response.get('rows', [])
            ]
            
            logger.info(f"Retrieved demographics for channel {channel_id}")
            
            return {
                'age_groups': age_groups,
                'gender': gender_data
            }
            
        except HttpError as e:
            logger.error(f"Failed to get demographics for channel {channel_id}: {e}")
            return {'age_groups': [], 'gender': []}
    
    def get_engagement_metrics(self, channel_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get engagement metrics (likes, comments, shares) over time
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with daily engagement data
        """
        if not self.analytics:
            logger.error("Analytics service not initialized")
            return {'daily_data': []}
        
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            response = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.strftime('%Y-%m-%d'),
                endDate=end_date.strftime('%Y-%m-%d'),
                metrics='likes,comments,shares,subscribersGained,subscribersLost',
                dimensions='day',
                sort='day'
            ).execute()
            
            daily_data = [
                {
                    'date': row[0],
                    'likes': int(row[1]),
                    'comments': int(row[2]),
                    'shares': int(row[3]),
                    'subscribers_gained': int(row[4]),
                    'subscribers_lost': int(row[5])
                }
                for row in response.get('rows', [])
            ]
            
            logger.info(f"Retrieved {len(daily_data)} days of engagement data for channel {channel_id}")
            
            return {'daily_data': daily_data}
            
        except HttpError as e:
            logger.error(f"Failed to get engagement metrics for channel {channel_id}: {e}")
            return {'daily_data': []}
    
    def get_watch_time_trend(self, channel_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get watch time trend over time
        
        Args:
            channel_id: YouTube channel ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with daily watch time data
        """
        if not self.analytics:
            logger.error("Analytics service not initialized")
            return {'daily_data': []}
        
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            response = self.analytics.reports().query(
                ids=f'channel=={channel_id}',
                startDate=start_date.strftime('%Y-%m-%d'),
                endDate=end_date.strftime('%Y-%m-%d'),
                metrics='estimatedMinutesWatched,views,averageViewDuration',
                dimensions='day',
                sort='day'
            ).execute()
            
            daily_data = [
                {
                    'date': row[0],
                    'watch_time': int(row[1]),
                    'views': int(row[2]),
                    'avg_view_duration': float(row[3])
                }
                for row in response.get('rows', [])
            ]
            
            logger.info(f"Retrieved {len(daily_data)} days of watch time data for channel {channel_id}")
            
            return {'daily_data': daily_data}
            
        except HttpError as e:
            logger.error(f"Failed to get watch time trend for channel {channel_id}: {e}")
            return {'daily_data': []}

    def get_video_performance_stats(self, channel_id: str, limit: int = 30) -> Dict[str, Any]:
        """
        Get video performance stats using YouTube Data API (accessible to Managers).
        This serves as a fallback for Analytics API which is often restricted.
        
        Args:
            channel_id: Channel ID
            limit: Number of recent videos to fetch
            
        Returns:
            Dictionary with aggregated stats and video list
        """
        if not self.youtube:
            return {"videos": [], "summary": {}}
            
        try:
            # 1. Try to get Uploads playlist ID
            try:
                channel_response = self.youtube.channels().list(
                    part='contentDetails',
                    id=channel_id
                ).execute()
                
                if not channel_response.get('items'):
                    logger.warning(f"Channel {channel_id} not found")
                    return {"videos": [], "summary": {}}
                    
                uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
                
                # 2. Get recent videos from playlist
                playlist_response = self.youtube.playlistItems().list(
                    part='contentDetails',
                    playlistId=uploads_playlist_id,
                    maxResults=limit
                ).execute()
                
                video_ids = [item['contentDetails']['videoId'] for item in playlist_response.get('items', [])]
                
            except HttpError as e:
                if e.resp.status == 404:
                    # Playlist not found - fallback to search API
                    logger.warning(f"Playlist not found for channel {channel_id}, using search API fallback")
                    
                    search_response = self.youtube.search().list(
                        part='id',
                        channelId=channel_id,
                        type='video',
                        order='date',
                        maxResults=limit
                    ).execute()
                    
                    video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
                else:
                    raise
            
            if not video_ids:
                logger.info(f"No videos found for channel {channel_id}")
                return {"videos": [], "summary": {}}
            
            # 3. Get detailed video stats
            videos_response = self.youtube.videos().list(
                part='snippet,statistics,contentDetails',
                id=','.join(video_ids)
            ).execute()
            
            videos = []
            total_views = 0
            total_likes = 0
            total_comments = 0
            
            for item in videos_response.get('items', []):
                stats = item.get('statistics', {})
                snippet = item.get('snippet', {})
                
                views = int(stats.get('viewCount', 0))
                likes = int(stats.get('likeCount', 0))
                comments = int(stats.get('commentCount', 0))
                
                total_views += views
                total_likes += likes
                total_comments += comments
                
                videos.append({
                    "video_id": item['id'],
                    "title": snippet.get('title'),
                    "published_at": snippet.get('publishedAt'),
                    "views": views,
                    "likes": likes,
                    "comments": comments,
                    "thumbnail": snippet.get('thumbnails', {}).get('medium', {}).get('url'),
                    "duration": item.get('contentDetails', {}).get('duration') # ISO 8601 format
                })
            
            # Calculate summary
            summary = {
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "avg_views": total_views / len(videos) if videos else 0,
                "engagement_rate": ((total_likes + total_comments) / total_views * 100) if total_views > 0 else 0
            }
            
            logger.info(f"Fetched Data API stats for {len(videos)} videos on channel {channel_id}")
            return {"videos": videos, "summary": summary}
            
        except HttpError as e:
            logger.error(f"Data API error for {channel_id}: {e}")
            return {"videos": [], "summary": {}}
        except Exception as e:
            logger.error(f"Unexpected error in get_video_performance_stats: {e}")
            return {"videos": [], "summary": {}}

    def get_video_retention(self, video_id: str) -> Dict[str, Any]:
        """
        [NEW] Get detailed audience retention for a specific video
        """
        if not self.analytics:
            return {"success": False, "error": "Analytics API not initialized"}
        
        try:
            # Query audience retention
            # Dimensions: elapsedVideoTimeRatio (percentage of video watched)
            # Metrics: audienceRetention
            request = self.analytics.reports().query(
                ids=f'channel=={self.profile.channel_id}',
                startDate='2020-01-01', # Start from far back to ensure coverage
                endDate=datetime.now().strftime('%Y-%m-%d'),
                metrics='audienceRetention',
                dimensions='elapsedVideoTimeRatio',
                filters=f'video=={video_id}'
            )
            response = request.execute()
            
            rows = response.get('rows', [])
            if not rows:
                return {"success": False, "error": "No retention data found"}
                
            # Parse into a cleaner format
            retention_curve = [
                {"ratio": float(row[0]), "retention": float(row[1])}
                for row in rows
            ]
            
            return {
                "success": True,
                "video_id": video_id,
                "retention_curve": retention_curve,
                "average_retention": sum(r['retention'] for r in retention_curve) / len(retention_curve) if retention_curve else 0
            }
        except Exception as e:
            logger.error(f"Failed to get retention for video {video_id}: {e}")
            return {"success": False, "error": str(e)}
