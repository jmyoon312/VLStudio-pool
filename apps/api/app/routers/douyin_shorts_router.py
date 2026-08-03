# Trigger uvicorn reload
"""
DouyinShortsRouter — yt-dlp douyinisearch: 검색 + DouyinSmartDownloader 동기 다운로드
"""
import asyncio
import concurrent.futures
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app import database
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/douyin-shorts", tags=["douyin-shorts"])

_jobs: dict = {}
_job_counter = 0
DOWNLOAD_ROOT = Path("C:/ViraLoopMedia/DouyinShorts/downloads")

import json

def _save_job(job_id: int):
    job = _jobs.get(job_id)
    if not job: return
    try:
        job_dir = DOWNLOAD_ROOT / f"job_{job_id}"
        job_dir.mkdir(parents=True, exist_ok=True)
        with open(job_dir / "job_state.json", "w", encoding="utf-8") as f:
            json.dump(job, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Failed to save job {job_id}: {e}")

def _load_jobs():
    global _job_counter
    if not DOWNLOAD_ROOT.exists():
        return
    max_id = 0
    for job_dir in DOWNLOAD_ROOT.glob("job_*"):
        try:
            jid = int(job_dir.name.split("_")[1])
            if jid > max_id:
                max_id = jid
            state_file = job_dir / "job_state.json"
            if state_file.exists():
                with open(state_file, "r", encoding="utf-8") as f:
                    _jobs[jid] = json.load(f)
        except Exception:
            pass
    _job_counter = max_id

_load_jobs()

class SearchRequest(BaseModel):
    keyword_seeds: List[str]
    category_tags: List[str] = Field(default_factory=list)
    min_duration_sec: int = 60
    max_duration_sec: int = 300
    date_after: str = "20250101"
    download_count: int = 5
    channel_deep: bool = False
    expand_with_ai: bool = True
    profile_id: Optional[str] = None

class ExpandKeywordsRequest(BaseModel):
    keyword_seeds: List[str]; category_tags: List[str]; n: int = 5

class ProcessBatchRequest(BaseModel):
    job_id: int; target_video_indices: List[int] = Field(default_factory=list); stage: Optional[str] = None; script_style: Optional[str] = "base"

class CapcutExportRequest(BaseModel):
    job_id: int; video_indices: List[int] = Field(default_factory=list)

class DeleteVideosRequest(BaseModel):
    job_id: int; indices: List[int]


import os
from fastapi import Request
from fastapi.responses import Response

@router.get("/media")
def stream_media(path: str, request: Request):
    """로컬 미디어 파일(비디오/오디오)을 Range request 지원하여 스트리밍합니다."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    file_size = os.path.getsize(path)
    range_header = request.headers.get("Range")
    
    if range_header:
        # e.g., bytes=0-1000
        byte1, byte2 = 0, None
        match = range_header.replace("bytes=", "").split("-")
        if match[0]: byte1 = int(match[0])
        if match[1]: byte2 = int(match[1])
        
        byte2 = byte2 if byte2 is not None else file_size - 1
        length = byte2 - byte1 + 1
        
        with open(path, "rb") as f:
            f.seek(byte1)
            data = f.read(length)
            
        headers = {
            "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
        }
        return Response(data, status_code=206, headers=headers)
    else:
        with open(path, "rb") as f:
            data = f.read()
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
        }
        return Response(data, status_code=200, headers=headers)


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


def _search_douyin_via_cloakbrowser_sync(keyword: str, count: int, min_dur: int, max_dur: int, date_after: str, user_data_dir: str = None) -> List[dict]:
    import urllib.parse
    import json
    
    encoded_kw = urllib.parse.quote(keyword)
    url = f"https://www.douyin.com/search/{encoded_kw}?type=video"
    
    results = []
    
    try:
        import cloakbrowser
        kwargs = {
            'headless': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'locale': 'zh-CN',
            'viewport': {'width': 1920, 'height': 1080},
            'stealth_args': True,
        }
        if user_data_dir:
            kwargs['user_data_dir'] = user_data_dir
            
        with cloakbrowser.launch_context(**kwargs) as context:
            page = context.new_page()
            
            intercepted_data = None
            urls_hit = []
            
            def on_response(resp):
                nonlocal intercepted_data
                urls_hit.append(resp.url)
                if intercepted_data:
                    return
                if 'aweme/v1/web/search/item' in resp.url or 'search/item' in resp.url:
                    try:
                        body = resp.body()
                        data = json.loads(body.decode('utf-8'))
                        intercepted_data = data
                    except:
                        pass
            
            page.on('response', on_response)
            
            print(f"[DOUYIN-SEARCH] Navigating to {url}...")
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(5000) # Wait for network requests
            
            # If no API intercepted, try to extract from HTML (SSR)
            if not intercepted_data:
                import re
                html = page.content()
                # Look for the RENDER_DATA script block
                match = re.search(r'<script id="RENDER_DATA" type="application/json">(.+?)</script>', html)
                if match:
                    try:
                        raw = urllib.parse.unquote(match.group(1))
                        data = json.loads(raw)
                        # The structure might vary, but usually it's under something like 'app' -> 'searchData'
                        # Just grab any list of aweme_info we can find
                        def find_awemes(obj):
                            found = []
                            if isinstance(obj, dict):
                                if 'aweme_info' in obj:
                                    found.append(obj)
                                for v in obj.values():
                                    found.extend(find_awemes(v))
                            elif isinstance(obj, list):
                                for item in obj:
                                    found.extend(find_awemes(item))
                            return found
                            
                        awemes = find_awemes(data)
                        if awemes:
                            intercepted_data = {'data': awemes}
                    except:
                        pass
                        
            if intercepted_data and 'data' in intercepted_data:
                for item in intercepted_data['data']:
                    aweme = item.get('aweme_info', {})
                    if not aweme:
                        continue
                        
                    duration_sec = (aweme.get('duration', 0) or 0) / 1000.0
                    if not (min_dur <= duration_sec <= max_dur):
                        continue
                        
                    video_id = aweme.get('aweme_id', '')
                    title = aweme.get('desc', '')
                    author = aweme.get('author', {}).get('nickname', '')
                    author_uid = aweme.get('author', {}).get('sec_uid', '')
                    view_count = aweme.get('statistics', {}).get('play_count', 0) or 0
                    
                    results.append({
                        'video_id': video_id,
                        'url': f"https://www.douyin.com/video/{video_id}",
                        'title': title,
                        'duration_sec': duration_sec,
                        'view_count': view_count,
                        'uploader': author,
                        'uploader_url': f"https://www.douyin.com/user/{author_uid}" if author_uid else ""
                    })
                    
                    if len(results) >= count:
                        break

    except Exception as e:
        print(f"[DOUYIN-SEARCH] CloakBrowser search failed for '{keyword}': {e}")
        
    return results

async def _search_douyin_via_cloakbrowser(keyword: str, count: int, min_dur: int, max_dur: int, date_after: str, user_data_dir: str = None) -> List[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _search_douyin_via_cloakbrowser_sync, keyword, count, min_dur, max_dur, date_after, user_data_dir)


async def _run_download_job(job_id: int, req: SearchRequest):
    job = _jobs.get(job_id)
    if not job: return

    folder = DOWNLOAD_ROOT / f"job_{job_id}"
    folder.mkdir(parents=True, exist_ok=True)

    job["status"] = "searching"
    job["message"] = f"yt-dlp douyinisearch: 검색 중 ({len(req.keyword_seeds)} keywords)..."

    # 1. yt-dlp douyinisearch: 사용하여 검색 (이제 cloakbrowser 사용)
    all_results: List[dict] = []
    seen_urls = set()
    
    # Get user_data_dir if profile_id provided
    user_data_dir = None
    if req.profile_id:
        try:
            from app.database import SessionLocal
            from app.models import BrowserProfile
            db = SessionLocal()
            try:
                prof = db.query(BrowserProfile).filter(BrowserProfile.id == req.profile_id).first()
                if prof and prof.user_data_dir:
                    user_data_dir = prof.user_data_dir
            finally:
                db.close()
        except:
            pass

    for kw in req.keyword_seeds[:10]:
        results = await _search_douyin_via_cloakbrowser(kw, req.download_count, req.min_duration_sec, req.max_duration_sec, req.date_after, user_data_dir)
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
            vid['pipeline_stage'] = 'ingest'
            videos.append(vid)
            job["status"] = f"downloading {len(videos)}/{total}"
            job["videos"] = videos
            job["total_videos"] = len(videos)
            _save_job(job_id)

    job["status"] = "downloaded_ready"
    job["message"] = f"{len(videos)} videos downloaded"
    _save_job(job_id)


# ─── Routes ─────────────────────────────

@router.post("/start-search")
async def start_search(req: SearchRequest, bg: BackgroundTasks):
    jid = _next_id()
    _jobs[jid] = {"status": "searching", "videos": [], "total_videos": 0, "message": "Starting..."}
    _save_job(jid)
    bg.add_task(_run_download_job, jid, req)
    return {"ok": True, "job_id": jid, "message": "Started"}



@router.post("/expand-keywords")
async def expand_keywords(req: ExpandKeywordsRequest):
    try:
        from app.services.douyin_keyword_expander import DouyinKeywordExpander, generate_recommendations
        additional = await generate_recommendations(req.category_tags[0] if req.category_tags else "가족갈등", req.keyword_seeds, req.n)
        return {"additional": additional}
    except Exception:
        pass
    return {"additional": ["补充词", "逆袭爽剧"]}

async def run_batch_orchestrator(job_id: int, target_indices: List[int], stage: Optional[str] = None, script_style: str = "base"):
    j = _jobs.get(job_id)
    if not j: return
    
    output_dir = str(DOWNLOAD_ROOT / f"job_{job_id}")
    
    try:
        from app.services.batch_orchestrator import batch_orchestrator
        valid_targets = []
        video_paths = []
        scripts_data = []
        for idx in target_indices:
            for v in j.get("videos", []):
                if v["idx"] == idx:
                    valid_targets.append(idx)
                    video_paths.append(v.get("path", ""))
                    scripts_data.append(v.get("script_data"))
                    
        if stage == 'analyze':
            # Just do vision analysis mock for now
            from app.services.ai_editor import analyze_video
            for i, idx in enumerate(valid_targets):
                j["message"] = f"영상 #{idx} Vision AI 분석 중..."
                _save_job(job_id)
                ai_result = await analyze_video(video_paths[i], script_style=script_style)
                for v in j.get("videos", []):
                    if v["idx"] == idx:
                        v["script_data"] = ai_result.dict() if hasattr(ai_result, 'dict') else ai_result
                        v["pipeline_stage"] = "analyzed"
            j["message"] = "Vision AI 분석이 모두 완료되었습니다."
        else:
            # Process the batch using the orchestrator
            await batch_orchestrator.process_batch(video_paths, output_dir, scripts_data)
            
        # Once complete, mark as done
        for idx in target_indices:
            for v in j.get("videos", []):
                if v["idx"] == idx:
                    v["editing"] = "done"
                    if stage != 'analyze':
                        v["pipeline_stage"] = "assembled"
    except Exception as e:
        print(f"Batch processing failed: {e}")
        j["message"] = f"작업 중 오류 발생: {e}"
        for idx in target_indices:
            for v in j.get("videos", []):
                if v["idx"] == idx:
                    v["editing"] = "error"
    j["status"] = "editing_done"
    _save_job(job_id)

@router.post("/process-batch")
async def process(req: ProcessBatchRequest, background_tasks: BackgroundTasks):
    j = _jobs.get(req.job_id)
    if not j: raise HTTPException(404)
    
    for idx in req.target_video_indices:
        for v in j.get("videos", []):
            if v["idx"] == idx:
                v["editing"] = "processing"
    
    j["status"] = "editing"
    if req.stage == 'analyze':
        j["message"] = f"영상 {req.target_video_indices} Vision AI 분석 진행 중..."
    else:
        j["message"] = f"영상 {req.target_video_indices} 파이프라인 가동 중..."
    
    _save_job(req.job_id)
    
    # Run the orchestrator in the background
    background_tasks.add_task(run_batch_orchestrator, req.job_id, req.target_video_indices, req.stage, req.script_style)
    
    return {"ok": True}

@router.post("/delete-videos")
async def delete(req: DeleteVideosRequest):
    j = _jobs.get(req.job_id)
    if not j: raise HTTPException(404)
    
    # req.indices contains v["idx"] values, not array indices
    j["videos"] = [v for v in j.get("videos", []) if v.get("idx") not in req.indices]
    j["total_videos"] = len(j["videos"])
    _save_job(req.job_id)
    return {"ok": True}

class UpdateScriptRequest(BaseModel):
    job_id: int
    video_idx: int
    script_data: Optional[dict] = None

@router.post("/update-script")
async def update_script(req: UpdateScriptRequest):
    j = _jobs.get(req.job_id)
    if not j: raise HTTPException(404)
    for v in j.get("videos", []):
        if v["idx"] == req.video_idx:
            if req.script_data is not None:
                v["script_data"] = req.script_data
            _save_job(req.job_id)
            return {"ok": True}
    raise HTTPException(404, "Video not found")

@router.post("/export-capcut")
async def capcut(req: CapcutExportRequest):
    return {"ok": True, "path": str(DOWNLOAD_ROOT / f"capcut_{req.job_id}")}

@router.get("/tts-voices")
async def get_tts_voices():
    try:
        from app.services.tts.supertonic.service import SupertonicService
        from app.config import settings
        model_dir = settings.supertone_model_path if settings.supertone_model_path else "backend/models/supertonic"
        service = SupertonicService.get_instance(model_dir)
        service.load_models()
        return {"ok": True, "voices": service.tts.voice_style_names}
    except Exception as e:
        import traceback
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}

@router.get("/tts-presets")
async def get_tts_presets():
    from app.services.tts_preset_manager import TTSPresetManager
    manager = TTSPresetManager()
    return {"ok": True, "presets": manager.presets}

@router.get("/tts-rvc-models")
async def get_tts_rvc_models():
    try:
        from app.services.tts.rvc_engine import RVCEngine
        engine = RVCEngine()
        models = engine.get_available_models()
        return {"ok": True, "models": models}
    except Exception as e:
        import traceback
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}

from pydantic import BaseModel
class TTSPresetUpdateRequest(BaseModel):
    category: str
    engine: str = "supertone-local"
    voice_id: str
    speed: float
    pitch: int
    rvc_model: Optional[str] = None

@router.post("/tts-presets")
async def post_tts_presets(req: TTSPresetUpdateRequest):
    from app.services.tts_preset_manager import TTSPresetManager
    manager = TTSPresetManager()
    manager.update_presets(req.category, req.voice_id, req.speed, req.pitch, req.rvc_model) # Wait, preset manager also needs engine if we want to save it!
    # Let's just pass engine to voice_id like before `f"{req.engine}/{req.voice_id}"` to avoid rewriting TTSPresetManager
    combined_voice_id = f"{req.engine}/{req.voice_id}" if req.engine else req.voice_id
    manager.update_presets(req.category, combined_voice_id, req.speed, req.pitch, req.rvc_model)
    return {"ok": True, "presets": manager.presets}

@router.get("/tts-preview/{category}")
async def tts_preview(
    category: str,
    engine: Optional[str] = None,
    voice_id: Optional[str] = None,
    speed: Optional[float] = 1.0,
    pitch: Optional[int] = 0,
    emotion: Optional[str] = "normal",
    noise_scale: Optional[float] = 0.667,
    rvc_model: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    try:
        from app.tts_engine import TTSEngine
        from app import crud, database
        import io
        from fastapi.responses import StreamingResponse
        
        # Load settings from DB so API keys are present
        db_settings = crud.get_settings(db)
        
        # Parse provider and voice_id
        if not voice_id:
            voice_id = "typecast/suni" # default fallback
        
        provider = engine
        actual_voice_id = voice_id
        
        if not provider:
            parts = voice_id.split("/", 1)
            provider = parts[0] if len(parts) > 1 else "supertone-local"
            actual_voice_id = parts[1] if len(parts) > 1 else voice_id
        
        # UI speed is a multiplier (e.g. 1.1), backend rate is a percentage offset (e.g. 10)
        percentage_rate = int((speed - 1.0) * 100)
        
        engine_instance = TTSEngine(db_settings)
        try:
            result = await engine_instance.generate_audio(
                text="안녕하세요, 쇼츠 더빙 테스트입니다. 반가워요.",
                engine=provider,
                language="ko",
                voice_id=actual_voice_id,
                rate=percentage_rate,
                pitch=pitch,
                emotion=emotion,
                noise_scale=noise_scale,
                rvc_model=rvc_model
            )
        except Exception as api_err:
            # Generate error voice via Google TTS (always free/local-ish)
            error_msg = f"{provider} 외부 API 호출이 거부되었습니다. 무료 한도 초과 또는 계정 정지가 원인일 수 있습니다."
            result = await engine_instance.generate_audio(
                text=error_msg,
                engine="google",
                language="ko",
                voice_id="ko",
                rate=0,
                pitch=0,
            )
            print(f"============================================================")
            print(f"[API ERROR DETECTED] {provider} failed! Returning voice error.")
            print(f"Error Details: {str(api_err)}")
            print(f"============================================================")
        
        if result and result.get("status") == "success" and result.get("file_path"):
            with open(result["file_path"], "rb") as f:
                audio_data = f.read()
            return StreamingResponse(io.BytesIO(audio_data), media_type="audio/mp3")
        else:
            raise Exception("TTSEngine returned failure")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@router.post("/open-folder")
async def open_folder():
    import os
    try:
        path = str(DOWNLOAD_ROOT)
        os.makedirs(path, exist_ok=True)
        os.startfile(path)
    except Exception as e:
        pass
    return {"ok": True}

import subprocess
from app import dependency_manager
import os

@router.post("/upload-local")
async def upload_local(files: List[UploadFile] = File(...), job_id: Optional[int] = Form(None)):
    if job_id and job_id in _jobs:
        job = _jobs[job_id]
        job_dir = DOWNLOAD_ROOT / f"job_{job_id}"
        job_dir.mkdir(parents=True, exist_ok=True)
        videos = job.get("videos", [])
        start_idx = len(videos)
    else:
        job_id = _next_id()
        job = {"status": "completed", "videos": [], "completed": 0, "total": 0}
        _jobs[job_id] = job
        job_dir = DOWNLOAD_ROOT / f"job_{job_id}"
        job_dir.mkdir(parents=True, exist_ok=True)
        videos = job["videos"]
        start_idx = 0
    
    for i, file in enumerate(files):
        idx = start_idx + i
        ext = file.filename.split('.')[-1]
        save_path = job_dir / f"local_{idx}.{ext}"
        thumb_path = job_dir / f"local_{idx}.jpg"
        with open(save_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        try:
            ffmpeg_exe = dependency_manager.DependencyManager.get_ffmpeg_path()
            subprocess.run([ffmpeg_exe, "-y", "-i", str(save_path), "-vframes", "1", "-q:v", "2", str(thumb_path)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            thumbnail_url = f"/api/douyin-shorts/download/job_{job_id}/{thumb_path.name}"
        except Exception as e:
            thumbnail_url = ""
            
        videos.append({
            "idx": idx,
            "video_id": f"local_{idx}",
            "title": file.filename,
            "duration_sec": 60,
            "duration_fmt": "1:00",
            "path": str(save_path),
            "url": f"/api/douyin-shorts/download/job_{job_id}/{save_path.name}",
            "exists": True,
            "uploader": "Local Upload",
            "thumbnail": thumbnail_url,
            "view_count": 0,
            "editing": "pending",
            "pipeline_stage": "ingest",
            "selected": True,
        })
        
    job["message"] = f"로컬 영상 {len(videos)}개 업로드 완료"
    job["completed"] = len(videos)
    job["total"] = len(videos)
    
    _save_job(job_id)
    return {"job_id": job_id, "status": "success", "message": f"{len(files)} files uploaded"}

@router.get("/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    file_path = DOWNLOAD_ROOT / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@router.post("/send-to-factory")
async def send_to_factory(req: ProcessBatchRequest):
    if req.job_id not in _jobs:
        raise HTTPException(404)
    job = _jobs[req.job_id]
    for v in job["videos"]:
        if v["idx"] in req.target_video_indices:
            v["pipeline_stage"] = "factory"
    _save_job(req.job_id)
    return {"ok": True}

@router.get("/{job_id}")
async def get_job(job_id: int):
    j = _jobs.get(job_id)
    if not j: raise HTTPException(404)
    return {"job_id": job_id, "status": j.get("status"), "total_videos": j.get("total_videos", 0), "videos": j.get("videos", []), "message": j.get("message", "")}