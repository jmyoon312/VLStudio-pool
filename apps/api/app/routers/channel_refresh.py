"""
Manual metadata refresh endpoint for Captain channels
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.database import get_db
from app.models import Profile, YouTubeChannel, ChannelAccess, ChannelRole

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/captain/{profile_id}/channels/refresh")
async def refresh_channel_metadata(
    profile_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Refresh channel metadata from YouTube API
    
    Args:
        profile_id: Captain profile ID
        force: Force refresh even if cache is fresh
        
    Returns:
        Status of refresh operation
    """
    
    # Verify Captain profile
    captain = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == "CAPTAIN"
    ).first()
    
    if not captain:
        raise HTTPException(404, "Captain profile not found")
    
    # Get managed channels
    channels = db.query(YouTubeChannel).join(
        ChannelAccess
    ).filter(
        ChannelAccess.profile_id == profile_id,
        ChannelAccess.role == ChannelRole.MANAGER
    ).all()
    
    if not channels:
        return {
            "status": "no_channels",
            "message": "No channels to refresh"
        }
    
    # Check if refresh needed
    def is_stale(channel):
        if not channel.metadata_updated_at:
            return True
        age = datetime.now() - channel.metadata_updated_at
        return age.total_seconds() > 24 * 3600
    
    channels_to_refresh = [ch for ch in channels if force or is_stale(ch)]
    
    if not channels_to_refresh:
        return {
            "status": "cache_fresh",
            "message": "All channels have fresh metadata",
            "total": len(channels),
            "refreshed": 0
        }
    
    # Fetch actual data from YouTube API
    from app.services.youtube_analytics import YouTubeAnalyticsService
    
    analytics_service = YouTubeAnalyticsService(db, captain)
    
    refreshed_count = 0
    failed_channels = []
    
    for channel in channels_to_refresh:
        try:
            logger.info(f"Refreshing channel: {channel.channel_id}")
            
            # Get basic stats AND metadata (channel_name, thumbnail, etc.)
            basic_stats = analytics_service.get_channel_basic_stats(channel.channel_id)
            
            # Update all fields
            channel.subscriber_count = basic_stats.get('subscriber_count', 0)
            channel.view_count = basic_stats.get('view_count', 0)
            channel.video_count = basic_stats.get('video_count', 0)
            
            # Update metadata fields (CRITICAL for display)
            if basic_stats.get('channel_name'):
                channel.channel_name = basic_stats['channel_name']
            if basic_stats.get('channel_handle'):
                channel.channel_handle = basic_stats['channel_handle']
            if basic_stats.get('thumbnail_url'):
                channel.thumbnail_url = basic_stats['thumbnail_url']
            
            logger.info(f"Updated channel metadata: {channel.channel_name} (thumbnail: {channel.thumbnail_url is not None})")
            
            # Try to get revenue data (may fail for MANAGER role)
            try:
                from googleapiclient.errors import HttpError
                revenue_data = analytics_service.get_channel_revenue(channel.channel_id, days=30)
                channel.estimated_revenue = revenue_data.get('estimated_revenue', 0.0)
                logger.info(f"Retrieved revenue data for {channel.channel_name}: ${channel.estimated_revenue}")
            except HttpError as e:
                if e.resp.status == 403:
                    logger.warning(f"No revenue access for channel {channel.channel_id} (MANAGER role or API not enabled)")
                    channel.estimated_revenue = 0.0
                else:
                    logger.error(f"Revenue API error for {channel.channel_id}: {e}")
                    channel.estimated_revenue = 0.0
            except Exception as e:
                logger.warning(f"Failed to get revenue for {channel.channel_id}: {e}")
                channel.estimated_revenue = 0.0
            
            # Update metadata timestamp
            channel.metadata_updated_at = datetime.now()
            
            refreshed_count += 1
            logger.info(f"Successfully refreshed {channel.channel_name}: {basic_stats}")
            
        except Exception as e:
            logger.error(f"Failed to refresh channel {channel.channel_id}: {e}")
            failed_channels.append(channel.channel_name or channel.channel_id)
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Refreshed {refreshed_count} channels",
        "total": len(channels),
        "refreshed": refreshed_count,
        "skipped": len(channels) - len(channels_to_refresh),
        "failed": len(failed_channels),
        "failed_channels": failed_channels
    }
