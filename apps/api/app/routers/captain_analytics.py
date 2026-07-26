"""
Captain Analytics API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models import Profile, BrandChannel as YouTubeChannel, ChannelAnalytics
from app.services.youtube_analytics import YouTubeAnalyticsService
from app.services.captain_cache_service import CaptainCacheService

logger = logging.getLogger(__name__)

def get_total_seconds(dt):
    if not dt: return 0
    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    return (now - dt).total_seconds()

router = APIRouter(tags=["Captain Analytics"])
@router.get("/{profile_id}/channels")
async def get_captain_channels(
    profile_id: str,
    view: str = "list",  # "list" or "dashboard"
    db: Session = Depends(get_db)
):
    """
    Unified channel data endpoint with quota-efficient caching
    
    Args:
        profile_id: Captain profile ID
        view: "list" for minimal info, "dashboard" for full analytics
    
    Returns:
        - view=list: Essential info only (name, status, IP)
        - view=dashboard: Full metadata + analytics
    """
    
    # 1. Captain 프로필 확인 (all 처리 추가)
    try:
        if profile_id == "all":
            managed_channels = db.query(YouTubeChannel).all()
        else:
            captain = db.query(Profile).filter(
                Profile.id == profile_id,
                Profile.profile_type == "CAPTAIN"
            ).first()
            
            if not captain:
                print(f"⚠️ [CaptainAPI] Profile not found or not CAPTAIN: {profile_id}")
                raise HTTPException(404, "Captain profile not found")

            # 2. 관리 중인 모든 채널 조회 (공통)
            from app.services.captain_cache_service import CaptainCacheService
            managed_channels = CaptainCacheService(db).get_managed_channels(profile_id)
    except Exception as e:
        logger.error(f"Error fetching managed channels: {e}")
        raise HTTPException(500, f"Internal Server Error during channel fetch: {str(e)}")
    
    # 3. 채널이 없는 경우 조기 반환 (500 에러 방지)
    if not managed_channels:
        if view == "list":
            return []
        return {
            "total_stats": {
                "total_subscribers": 0,
                "total_views": 0,
                "total_videos": 0,
                "channel_count": 0
            },
            "warnings": [],
            "channels": []
        }
    
    if view == "list":
        # 채널 목록: 필수 정보만 (API 호출 없음)
        return [
            {
                "channel_id": ch.channel_id,
                "channel_name": ch.channel_name,
                "channel_handle": ch.channel_handle,
                "thumbnail_url": ch.thumbnail_url,
                "status": ch.status,
                "last_used_ip": ch.last_used_ip,
                "last_accessed_at": ch.last_accessed_at,
                "quarantine_reason": ch.quarantine_reason,
                "is_stale": get_total_seconds(ch.metadata_updated_at) > 86400 if ch.metadata_updated_at else True,
                # [SAIF] Security Fields
                "engine_mode": getattr(ch, 'engine_mode', 'standard') or 'standard',
                "stealth_trust_score": getattr(ch, 'stealth_trust_score', 0) or 0,
                "is_network_isolated": getattr(ch, 'is_network_isolated', False) or False
            }
            for ch in managed_channels
        ]
    
    elif view == "dashboard":
        # 대시보드: 전체 정보 + 분석
        result = []
        
        for ch in managed_channels:
            # 기본 메타데이터
            channel_data = {
                "channel_id": ch.channel_id,
                "channel_name": ch.channel_name,
                "channel_handle": ch.channel_handle,
                "thumbnail_url": ch.thumbnail_url,
                "status": ch.status,
                "subscriber_count": ch.subscriber_count,
                "video_count": ch.video_count,
                "view_count": getattr(ch, 'view_count', 0),
                "last_upload_date": getattr(ch, 'last_upload_date', None),
                "metadata_updated_at": ch.metadata_updated_at,
                "is_stale": get_total_seconds(ch.metadata_updated_at) > 86400 if ch.metadata_updated_at else True,
                # [SAIF] Security Fields
                "engine_mode": getattr(ch, 'engine_mode', 'standard') or 'standard',
                "stealth_trust_score": getattr(ch, 'stealth_trust_score', 0) or 0,
                "is_network_isolated": getattr(ch, 'is_network_isolated', False) or False
            }
            
            # 분석 데이터 (최근 30일) - ChannelAnalytics uses period_start, not date
            analytics = db.query(ChannelAnalytics).filter(
                ChannelAnalytics.channel_id == ch.channel_id,
                ChannelAnalytics.period_start >= datetime.now() - timedelta(days=30)
            ).order_by(ChannelAnalytics.period_start).all()
            
            channel_data["analytics"] = [
                {
                    "date": str(a.period_start.date()) if a.period_start else None,
                    "views": a.view_count or 0,
                    "subscribers": a.subscriber_count or 0,
                    "estimated_revenue": a.estimated_revenue or 0.0
                }
                for a in analytics
            ]
            
            result.append(channel_data)
        
        # 전체 통계 계산
        total_stats = {
            "total_subscribers": sum(ch.subscriber_count or 0 for ch in managed_channels),
            "total_views": sum((getattr(ch, 'view_count', 0) or 0) for ch in managed_channels),
            "total_videos": sum(ch.video_count or 0 for ch in managed_channels),
            "channel_count": len(managed_channels)
        }
        
        return {
            "total_stats": total_stats,
            "warnings": [],  # Mock - would check for channel issues
            "channels": result
        }
    
    else:
        raise HTTPException(400, f"Invalid view parameter: {view}")


# Keep original dashboard endpoint for backward compatibility
@router.get("/{profile_id}/dashboard")
async def get_captain_dashboard(
    profile_id: str,
    period: int = 30,  # days
    db: Session = Depends(get_db)
):
    """
    Captain 대시보드 데이터 조회 (Backward compatibility)
    Redirects to unified endpoint with view=dashboard
    """
    return await get_captain_channels(profile_id, view="dashboard", db=db)


# ============================================
# Advanced Analytics Endpoints
# ============================================

@router.get("/{profile_id}/analytics/engagement")
async def get_engagement_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get engagement analytics (CACHE ONLY - NO API CALLS)
    """
    from app.services.captain_cache_service import CaptainCacheService
    
    cache_service = CaptainCacheService(db)
    data = cache_service.get_engagement_metrics(profile_id, days)
    
    return {
        "status": "success",
        "data": data.get("daily_data", []),
        "period_days": days,
        "total_engagement_rate": data.get("total_engagement_rate", 0)
    }



@router.get("/{profile_id}/analytics/traffic-sources")
async def get_traffic_sources_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get traffic sources
    Data API Fallback: Returns empty list as this is impossible to get without Analytics API
    """
    return []


@router.get("/{profile_id}/analytics/demographics")
async def get_demographics_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get demographics
    Data API Fallback: Returns empty list
    """
    return {"age_groups": [], "gender": []}


@router.get("/{profile_id}/analytics/watch-time")
async def get_watch_time_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get watch time trend (CACHE ONLY - NO API CALLS)
    """
    from app.services.captain_cache_service import CaptainCacheService
    
    cache_service = CaptainCacheService(db)
    data = cache_service.get_watch_time_trend(profile_id, days)
    
    return data.get("daily_data", [])



# ============================================
# Channel Analytics Refresh
# ============================================


@router.get("/{profile_id}/channel/{channel_id}/details")
async def get_channel_details(
    profile_id: str,
    channel_id: str,
    db: Session = Depends(get_db)
):
    """
    특정 채널의 상세 분석 데이터 조회
    """
    
    # 1. 권한 확인
    access = db.query(ChannelAccess).filter(
        ChannelAccess.profile_id == profile_id,
        ChannelAccess.channel_id == channel_id
    ).first()
    
    if not access:
        raise HTTPException(403, "No access to this channel")
    
    # 2. 채널 정보 조회
    channel = db.query(YouTubeChannel).filter(
        YouTubeChannel.channel_id == channel_id
    ).first()
    
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    # 3. 분석 데이터 조회
    analytics = db.query(ChannelAnalytics).filter(
        ChannelAnalytics.channel_id == channel_id
    ).order_by(ChannelAnalytics.last_updated.desc()).first()
    
    if not analytics:
        return {
            "channel": {
                "channel_id": channel.channel_id,
                "channel_name": channel.channel_name,
                "channel_handle": channel.channel_handle,
                "thumbnail_url": channel.thumbnail_url
            },
            "analytics": None,
            "message": "No analytics data available. Please refresh."
        }
    
    return {
        "channel": {
            "channel_id": channel.channel_id,
            "channel_name": channel.channel_name,
            "channel_handle": channel.channel_handle,
            "thumbnail_url": channel.thumbnail_url
        },
        "analytics": {
            "subscriber_count": analytics.subscriber_count,
            "view_count": analytics.view_count,
            "video_count": analytics.video_count,
            "estimated_revenue": analytics.estimated_revenue,
            "ad_impressions": analytics.ad_impressions,
            "cpm": analytics.cpm,
            "likes": analytics.likes,
            "comments": analytics.comments,
            "shares": analytics.shares,
            "watch_time_minutes": analytics.watch_time_minutes,
            "subscribers_gained": analytics.subscribers_gained,
            "subscribers_lost": analytics.subscribers_lost,
            "health_score": analytics.health_score,
            "can_upload": analytics.can_upload,
            "is_monetized": analytics.is_monetized,
            "period_start": analytics.period_start.isoformat() if analytics.period_start else None,
            "period_end": analytics.period_end.isoformat() if analytics.period_end else None,
            "last_updated": analytics.last_updated.isoformat() if analytics.last_updated else None
        }
    }


@router.post("/{profile_id}/refresh")
async def refresh_captain_analytics(
    profile_id: str,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Captain 관리 채널의 분석 데이터 강제 갱신
    """
    
    # 1. Captain 프로필 확인
    captain = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == "CAPTAIN"
    ).first()
    
    if not captain:
        raise HTTPException(404, "Captain profile not found")
    
    # 2. OAuth2 인증 확인
    if not captain.client_secret_json or not captain.refresh_token:
        raise HTTPException(400, "Captain OAuth2 credentials not configured")
    
    # 3. 관리 중인 채널 조회
    managed_channels = CaptainCacheService(db).get_managed_channels(profile_id)
    
    if not managed_channels:
        return {"message": "No managed channels found", "refreshed": 0}
    
    # 4. YouTube Analytics 서비스 초기화
    analytics_service = YouTubeAnalyticsService(db, captain)
    
    # 5. 각 채널 데이터 갱신
    refreshed_count = 0
    errors = []
    
    for channel in managed_channels:
        try:
            # 기본 통계 조회
            basic_stats = analytics_service.get_channel_basic_stats(channel.channel_id)
            
            # 수익 정보 조회 (가능한 경우)
            try:
                revenue_stats = analytics_service.get_channel_revenue(channel.channel_id)
            except Exception as e:
                logger.warning(f"Revenue data not available for {channel.channel_id}: {e}")
                revenue_stats = {}
            
            # 참여도 조회
            engagement_stats = {}
            try:
                engagement_stats = analytics_service.get_channel_engagement(channel.channel_id)
            except Exception as e:
                logger.warning(f"Engagement data not available for {channel.channel_id}: {e}")
            
            # Fallback check: if no engagement data, try Data API
            if not engagement_stats.get("likes") and not engagement_stats.get("comments"):
                try:
                    logger.info(f"Using Data API fallback for {channel.channel_id} engagement stats")
                    v_stats = analytics_service.get_video_performance_stats(channel.channel_id, limit=30)
                    summary = v_stats.get("summary", {})
                    engagement_stats["likes"] = summary.get("total_likes", 0)
                    engagement_stats["comments"] = summary.get("total_comments", 0)
                    # Note: shares, watch_time, subscribers data not available via Data API
                except Exception as ex:
                    logger.warning(f"Data API fallback failed for {channel.channel_id}: {ex}")
            
            # 건강 상태 확인
            try:
                health_status = analytics_service.check_channel_health(channel.channel_id)
            except Exception as e:
                logger.warning(f"Health check failed for {channel.channel_id}: {e}")
                health_status = {"health_score": 0, "can_upload": None, "is_monetized": None}
            
            # ChannelAnalytics 업데이트 또는 생성
            analytics = ChannelAnalytics(
                channel_id=channel.channel_id,
                subscriber_count=basic_stats.get("subscriber_count", 0),
                view_count=basic_stats.get("view_count", 0),
                video_count=basic_stats.get("video_count", 0),
                estimated_revenue=revenue_stats.get("estimated_revenue", 0.0),
                ad_impressions=revenue_stats.get("ad_impressions", 0),
                cpm=revenue_stats.get("cpm", 0.0),
                likes=engagement_stats.get("likes", 0),
                comments=engagement_stats.get("comments", 0),
                shares=engagement_stats.get("shares", 0),
                watch_time_minutes=engagement_stats.get("watch_time_minutes", 0),
                subscribers_gained=engagement_stats.get("subscribers_gained", 0),
                subscribers_lost=engagement_stats.get("subscribers_lost", 0),
                health_score=health_status.get("health_score", 0),
                can_upload=health_status.get("can_upload"),
                is_monetized=health_status.get("is_monetized"),
                period_start=datetime.now() - timedelta(days=30),
                period_end=datetime.now(),
                last_updated=datetime.now()
            )
            
            db.add(analytics)
            refreshed_count += 1
            
        except Exception as e:
            logger.error(f"Failed to refresh analytics for {channel.channel_id}: {e}")
            errors.append({
                "channel_id": channel.channel_id,
                "channel_name": channel.channel_name,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "message": f"Refreshed {refreshed_count} out of {len(managed_channels)} channels",
        "refreshed": refreshed_count,
        "total": len(managed_channels),
        "errors": errors if errors else None
    }


# ============================================
# Helper Functions
# ============================================

def detect_channel_warnings(channel: YouTubeChannel, analytics: ChannelAnalytics) -> List[Dict[str, Any]]:
    """
    채널 경고 감지
    """
    warnings = []
    
    # 1. 업로드 제한 감지
    if analytics.can_upload is False:
        warnings.append({
            "level": "error",
            "channel_id": channel.channel_id,
            "channel_name": channel.channel_name,
            "type": "upload_restriction",
            "message": f"{channel.channel_name}: 업로드 제한 감지"
        })
    
    # 2. 수익 창출 비활성화 감지
    if analytics.is_monetized is False:
        warnings.append({
            "level": "warning",
            "channel_id": channel.channel_id,
            "channel_name": channel.channel_name,
            "type": "monetization_disabled",
            "message": f"{channel.channel_name}: 수익 창출 비활성화"
        })
    
    # 3. 낮은 건강 점수
    if analytics.health_score and analytics.health_score < 70:
        warnings.append({
            "level": "warning",
            "channel_id": channel.channel_id,
            "channel_name": channel.channel_name,
            "type": "low_health_score",
            "message": f"{channel.channel_name}: 건강 점수 낮음 ({analytics.health_score}%)"
        })
    
    # 4. 구독자 급감
    if analytics.subscribers_lost and analytics.subscribers_gained:
        net_change = analytics.subscribers_gained - analytics.subscribers_lost
        if net_change < -100:
            warnings.append({
                "level": "info",
                "channel_id": channel.channel_id,
                "channel_name": channel.channel_name,
                "type": "subscriber_drop",
                "message": f"{channel.channel_name}: 구독자 {abs(net_change)}명 감소"
            })
    
    return warnings


# ============================================
# Enhanced Analytics with yt-dlp Data
# ============================================

@router.get("/{profile_id}/analytics/ytdlp-enhanced")
async def get_ytdlp_enhanced_analytics(
    profile_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    yt-dlp 메타데이터 기반 고급 분석 데이터
    
    Returns:
        - summary: 전체 통계 요약
        - health_score: 채널 건강 점수
        - video_performance: 영상별 성과 데이터
        - category_distribution: 카테고리별 분포
        - retention_data: 시청 유지율 데이터
    """
    from app.models import VideoMetadataCache, ChannelDailyStats
    
    # Verify profile
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == ProfileType.CAPTAIN
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Captain profile not found")
    
    # Get managed channels
    channels = CaptainCacheService(db).get_managed_channels(profile_id)
    
    if not channels:
        return {
            "summary": {
                "total_videos": 0,
                "total_views": 0,
                "total_likes": 0,
                "total_comments": 0,
                "avg_engagement_rate": 0
            },
            "health_score": {},
            "video_performance": [],
            "category_distribution": {},
            "retention_data": []
        }
    
    # Get all videos from cache
    cutoff_date = datetime.now() - timedelta(days=days)
    channel_ids = [c.channel_id for c in channels]
    
    all_videos = db.query(VideoMetadataCache).filter(
        VideoMetadataCache.channel_id.in_(channel_ids),
        VideoMetadataCache.upload_date >= cutoff_date
    ).order_by(VideoMetadataCache.upload_date.desc()).all()
    
    # Build video performance data
    video_performance = []
    for video in all_videos:
        engagement_rate = 0
        if video.view_count > 0:
            engagement_rate = (video.like_count + video.comment_count) / video.view_count * 100
        
        video_performance.append({
            "video_id": video.video_id,
            "title": video.title,
            "thumbnail": video.thumbnail_url,
            "upload_date": video.upload_date.isoformat() if video.upload_date else None,
            "views": video.view_count,
            "likes": video.like_count,
            "comments": video.comment_count,
            "duration": video.duration,
            "engagement_rate": round(engagement_rate, 2),
            "heatmap": video.heatmap_json or [],
            "categories": video.categories or [],
            "tags": video.tags or []
        })
    
    # Calculate summary
    total_views = sum(v.view_count for v in all_videos)
    total_likes = sum(v.like_count for v in all_videos)
    total_comments = sum(v.comment_count for v in all_videos)
    avg_engagement = (total_likes + total_comments) / total_views * 100 if total_views > 0 else 0
    
    # Calculate health score
    health_score = calculate_health_score(all_videos)
    
    # Category distribution
    category_dist = {}
    for video in all_videos:
        for cat in (video.categories or []):
            if cat not in category_dist:
                category_dist[cat] = {
                    "video_count": 0,
                    "total_views": 0,
                    "total_engagement": 0
                }
            category_dist[cat]["video_count"] += 1
            category_dist[cat]["total_views"] += video.view_count
            if video.view_count > 0:
                category_dist[cat]["total_engagement"] += (video.like_count + video.comment_count) / video.view_count * 100
    
    # Retention data (top 10 videos with heatmap)
    retention_data = []
    for video in all_videos[:10]:
        if video.heatmap_json:
            avg_retention = sum(seg.get('value', 0) for seg in video.heatmap_json) / len(video.heatmap_json) if video.heatmap_json else 0
            
            retention_data.append({
                "video_id": video.video_id,
                "title": video.title,
                "segments": video.heatmap_json,
                "avg_retention": round(avg_retention, 3)
            })
    
    return {
        "summary": {
            "total_videos": len(all_videos),
            "total_views": total_views,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "avg_engagement_rate": round(avg_engagement, 2)
        },
        "health_score": health_score,
        "video_performance": video_performance,
        "category_distribution": category_dist,
        "retention_data": retention_data
    }


def calculate_health_score(videos: List) -> Dict[str, Any]:
    """Calculate channel health score from video data"""
    if not videos:
        return {
            "upload_consistency": 0,
            "engagement_quality": 0,
            "growth_momentum": 0,
            "content_diversity": 0,
            "total": 0
        }
    
    # 1. Upload Consistency (최근 30일 기준)
    recent_uploads = [v for v in videos if (datetime.now() - v.upload_date).days <= 30]
    upload_score = min(25, len(recent_uploads) * 2)  # 주 3회 = 12개 = 24점
    
    # 2. Engagement Quality
    total_engagement = 0
    total_views = 0
    for v in videos:
        if v.view_count > 0:
            total_engagement += (v.like_count + v.comment_count) / v.view_count * 100
            total_views += v.view_count
    
    avg_engagement = total_engagement / len(videos) if videos else 0
    engagement_score = min(25, avg_engagement * 5)  # 5% = 25점
    
    # 3. Growth Momentum (최근 7일 vs 이전 7일)
    recent_7 = [v for v in videos if (datetime.now() - v.upload_date).days <= 7]
    previous_7 = [v for v in videos if 7 < (datetime.now() - v.upload_date).days <= 14]
    
    recent_views = sum(v.view_count for v in recent_7)
    previous_views = sum(v.view_count for v in previous_7)
    
    growth_rate = (recent_views - previous_views) / previous_views if previous_views > 0 else 0
    growth_score = min(25, max(0, growth_rate * 100))
    
    # 4. Content Diversity (태그 다양성)
    all_tags = set()
    for v in videos:
        all_tags.update(v.tags or [])
    diversity_score = min(25, len(all_tags) / 2)  # 50개 태그 = 25점
    
    total = upload_score + engagement_score + growth_score + diversity_score
    
    return {
        "upload_consistency": round(upload_score, 1),
        "engagement_quality": round(engagement_score, 1),
        "growth_momentum": round(growth_score, 1),
        "content_diversity": round(diversity_score, 1),
        "total": round(total, 1)
    }


@router.get("/system/monitoring")
async def get_system_monitoring(db: Session = Depends(get_db)):
    """
    시스템 모니터링 데이터
    
    Returns:
        - quota: API 쿼타 사용량
        - jobs: 스케줄러 작업 상태
        - cache_stats: 캐시 통계
    """
    from app.services.quota_manager import get_quota_manager
    from app.services.captain_scheduler import captain_scheduler
    from app.models import VideoMetadataCache, ChannelDailyStats
    
    quota_manager = get_quota_manager()
    
    # Quota stats
    quota_stats = {
        "used": 10000 - quota_manager.get_remaining_quota(),
        "remaining": quota_manager.get_remaining_quota(),
        "percentage": quota_manager.get_usage_percentage()
    }
    
    # Scheduler jobs
    jobs_info = {
        "active": captain_scheduler.is_running,
        "total": len(captain_scheduler.scheduler.get_jobs()) if captain_scheduler.is_running else 0
    }
    
    # Cache stats
    video_cache_count = db.query(VideoMetadataCache).count()
    daily_stats_count = db.query(ChannelDailyStats).count()
    
    # Recent updates
    recent_video = db.query(VideoMetadataCache).order_by(
        VideoMetadataCache.last_updated.desc()
    ).first()
    
    cache_stats = {
        "video_cache_count": video_cache_count,
        "daily_stats_count": daily_stats_count,
        "last_video_update": recent_video.last_updated.isoformat() if recent_video else None
    }
    
    return {
        "quota": quota_stats,
        "jobs": jobs_info,
        "cache": cache_stats,
        "timestamp": datetime.now().isoformat()
    }


@router.post("/{profile_id}/collect-now")
async def trigger_manual_collection(
    profile_id: str,
    db: Session = Depends(get_db)
):
    """
    수동으로 데이터 수집 트리거
    
    캐시가 비어있을 때 즉시 데이터를 수집하기 위한 엔드포인트
    """
    from app.services.captain_data_collector import CaptainDataCollector
    
    # Verify profile
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == ProfileType.CAPTAIN
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Captain profile not found")
    
    try:
        collector = CaptainDataCollector(db)
        
        # Run collection tasks
        import asyncio
        
        # Collect channel stats
        await collector.collect_channel_stats()
        
        # Detect new videos
        await collector.detect_new_videos()
        
        return {
            "status": "success",
            "message": "Data collection triggered successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Manual collection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Collection failed: {str(e)}")

@router.get("/{profile_id}/analytics/top-videos")
async def get_top_videos_analytics(
    profile_id: str, 
    limit: int = 10, 
    db: Session = Depends(get_db)
):
    """
    상위 조회수 영상 목록 조회
    """
    # Verify profile
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.profile_type == ProfileType.CAPTAIN
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Captain profile not found")
        
    cache_service = CaptainCacheService(db)
    
    # Check if managed channels exist
    channels = cache_service.get_managed_channels(profile_id)
    if not channels:
        return {"videos": [], "summary": {}}
        
    data = cache_service.get_video_performance(profile_id, limit=limit)
    return data
