"""
DouyinSearchDownloader — 키워드 기반 더우인 영상 병렬 검색 & 다운로드

Enable회의 DouyinSmartDownloader (V2OB + TikVideo)를 확장하여
yt-dlp를 사용한 키워드 검색 기능을 제공한다.
"""
import asyncio
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field


class DouyinSearchFilter(BaseModel):
    keyword_seeds: List[str] = Field(default_factory=list)
    expand_with_ai: bool = True
    max_keywords: int = 15
    min_duration_sec: int = 60
    max_duration_sec: int = 300
    min_views: int = 500000
    date_after: str = "20250101"
    download_count: int = 20
    category_tags: List[str] = Field(default_factory=list)
    channel_feed_deep: bool = False


class DouyinVideoMeta(BaseModel):
    video_id: str
    url: str
    title: str = ""
    duration_sec: float = 0
    view_count: int = 0
    like_count: int = 0
    uploader: str = ""
    uploader_url: str = ""


class DouyinSearchDownloader:
    CONCURRENT_SEARCH = 3

    def __init__(self):
        self.semaphore = asyncio.Semaphore(self.CONCURRENT_SEARCH)

    async def search_videos(self, keyword: str, filt: DouyinSearchFilter) -> List[DouyinVideoMeta]:
        async with self.semaphore:
            return await self._run_ytdlp_search(keyword, filt)

    async def batch_search(self, keywords: list[str], filt: DouyinSearchFilter) -> List[DouyinVideoMeta]:
        tasks = [self.search_videos(kw, filt) for kw in keywords]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        all_meta = []
        for r in results:
            if isinstance(r, list):
                all_meta.extend(r)
        seen = set()
        unique = []
        for v in all_meta:
            if v.video_id not in seen:
                unique.append(v)
                seen.add(v.video_id)
        return unique

    async def _run_ytdlp_search(self, keyword: str, filt: DouyinSearchFilter) -> List[DouyinVideoMeta]:
        import yt_dlp

        opts = {
            'extract_flat': True,
            'playlistend': filt.download_count,
            'dateafter': filt.date_after,
            'match_filter': lambda info, *, incomplete:
                None if info.get('duration') and filt.min_duration_sec <= info.get('duration', 0) <= filt.max_duration_sec else 'skip',
            'quiet': True,
            'ignoreerrors': True,
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info_dict = ydl.extract_info(f"douyinisearch:{keyword}", download=False)
                if info_dict and 'entries' in info_dict:
                    return [
                        DouyinVideoMeta(
                            video_id=e.get('id', ''),
                            url=e.get('webpage_url', ''),
                            title=e.get('title', ''),
                            duration_sec=e.get('duration', 0.0),
                            view_count=e.get('view_count', 0),
                            like_count=e.get('like_count', 0),
                            uploader=e.get('uploader', ''),
                        )
                        for e in info_dict['entries'] if e
                    ]
        except Exception as e:
            print(f"yt-dlp search failed for {keyword}: {e}")
        return []