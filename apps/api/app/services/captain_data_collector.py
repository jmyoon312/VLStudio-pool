"""
Captain Data Collector Service

자동화된 데이터 수집 및 캐싱 오케스트레이터
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from app.models import (
    Profile, ProfileType, YouTubeChannel, ChannelDailyStats,
    VideoMetadataCache, Video, VideoHistory
)
from app.services.captain_cache_service import CaptainCacheService
from app.services.quota_manager import get_quota_manager, get_rate_limiter, collect_with_retry
from app.download_strategies.yt_dlp_strategy import YTDLPDownloader

logger = logging.getLogger(__name__)


class CaptainDataCollector:
    """Captain 대시보드 데이터 수집 오케스트레이터"""
    
    def __init__(self, db: Session):
        self.db = db
        self.quota_manager = get_quota_manager()
        self.rate_limiter = get_rate_limiter()
    
    async def collect_channel_stats(self):
        """채널 기본 통계 수집 (YouTube Data API ONLY - NO Analytics API)"""
        logger.info("Starting channel stats collection...")
        
        profiles = self.db.query(Profile).filter(
            Profile.profile_type == ProfileType.CAPTAIN
        ).all()
        
        for profile in profiles:
            channels = CaptainCacheService(self.db).get_managed_channels(profile.id)
            
            for channel in channels:
                try:
                    # Check quota (1 unit per channel)
                    if not self.quota_manager.check_quota(1):
                        logger.warning("Quota limit reached, skipping remaining channels")
                        return
                    
                    # YouTube Data API 호출 (Analytics API 사용 안 함)
                    from app.services.oauth2_manager import OAuth2Manager
                    
                    oauth_manager = OAuth2Manager()
                    credentials = oauth_manager.refresh_token_if_needed(profile, self.db)
                    
                    if not credentials:
                        logger.warning(f"No credentials for profile {profile.id}")
                        continue
                    
                    youtube = oauth_manager.build_youtube_service(credentials, 'youtube', 'v3')
                    
                    # Get channel statistics
                    request = youtube.channels().list(
                        part='statistics,snippet',
                        id=channel.channel_id
                    )
                    response = request.execute()
                    
                    if response.get('items'):
                        item = response['items'][0]
                        stats = item.get('statistics', {})
                        snippet = item.get('snippet', {})
                        
                        # DB 업데이트
                        channel.subscriber_count = int(stats.get('subscriberCount', 0))
                        channel.view_count = int(stats.get('viewCount', 0))
                        channel.video_count = int(stats.get('videoCount', 0))
                        channel.channel_name = snippet.get('title', channel.channel_name)
                        channel.channel_handle = snippet.get('customUrl', channel.channel_handle)
                        channel.thumbnail_url = snippet.get('thumbnails', {}).get('default', {}).get('url', channel.thumbnail_url)
                        channel.metadata_updated_at = datetime.now()
                        
                        self.db.commit()
                        
                        # Consume quota
                        self.quota_manager.consume_quota(1)
                        
                        logger.info(f"✅ Updated stats for channel {channel.channel_name}")
                    
                except Exception as e:
                    logger.error(f"Failed to collect stats for {channel.channel_id}: {e}")
                    self.db.rollback()
                
                await asyncio.sleep(1)  # Rate limiting
    
    async def detect_new_videos(self):
        """신규 영상 감지 및 즉시 수집 (YouTube Data API ONLY)"""
        logger.info("Starting new video detection...")
        
        profiles = self.db.query(Profile).filter(
            Profile.profile_type == ProfileType.CAPTAIN
        ).all()
        
        for profile in profiles:
            channels = CaptainCacheService(self.db).get_managed_channels(profile.id)
            
            for channel in channels:
                try:
                    logger.info(f"Checking for new videos in {channel.channel_name} ({channel.channel_id})...")
                    
                    # Check quota (1 unit for video list)
                    if not self.quota_manager.check_quota(1):
                        logger.warning("Quota limit reached")
                        return
                    
                    # Get latest cached video
                    latest_cached = self.db.query(VideoMetadataCache).filter(
                        VideoMetadataCache.channel_id == channel.channel_id
                    ).order_by(VideoMetadataCache.upload_date.desc()).first()
                    
                    if latest_cached:
                        logger.info(f"Latest cached video date: {latest_cached.upload_date}")
                    else:
                        logger.info("No cached videos found for this channel.")
                    
                    # Fetch recent videos using Data API
                    from app.services.oauth2_manager import OAuth2Manager
                    
                    oauth_manager = OAuth2Manager()
                    credentials = oauth_manager.refresh_token_if_needed(profile, self.db)
                    
                    if not credentials:
                        logger.warning(f"No credentials for profile {profile.id}")
                        continue
                    
                    youtube = oauth_manager.build_youtube_service(credentials, 'youtube', 'v3')
                    
                    # Get Uploads Playlist ID first (more reliable and cheaper quota)
                    channel_request = youtube.channels().list(
                        part='contentDetails',
                        id=channel.channel_id
                    )
                    channel_response = channel_request.execute()
                    
                    if not channel_response.get('items'):
                        logger.warning(f"Channel not found via API: {channel.channel_id}")
                        continue
                        
                    uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
                    logger.info(f"Retrieved uploads playlist ID: {uploads_playlist_id}")
                    
                    # Fetch recent videos from Uploads playlist
                    logger.info("Fetching recent videos from PlaylistItems API...")
                    items = []
                    
                    try:
                        from googleapiclient.errors import HttpError
                        request = youtube.playlistItems().list(
                            part='snippet,contentDetails',
                            playlistId=uploads_playlist_id,
                            maxResults=10
                        )
                        response = request.execute()
                        self.quota_manager.consume_quota(1)
                        items = response.get('items', [])
                        logger.info(f"Found {len(items)} videos from PlaylistItems API.")
                        
                    except HttpError as e:
                        logger.warning(f"Failed to fetch playlist items (404/403): {e}. Falling back to Search API.")
                        
                        # Fallback to Search API (more expensive but works)
                        request = youtube.search().list(
                            part='id',
                            channelId=channel.channel_id,
                            type='video',
                            order='date',
                            maxResults=10
                        )
                        response = request.execute()
                        self.quota_manager.consume_quota(100) # Search costs 100
                        items = response.get('items', [])
                        logger.info(f"Found {len(items)} videos from Search API (Fallback).")

                    # Find new videos
                    new_videos = []
                    for item in items:
                        # Handle different response structures
                        if 'contentDetails' in item:
                            video_id = item['contentDetails']['videoId']
                        else:
                            # Search API structure
                            video_id = item['id']['videoId']
                        
                        # Check if already cached
                        exists = self.db.query(VideoMetadataCache).filter(
                            VideoMetadataCache.video_id == video_id
                        ).first()
                        
                        if not exists:
                            logger.info(f"New video found: {video_id}")
                            new_videos.append(video_id)
                        else:
                            # logger.debug(f"Video {video_id} already cached.")
                            pass
                    
                    if not new_videos:
                        logger.info("No new videos to collect.")
                    
                    # Collect metadata for new videos
                    for video_id in new_videos:
                        logger.info(f"Collecting metadata for new video: {video_id}")
                        await self.collect_video_metadata(video_id, channel.channel_id)
                        logger.info(f"Optional sleep for rate limiting...")
                        await asyncio.sleep(2)  # yt-dlp rate limiting
                    
                    if new_videos:
                        logger.info(f"✅ Detected and collected {len(new_videos)} new videos for {channel.channel_name}")
                    
                except Exception as e:
                    logger.error(f"Failed to detect new videos for {channel.channel_id}: {e}")
    
    async def collect_video_metadata(self, video_id: str, channel_id: str):
        """yt-dlp로 영상 메타데이터 수집"""
        
        async def _collect():
            try:
                logger.info(f"🚀 yt-dlp: Starting metadata collection for {video_id}...")
                downloader = YTDLPDownloader()
                info = downloader.get_video_info(f"https://youtube.com/watch?v={video_id}")
                
                if not info:
                    logger.warning(f"❌ yt-dlp: No info returned for {video_id}")
                    return
                
                logger.info(f"✅ yt-dlp: Successfully downloaded info for '{info.get('title', 'Unknown')}'")
                
                # Parse upload date
                upload_date_str = info.get('upload_date', '20000101')
                upload_date = datetime.strptime(upload_date_str, '%Y%m%d')
                
                # Create or update cache entry
                cache_entry = VideoMetadataCache(
                    video_id=video_id,
                    channel_id=channel_id,
                    title=info.get('title', 'Unknown'),
                    upload_date=upload_date,
                    duration=info.get('duration', 0),
                    thumbnail_url=info.get('thumbnail'),
                    view_count=info.get('view_count', 0),
                    like_count=info.get('like_count', 0),
                    comment_count=info.get('comment_count', 0),
                    heatmap_json=info.get('heatmap', []),
                    tags=info.get('tags', []),
                    categories=info.get('categories', []),
                    last_updated=datetime.now(),
                    update_frequency='daily'
                )
                
                self.db.merge(cache_entry)
                self.db.commit()
                
                logger.info(f"✅ Collected metadata for video {video_id}")
                
            except Exception as e:
                logger.error(f"Failed to collect metadata for {video_id}: {e}")
                self.db.rollback()
                raise
        
        # Execute with retry and rate limiting
        await collect_with_retry(_collect, rate_limiter=self.rate_limiter)
    
    async def daily_metadata_update(self):
        """일일 메타데이터 업데이트 (최근 30일 영상)"""
        logger.info("Starting daily metadata update...")
        
        cutoff_date = datetime.now() - timedelta(days=30)
        
        videos_to_update = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.upload_date >= cutoff_date,
            VideoMetadataCache.update_frequency == 'daily'
        ).all()
        
        logger.info(f"Updating {len(videos_to_update)} videos...")
        
        for video in videos_to_update:
            await self.collect_video_metadata(video.video_id, video.channel_id)
            await asyncio.sleep(2)  # Rate limiting
    
    async def weekly_archive_update(self):
        """주간 아카이브 업데이트 (30-90일 영상)"""
        logger.info("Starting weekly archive update...")
        
        start_date = datetime.now() - timedelta(days=90)
        end_date = datetime.now() - timedelta(days=30)
        
        videos_to_update = self.db.query(VideoMetadataCache).filter(
            VideoMetadataCache.upload_date.between(start_date, end_date),
            VideoMetadataCache.update_frequency == 'weekly'
        ).all()
        
        logger.info(f"Updating {len(videos_to_update)} archived videos...")
        
        for video in videos_to_update:
            await self.collect_video_metadata(video.video_id, video.channel_id)
            await asyncio.sleep(2)
    
    async def aggregate_daily_stats(self):
        """일일 통계 집계 (ChannelDailyStats 생성)"""
        logger.info("Starting daily stats aggregation...")
        
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        channels = self.db.query(YouTubeChannel).all()
        
        for channel in channels:
            try:
                # Get all videos for this channel
                videos = self.db.query(VideoMetadataCache).filter(
                    VideoMetadataCache.channel_id == channel.channel_id
                ).all()
                
                # Calculate aggregates
                total_likes = sum(v.like_count for v in videos)
                total_comments = sum(v.comment_count for v in videos)
                total_views = sum(v.view_count for v in videos)
                avg_engagement = (total_likes + total_comments) / total_views * 100 if total_views > 0 else 0
                
                # Get previous day stats for delta calculation
                yesterday = today - timedelta(days=1)
                prev_stats = self.db.query(ChannelDailyStats).filter(
                    ChannelDailyStats.channel_id == channel.channel_id,
                    ChannelDailyStats.stat_date == yesterday
                ).first()
                
                daily_view_increase = channel.view_count - (prev_stats.view_count if prev_stats else 0)
                daily_sub_increase = channel.subscriber_count - (prev_stats.subscriber_count if prev_stats else 0)
                
                # Create daily stats entry
                daily_stats = ChannelDailyStats(
                    id=str(uuid.uuid4()),
                    channel_id=channel.channel_id,
                    stat_date=today,
                    subscriber_count=channel.subscriber_count,
                    view_count=channel.view_count,
                    video_count=channel.video_count,
                    total_likes=total_likes,
                    total_comments=total_comments,
                    avg_engagement_rate=avg_engagement,
                    daily_view_increase=daily_view_increase,
                    daily_subscriber_increase=daily_sub_increase
                )
                
                self.db.add(daily_stats)
                logger.info(f"✅ Aggregated daily stats for {channel.channel_name}")
                
            except Exception as e:
                logger.error(f"Failed to aggregate stats for {channel.channel_id}: {e}")
        
        self.db.commit()
        logger.info("Daily stats aggregation completed")


# Singleton instance
_collector = None


def get_data_collector(db: Session) -> CaptainDataCollector:
    """Get or create CaptainDataCollector instance"""
    global _collector
    if _collector is None:
        _collector = CaptainDataCollector(db)
    return _collector
