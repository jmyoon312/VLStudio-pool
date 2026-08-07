import logging
import subprocess
import json
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class YouTubeScoutV2:
    """
    Advanced YouTube Scraper & Intelligence Gathering Tool.
    Used as a fallback when official YouTube API fails or returns incomplete data.
    """
    
    @staticmethod
    def fetch_channel_metadata(channel_url: str) -> Dict[str, Any]:
        """
        Extracts real-time metadata from a YouTube channel using yt-dlp.
        """
        logger.info(f"📡 [YouTubeScoutV2] Attempting to scrape metadata for: {channel_url}")
        
        try:
            # Command to get channel metadata in JSON format
            # We limit to 1 to get channel info quickly
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--no-playlist",
                "--playlist-items", "1",
                channel_url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=30)
            
            if result.returncode != 0:
                logger.error(f"yt-dlp failed: {result.stderr}")
                return {}

            data = json.loads(result.stdout)
            
            return {
                "channel_name": data.get("uploader", "Unknown"),
                "subscriber_count": data.get("channel_follower_count", 0),
                "view_count": data.get("view_count", 0),
                "video_count": data.get("playlist_count", 0),
                "description": data.get("channel_description", ""),
                "is_verified": data.get("uploader_url") is not None,
                "source": "SCRAPED"
            }
            
        except Exception as e:
            logger.error(f"[FIRE] Critical error during scraping: {e}")
            return {}

    @staticmethod
    def resolve_nan_metrics(raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensures all metrics are valid numbers and never NaN.
        """
        return {
            "subscriber_growth_7d": float(raw_data.get("subscriber_growth_7d", 0.0) or 0.0),
            "quality_score": int(raw_data.get("quality_score", 50) or 50),
            "engagement_score": int(raw_data.get("engagement_score", 50) or 50),
            "recreatability_score": int(raw_data.get("recreatability_score", 50) or 50),
            "total_sovereign_score": int(raw_data.get("total_sovereign_score", 50) or 50)
        }
