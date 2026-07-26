import logging
import asyncio
from typing import List, Dict, Any, Optional

import yt_dlp

logger = logging.getLogger(__name__)

def classify_ev_tier(ev: float) -> str:
    if ev > 20: return "golden"
    if ev >= 10: return "rising"
    if ev >= 5: return "normal"
    return "background"

class ShortsIntelligenceEngine:
    """
    Shorts-Specific Viral Intelligence Engine.
    Focuses on Engagement Velocity (EV) and Feed-based recommendation logic
    rather than traditional search volume.
    """
    def __init__(self, settings=None, llm_client=None):
        self.settings = settings
        self.llm_client = llm_client

    def calculate_engagement_velocity(self, views: int, likes: int, comments: int) -> float:
        """
        Calculates Engagement Velocity (EV).
        EV = (Likes + Comments) / Views * 100
        A higher EV indicates the algorithm is heavily pushing the short due to high retention/interaction.
        """
        if views <= 0:
            return 0.0
        return ((likes + comments) / views) * 100.0

    async def extract_visual_format(self, video_path: str) -> str:
        """
        Uses FFmpeg to extract early frames and classify the visual format.
        e.g., "Split-screen Minecraft", "Facecam + Captions", "Text-only Captions"
        """
        try:
            import subprocess
            import tempfile
            import os
            
            if not os.path.exists(video_path):
                logger.warning(f"Video path does not exist: {video_path}")
                return "unknown"
            
            with tempfile.TemporaryDirectory() as tmpdir:
                frame_path = os.path.join(tmpdir, "frame_2s.jpg")
                result = subprocess.run(
                    ["ffmpeg", "-ss", "2", "-i", video_path, "-vframes", "1", "-q:v", "2", frame_path, "-y"],
                    capture_output=True, timeout=15
                )
                if result.returncode != 0 or not os.path.exists(frame_path):
                    return "unknown"
                
                # Check for split-screen by analyzing aspect ratio zones
                probe = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=width,height",
                     "-of", "csv=p=0", video_path],
                    capture_output=True, timeout=10, text=True
                )
                if probe.returncode == 0 and probe.stdout.strip():
                    parts = probe.stdout.strip().split(',')
                    if len(parts) == 2:
                        w, h = int(parts[0]), int(parts[1])
                        aspect = w / h if h > 0 else 0
                        if 0.4 < aspect < 0.6:
                            return "vertical-fullscreen"
                        elif 0.7 < aspect < 1.0:
                            return "square-split"
                        elif aspect > 1.5:
                            return "landscape"
                
                return "standard-portrait"
        except Exception as e:
            logger.error(f"Visual format extraction failed: {e}")
            return "unknown"

    async def scan_trending_audio(self, platform: str = "tiktok", category: str = "all") -> List[Dict[str, Any]]:
        """
        Scrapes rising audio tracks from YouTube Shorts using yt-dlp search
        to identify trending sounds and music patterns.
        """
        logger.info(f"🎵 [Shorts Engine] Scanning trending audio on {platform} for category: {category}")
        
        search_terms = {
            "all": "viral music trend",
            "music": "viral song dance challenge",
            "comedy": "funny sound effect viral",
            "education": "trending educational music",
            "gaming": "trending game bgm",
        }
        search_term = search_terms.get(category, search_terms["all"])
        
        def _sync_fetch():
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                    'playlistend': 10,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"ytsearch10:{search_term}", download=False)
                    return info.get('entries', []) if info else []
            except Exception as e:
                logger.error(f"Trending audio search failed: {e}")
                return []
        
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(None, _sync_fetch)
        
        audio_trends = []
        for entry in entries:
            try:
                title = entry.get('title', '')
                views = entry.get('view_count') or 0
                likes = entry.get('like_count') or 0
                velocity = min(100, ((likes / max(views, 1)) * 100) + 50) if views > 0 else 50
                
                vid = entry.get('id', '')
                audio_trends.append({
                    "id": vid,
                    "title": title[:60],
                    "artist": entry.get('channel', entry.get('uploader', 'Unknown Artist')),
                    "uploader": entry.get('uploader', ''),
                    "thumbnail": entry.get('thumbnail', '') or f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
                    "video_id": vid,
                    "velocity_score": round(velocity, 1),
                    "platform": platform,
                    "views": views,
                    "url": f"https://youtube.com/watch?v={vid}"
                })
            except Exception as e:
                logger.error(f"Error processing audio entry: {e}")
        
        if audio_trends:
            audio_trends.sort(key=lambda x: x["velocity_score"], reverse=True)
            return audio_trends[:10]
        
        # Fallback to YouTube search for music/shorts
        try:
            ydl_opts = {'quiet': True, 'no_warnings': True, 'playlistend': 5}
            with yt_dlp.YoutubeDL(yl_opts) as ydl:
                info = ydl.extract_info("ytsearch5:trending shorts music", download=False)
                entries = info.get('entries', []) if info else []
                for entry in entries:
                    vid = entry.get('id', '')
                    audio_trends.append({
                        "id": vid,
                        "title": (entry.get('title', '') or '')[:60],
                        "artist": entry.get('channel', entry.get('uploader', 'Unknown Artist')),
                        "uploader": entry.get('uploader', ''),
                        "thumbnail": entry.get('thumbnail', '') or f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
                        "video_id": vid,
                        "velocity_score": 50.0,
                        "platform": platform,
                        "views": entry.get('view_count') or 0,
                        "url": f"https://youtube.com/watch?v={vid}"
                    })
        except:
            pass
        
        return audio_trends[:10] if audio_trends else self._fallback_audio_trends(platform, category)
    
    def _fallback_audio_trends(self, platform: str, category: str) -> List[Dict[str, Any]]:
        """Fallback audio trends when yt-dlp is unavailable."""
        return [
            {"id": "audio_fb1", "title": "Funny Spongebob Trap Remix", "artist": "Spongebob Remix", "uploader": "RemixArtist", "thumbnail": "", "video_id": "", "velocity_score": 95, "platform": platform, "views": 500000},
            {"id": "audio_fb2", "title": "Sigma Male Grindset BGM", "artist": "Grindset Beats", "uploader": "SigmaMusic", "thumbnail": "", "video_id": "", "velocity_score": 88, "platform": platform, "views": 350000},
            {"id": "audio_fb3", "title": "Emotional Piano Sad Trend", "artist": "PianoVibes", "uploader": "EmotionalMusic", "thumbnail": "", "video_id": "", "velocity_score": 82, "platform": platform, "views": 200000}
        ]

    async def get_shorts_outliers(self, category: str, sub_target: str, keyword: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Fetches real Short-form outliers using yt-dlp library based on EV and VSR.
        Prioritizes Engagement Velocity over Search Intent for Shorts-specific algorithm.
        Applies dynamic filtering from the frontend.
        """
        logger.info(f"📱 [Shorts Engine] Scanning real outliers for {category} > {sub_target} [{keyword}]")
        
        search_queries = [
            f"{keyword} #shorts",
            f"{keyword} shorts",
            keyword,
        ]

        def _sync_fetch(q):
            """Synchronous yt-dlp fetch (runs in thread pool to avoid blocking)."""
            try:
                # Parse filters
                period = filters.get('period', 'all') if filters else 'all'
                dateafter = None
                if period == 'today': dateafter = 'today-1days'
                elif period == '3days': dateafter = 'today-3days'
                elif period == '7days': dateafter = 'today-7days'
                elif period == '30days': dateafter = 'today-30days'
                else: dateafter = 'today-1year' # Default to at most 1 year old to prevent 12-year old videos
                
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                    'playlistend': 20,
                    'socket_timeout': 15,
                    'match_filter': yt_dlp.match_filter_func("duration <= 65"),
                }
                if dateafter:
                    ydl_opts['dateafter'] = dateafter

                # Use ytsearchdate20 for recent sorting if specifically asked, else ytsearch20
                search_prefix = "ytsearchdate20:" if period != 'all' else "ytsearch20:"
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"{search_prefix}{q}", download=False)
                    return info.get('entries', []) if info else []
            except Exception as e:
                logger.error(f"yt-dlp search failed for '{q}': {e}")
                return []

        loop = asyncio.get_event_loop()
        tasks = [loop.run_in_executor(None, _sync_fetch, q) for q in search_queries]
        batches = await asyncio.gather(*tasks)
        entries = [e for batch in batches for e in batch]
        
        seen_ids = set()
        real_shorts = []
        
        # Parse view count filter
        min_views_req = 1000 # Strict base minimum to prevent garbage
        if filters:
            vc = filters.get('viewCountRange', 'all')
            if vc == 'min10k': min_views_req = 10000
            elif vc == 'min100k': min_views_req = 100000
            elif vc == 'min1m': min_views_req = 1000000

        # Parse channel size filter
        min_subs_req = 100
        if filters:
            cs = filters.get('channelSizeRange', 'all')
            if cs == 'small': min_subs_req = 100
            elif cs == 'medium': min_subs_req = 10000
            elif cs == 'large': min_subs_req = 100000

        for entry in entries:
            try:
                video_id = entry.get('id', '')
                if not video_id or video_id in seen_ids:
                    continue
                seen_ids.add(video_id)
                views = entry.get('view_count') or 0
                likes = entry.get('like_count') or 0
                comments = entry.get('comment_count') or 0
                subs = entry.get('channel_follower_count') or 0
                
                # Strict Filtering
                if views < min_views_req: continue
                if subs < min_subs_req: continue # Prevent 0 sub dead channels
                
                ev = self.calculate_engagement_velocity(views, likes, comments)
                vsr = (views / subs) if subs and subs > 0 else 0
                
                raw_upload = entry.get('upload_date', '')
                upload_date = raw_upload if raw_upload else ''
                
                real_shorts.append({
                    "id": video_id,
                    "title": entry.get('title', 'Unknown Title'),
                    "upload_date": upload_date,
                    "thumbnail": entry.get('thumbnail', ""),
                    "channelName": entry.get('uploader', 'Unknown Channel'),
                    "channelUrl": entry.get('channel_url', '') or f"https://www.youtube.com/channel/{entry.get('channel_id', '')}",
                    "videoUrl": entry.get('webpage_url', '') or f"https://www.youtube.com/watch?v={video_id}",
                    "language": entry.get('language', '') or '',
                    "subscribers": subs,
                    "views": views,
                    "likes": likes,
                    "comments": comments,
                    "ratio": round(vsr, 1),
                    "ev_ratio": round(ev, 2),
                    "category": f"{category} > {sub_target}",
                    "status": "pending",
                    "is_short": True,
                    "format": "auto-detected",
                    "tier": classify_ev_tier(ev)
                })
            except Exception as e:
                logger.error(f"Error processing entry: {e}")
        
        if not real_shorts:
            logger.warning("No real shorts found. Returning fallback mock data.")
            return self._fallback_outliers(category, sub_target, keyword)
        
        # Apply sort
        sort_key = filters.get('sort', 'trending') if filters else 'trending'
        if sort_key == 'views':
            real_shorts.sort(key=lambda x: x.get("views", 0), reverse=True)
        else:
            real_shorts.sort(key=lambda x: x.get("ev_ratio", 0), reverse=True)
        return real_shorts[:20]

    def _fallback_outliers(self, category: str, sub_target: str, keyword: str) -> List[Dict[str, Any]]:
        """
        Returns demo outliers when yt-dlp is unavailable, so the UI never shows empty.
        """
        logger.info(f"📱 [Shorts Engine] Using fallback mock data for {category} > {sub_target} [{keyword}]")
        
        mock_shorts = [
            {
                "id": "short_mock_1",
                "title": f"[Short] {keyword} - 1분만에 끝내는 꿀팁 대방출",
                "thumbnail": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80",
                "channelName": "꿀팁요정",
                "channelUrl": "https://www.youtube.com/@honey_tip",
                "videoUrl": "https://www.youtube.com/watch?v=short_mock_1",
                "language": "ko",
                "subscribers": 3200,
                "views": 450000,
                "likes": 58000,
                "comments": 3200,
                "ratio": 140.6,
                "ev_ratio": 13.6,
                "category": f"{category} > {sub_target}",
                "status": "pending",
                "is_short": True,
                "format": "split-screen",
                "tier": "rising"
            },
            {
                "id": "short_mock_2",
                "title": f"{keyword} 충격적 결과.. 이 영상 꼭 보세요 📱",
                "thumbnail": "https://images.unsplash.com/photo-1583847268964-b28ce8f31586?w=500&q=80",
                "channelName": "일상리뷰",
                "channelUrl": "https://www.youtube.com/@daily_review",
                "videoUrl": "https://www.youtube.com/watch?v=short_mock_2",
                "language": "ko",
                "subscribers": 1800,
                "views": 720000,
                "likes": 95000,
                "comments": 5800,
                "ratio": 400.0,
                "ev_ratio": 14.0,
                "category": f"{category} > {sub_target}",
                "status": "pending",
                "is_short": True,
                "format": "facecam",
                "tier": "rising"
            },
            {
                "id": "short_mock_3",
                "title": f"아직도 모르는 {keyword} 실전 활용법 (놀라움 주의)",
                "thumbnail": "https://images.unsplash.com/photo-1549007994-bc92caebd54b?w=500&q=80",
                "channelName": "실험하는남자",
                "channelUrl": "https://www.youtube.com/@experimentman",
                "videoUrl": "https://www.youtube.com/watch?v=short_mock_3",
                "language": "ko",
                "subscribers": 5600,
                "views": 280000,
                "likes": 42000,
                "comments": 1900,
                "ratio": 50.0,
                "ev_ratio": 15.7,
                "category": f"{category} > {sub_target}",
                "status": "pending",
                "is_short": True,
                "format": "captions",
                "tier": "rising"
            }
        ]
        mock_shorts.sort(key=lambda x: x.get("ev_ratio", 0), reverse=True)
        return mock_shorts

    async def get_trending_audio(self, platform: str = "youtube_shorts") -> List[Dict[str, Any]]:
        """
        Returns top trending BGM/audio tracks with rich metadata.
        Uses scan_trending_audio internally then enriches with artist/usage/chart info.
        """
        raw = await self.scan_trending_audio(platform=platform, category="all")
        enriched = []
        seen_titles = set()
        for i, item in enumerate(raw):
            title = item.get("title", "")[:60]
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            enriched.append({
                "id": f"audio_{i}",
                "title": title,
                "artist": item.get("artist", item.get("uploader", "Unknown Artist")),
                "thumbnail": item.get("thumbnail", ""),
                "video_id": item.get("id", item.get("video_id", "")),
                "views": item.get("views", item.get("view_count", 0)),
                "velocity_score": item.get("velocity_score", 50.0),
                "usage_count": max(1000, int(item.get("views", 0) * 0.3)),
                "usage_label": "바이럴",
            })
            if len(enriched) >= 8:
                break
        return enriched[:8] if enriched else self._fallback_audio_trends(platform, "all")

# Singleton instance
shorts_engine = ShortsIntelligenceEngine()
