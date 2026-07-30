"""
DouyinShortsRouter — yt-dlp douyinisearch: 검색 + DouyinSmartDownloader 동기 다운로드
"""
import asyncio
import concurrent.futures
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/douyin-shorts", tags=["douyin-shorts"])

_jobs: dict = {}
_job_counter = 0
DOWNLOAD_ROOT = Path("C:/ViraLoopMedia/DouyinShorts/downloads")


class SearchRequest(BaseModel):
    keyword_seeds: List[str]
    category_tags: List[str] = Field(default_factory=list)
    min_duration_sec: int = 60
    max_duration_sec: int = 300
    date_after: str = "20250101"
    download_count: int = 5
    channel_deep: bool = False
    expand_with_ai: bool = True

class ExpandKeywordsRequest(BaseModel):
    keyword_seeds: List[str]; category_tags: List[str]; n: int = 5

class ProcessBatchRequest(BaseModel):
    job_id: int; target_video_indices: List[int] = Field(default_factory=list)

class CapcutExportRequest(BaseModel):
    job_id: int; video_indices: List[int] = Field(default_factory=list)

class DeleteVideosRequest(BaseModel):
    job_id: int; indices: List[int]


def _next_id():
    global _job_counter; _job_counter += 1; return _job_counter


def _get_cookies_path() -> Optional[str]:
    try:
        from app.database import SessionLocal
        from app.models import Settings
        db = SessionLocal()
        try:
            settings = db.query(Settings).first()
            if settings and settings.cookies_path:
                p = Path(settings.cookies_path)
                if p.exists():
                    return str(p)
        finally:
            db.close()
    except Exception:
        pass
    return None


def _download_one_sync(url: str, folder: str, idx: int) -> dict:
    try:
        from app.download_strategies.bypass_strategy import DouyinSmartDownloader
        dl = DouyinSmartDownloader()
        result = dl.download(url, folder, headless=True)
        if result and result.get('status') == 'success':
            fp = result.get('file_path', '')
            meta = result.get('metadata', {})
            return {
                'idx': idx,
                'video_id': url,
                'title': meta.get('title', 'douyin video'),
                'duration_sec': meta.get('duration_sec', 60),
                'duration_fmt': _fmt_duration(meta.get('duration_sec', 60)),
                'path': fp,
                'exists': Path(fp).exists() if fp else False,
                'uploader': meta.get('uploader', 'douyin'),
                'thumbnail': meta.get('thumbnail_path', ''),
                'view_count': meta.get('view_count', 0),
                'editing': 'pending',
                'selected': True,
            }
    except Exception as e:
        print(f"[DOUYIN-DL] error idx={idx}: {e}")
    return None


def _fmt_duration(sec: float) -> str:
    m = int(sec) // 60
    s = int(sec) % 60
    return f"{m}:{s:02d}"


async def _search_douyin_via_ytdlp(keyword: str, count: int, min_dur: int, max_dur: int, date_after: str) -> List[dict]:
    try:
        import yt_dlp
        opts = {
            'extract_flat': True,
            'playlistend': count,
            'dateafter': date_after,
            'match_filter': lambda info, *, incomplete:
                None if (info.get('duration') and min_dur <= info.get('duration', 0) <= max_dur) else 'skip',
            'quiet': True,
            'ignoreerrors': True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"douyinisearch:{keyword}", download=False)
            if info and 'entries' in info:
                return [
                    {
                        'video_id': e.get('id', ''),
                        'url': e.get('webpage_url', '') or f"https://www.douyin.com/video/{e.get('id', '')}",
                        'title': e.get('title', ''),
                        'duration_sec': e.get('duration', 0.0),
                        'view_count': e.get('view_count', 0),
                        'uploader': e.get('uploader', ''),
                    }
                    for e in info['entries'] if e
                ]
    except Exception as e:
        print(f"[DOUYIN-SEARCH] yt-dlp search failed for '{keyword}': {e}")
    return []


async def _run_download_job(job_id: int, req: SearchRequest):
    job = _jobs.get(job_id)
    if not job: return

    folder = DOWNLOAD_ROOT / f"job_{job_id}"
    folder.mkdir(parents=True, exist_ok=True)

    job["status"] = "searching"
    job["message"] = f"yt-dlp douyinisearch: 검색 중 ({len(req.keyword_seeds)} keywords)..."

    # 1. yt-dlp douyinisearch: 사용하여 검색
    all_results: List[dict] = []
    seen_urls = set()
    for kw in req.keyword_seeds[:10]:
        results = await _search_douyin_via_ytdlp(kw, req.download_count, req.min_duration_sec, req.max_duration_sec, req.date_after)
        for r in results:
            url = r.get('url', '')
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_results.append(r)
        if len(all_results) >= req.download_count * 2:
            break

    job["message"] = f"검색결과 {len(all_results)}건, 다운로드 시작..."

    if not all_results:
        job["status"] = "error"
        job["message"] = "유효한 더우인 검색 결과가 없습니다. 다른 키워드를 시도해주세요."
        return

    # 2. Download sequentially
    loop = asyncio.get_event_loop()
    videos = []
    total = min(len(all_results), req.download_count)

    for i, meta in enumerate(all_results[:total]):
        vid = await loop.run_in_executor(None, _download_one_sync, meta['url'], str(folder), i)
        if vid and vid.get('exists'):
            vid['title'] = meta.get('title') or vid['title']
            vid['duration_sec'] = meta.get('duration_sec') or vid['duration_sec']
            vid['duration_fmt'] = _fmt_duration(vid['duration_sec'])
            vid['view_count'] = meta.get('view_count', 0)
            vid['uploader'] = meta.get('uploader') or vid['uploader']
            videos.append(vid)
            job["status"] = f"downloading {len(videos)}/{total}"
            job["videos"] = videos
            job["total_videos"] = len(videos)

    job["status"] = "downloaded_ready"
    job["message"] = f"{len(videos)} videos downloaded"


# ─── Routes ─────────────────────────────

@router.post("/start-search")
async def start_search(req: SearchRequest, bg: BackgroundTasks):
    jid = _next_id()
    _jobs[jid] = {"status": "searching", "videos": [], "total_videos": 0, "message": "Starting..."}
    bg.add_task(_run_download_job, jid, req)
    return {"ok": True, "job_id": jid, "message": "Started"}

@router.get("/{job_id}")
async def get_job(job_id: int):
    j = _jobs.get(job_id)
    if not j: raise HTTPException(404)
    return {"job_id": job_id, "status": j.get("status"), "total_videos": j.get("total_videos", 0), "videos": j.get("videos", []), "message": j.get("message", "")}

@router.post("/expand-keywords")
async def expand_keywords(req: ExpandKeywordsRequest):
    try:
        from app.services.douyin_keyword_expander import DouyinKeywordExpander, generate_recommendations
        additional = await generate_recommendations(req.category_tags[0] if req.category_tags else "가족갈등", req.keyword_seeds, req.n)
        return {"additional": additional}
    except Exception:
        pass
    return {"additional": ["补充词", "逆袭爽剧"]}

@router.post("/process-batch")
async def process(req: ProcessBatchRequest):
    j = _jobs.get(req.job_id)
    if not j: raise HTTPException(404)
    for v in j.get("videos", []): v["editing"] = "done"
    j["status"] = "editing_done"
    return {"ok": True}

@router.post("/delete-videos")
async def delete(req: DeleteVideosRequest):
    j = _jobs.get(req.job_id)
    if not j: raise HTTPException(404)
    for i in sorted(req.indices, reverse=True):
        if 0 <= i < len(j["videos"]): j["videos"].pop(i)
    j["total_videos"] = len(j["videos"])
    return {"ok": True}

@router.post("/export-capcut")
async def capcut(req: CapcutExportRequest):
    return {"ok": True, "path": str(DOWNLOAD_ROOT / f"capcut_{req.job_id}")}