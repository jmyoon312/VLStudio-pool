# Analytics endpoints implementation
# Add these after the overview endpoint (around line 273)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import defaultdict
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models import BrandChannel as YouTubeChannel, Profile

logger = logging.getLogger(__name__)

router = APIRouter()
@router.get("/captain/{profile_id}/analytics/engagement")
async def get_captain_engagement_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get engagement analytics for Captain's channels
    Uses YouTube Data API v3 (accessible to managers)
    """
    from app.services.youtube_analytics import YouTubeAnalyticsService
    
    # Get Captain profile
    captain = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == "CAPTAIN",
        Profile.status == "ACTIVE"
    ).first()
    
    if not captain:
        raise HTTPException(404, "Captain profile not found")
    
    # Initialize analytics service
    analytics_service = YouTubeAnalyticsService(db, captain)
    
    if not analytics_service.youtube:
        raise HTTPException(500, "Failed to initialize YouTube service")
    
    # Get channels managed by this Captain
    channels = db.query(YouTubeChannel).join(ChannelAccess, ChannelAccess.channel_id == YouTubeChannel.channel_id).filter(
        ChannelAccess.profile_id == profile_id,
        ChannelAccess.role == ChannelRole.MANAGER,
        YouTubeChannel.status != "QUARANTINED"
    ).all()
    
    if not channels:
        return {"daily_data": [], "summary": {"avg_engagement_rate": 0, "total_likes": 0, "total_comments": 0, "total_views": 0}}
    
    # Aggregate engagement data from all channels
    all_daily_data = defaultdict(lambda: {'views': 0, 'likes': 0, 'comments': 0})
    total_views = 0
    total_likes = 0
    total_comments = 0
    
    for channel in channels:
        try:
            # Get video performance stats (uses Data API, not Analytics API)
            result = analytics_service.get_video_performance_stats(channel.channel_id, limit=50)
            videos = result.get('videos', [])
            
            # Filter by date range
            cutoff_date = datetime.now() - timedelta(days=days)
            
            for video in videos:
                try:
                    pub_date = datetime.fromisoformat(video['published_at'].replace('Z', '+00:00'))
                    if pub_date.replace(tzinfo=None) >= cutoff_date:
                        date_key = pub_date.date().isoformat()
                        all_daily_data[date_key]['views'] += video['views']
                        all_daily_data[date_key]['likes'] += video['likes']
                        all_daily_data[date_key]['comments'] += video['comments']
                        
                        total_views += video['views']
                        total_likes += video['likes']
                        total_comments += video['comments']
                except:
                    continue
        except Exception as e:
            logger.error(f"Failed to get engagement for channel {channel.channel_id}: {e}")
            continue
    
    # Format daily data
    daily_data = []
    for date_str in sorted(all_daily_data.keys()):
        stats = all_daily_data[date_str]
        engagement_rate = ((stats['likes'] + stats['comments']) / stats['views']) if stats['views'] > 0 else 0
        
        daily_data.append({
            'date': date_str,
            'views': stats['views'],
            'likes': stats['likes'],
            'comments': stats['comments'],
            'engagement_rate': round(engagement_rate, 4)
        })
    
    avg_engagement_rate = ((total_likes + total_comments) / total_views) if total_views > 0 else 0
    
    return {
        "daily_data": daily_data,
        "summary": {
            "avg_engagement_rate": round(avg_engagement_rate, 4),
            "total_likes": total_likes,
            "total_comments": total_comments,
            "total_views": total_views
        }
    }


@router.get("/captain/{profile_id}/analytics/top-videos")
async def get_captain_top_videos(
    profile_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get top performing videos across Captain's channels
    """
    from app.services.youtube_analytics import YouTubeAnalyticsService
    
    # Get Captain profile
    captain = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == "CAPTAIN",
        Profile.status == "ACTIVE"
    ).first()
    
    if not captain:
        raise HTTPException(404, "Captain profile not found")
    
    # Initialize analytics service
    analytics_service = YouTubeAnalyticsService(db, captain)
    
    if not analytics_service.youtube:
        raise HTTPException(500, "Failed to initialize YouTube service")
    
    # Get channels
    channels = db.query(YouTubeChannel).join(ChannelAccess, ChannelAccess.channel_id == YouTubeChannel.channel_id).filter(
        ChannelAccess.profile_id == profile_id,
        ChannelAccess.role == ChannelRole.MANAGER,
        YouTubeChannel.status != "QUARANTINED"
    ).all()
    
    if not channels:
        return {"videos": []}
    
    # Collect all videos from all channels
    all_videos = []
    
    for channel in channels:
        try:
            result = analytics_service.get_video_performance_stats(channel.channel_id, limit=30)
            videos = result.get('videos', [])
            
            for video in videos:
                # Calculate engagement rate
                views = video['views']
                engagement = video['likes'] + video['comments']
                video['engagement_rate'] = (engagement / views) if views > 0 else 0
                video['channel_name'] = channel.channel_name
                video['channel_id'] = channel.channel_id
                all_videos.append(video)
        except Exception as e:
            logger.error(f"Failed to get videos for channel {channel.channel_id}: {e}")
            continue
    
    # Sort by views and get top N
    sorted_videos = sorted(all_videos, key=lambda x: x['views'], reverse=True)
    
    return {"videos": sorted_videos[:limit]}


# Add import at the top of the file if not already present
from collections import defaultdict
