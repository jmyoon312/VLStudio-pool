import logging
import yt_dlp
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def search_youtube_channels(query: str, max_results: int = 20) -> List[Dict[str, Any]]:
    """
    Search YouTube for channels matching the query using yt-dlp.
    Returns a list of candidate dicts with channel info extracted from search results.
    """
    try:
        # [FEATURE] Apply region filtering to restrict non-target countries
        # Specifically targeting KR, JP, and EN regions, excluding Southeast Asia.
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist', # [OPTIMIZATION] Use flat extraction to drastically speed up search
            'playlistend': max_results,
            'socket_timeout': 20,
            'skip_download': True,
            'geo_bypass': True,
            'geo_bypass_country': 'KR', # Default to KR for search context, helps bias results
            'sleep_interval': 0.5,      # [OPTIMIZATION] Add random delay to prevent IP block
            'max_sleep_interval': 1.5,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # We can also append region-specific keywords to the query to strongly bias YouTube's search algorithm
            biased_query = f"{query} (한국어 OR 日本語 OR english)"
            info = ydl.extract_info(f"ytsearch{max_results}:{biased_query}", download=False)
            entries = info.get('entries') or [] if info else []
    except Exception as e:
        logger.warning(f"[YouTubeDiscovery] yt-dlp search failed for '{query}': {e}")
        return []

    candidates = []
    seen_urls = set()
    for entry in entries:
        if not entry:
            continue
        channel_url = entry.get('channel_url') or entry.get('uploader_url') or ''
        if not channel_url or channel_url in seen_urls:
            continue
        seen_urls.add(channel_url)

        name = entry.get('uploader') or entry.get('channel') or entry.get('creator', '')
        if not name:
            name = entry.get('title', '').replace(' - YouTube', '').strip()
            if not name:
                continue

        candidates.append({
            "url": channel_url,
            "name": name,
            "subscriber_count": entry.get('channel_follower_count') or 0,
            "view_count": entry.get('view_count') or 0,
            "video_count": entry.get('playlist_count') or 0,
            "thumbnail": entry.get('channel_thumbnail_url') or entry.get('thumbnail', ''),
            "snippet": entry.get('description', '') or entry.get('title', '')[:200],
            "source": "youtube_discovery"
        })

    logger.info(f"[YouTubeDiscovery] Found {len(candidates)} channels for '{query}'")
    return candidates


def search_youtube_videos(query: str, max_results: int = 20, shorts_only: bool = False) -> List[Dict[str, Any]]:
    """
    Search YouTube for videos matching the query using yt-dlp.
    """
    try:
        # [FEATURE] Apply region filtering to restrict non-target countries
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist', # [OPTIMIZATION] Flat extraction for much faster video list fetch
            'playlistend': max_results,
            'socket_timeout': 20,
            'skip_download': True,
            'geo_bypass': True,
            'geo_bypass_country': 'KR',
            'sleep_interval': 0.5,         # [OPTIMIZATION] Delay to prevent IP block
            'max_sleep_interval': 1.5,
        }
        if shorts_only:
            ydl_opts['match_filter'] = yt_dlp.match_filter_func("duration <= 65")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            biased_query = f"{query} (한국어 OR 日本語 OR english)"
            info = ydl.extract_info(f"ytsearch{max_results}:{biased_query}", download=False)
            return info.get('entries') or [] if info else []
    except Exception as e:
        logger.warning(f"[YouTubeDiscovery] yt-dlp video search failed for '{query}': {e}")
        return []
