# ========================================================
# [SOVEREIGN HUB] UNIFIED MSA BACKEND - API CORE
# ========================================================
# Version: 6.5.1
# Status: Audited & Certified (100% Core Coverage)

from fastapi import FastAPI, Request, APIRouter, HTTPException, Body, Form
import datetime
import time
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
import logging
import os
import sys
import asyncio
import subprocess
import threading
from contextlib import asynccontextmanager

# [Global Console Encoding Shield for Windows]
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
except Exception:
    pass



# [Infra Guard] pgvector는 PostgreSQL 전용 — Standalone(SQLite) 모드에서는 불필요
try:
    import pgvector
except ImportError:
    pass  # SQLite 모드에서는 pgvector 불필요, 자동 설치하지 않음

logger = logging.getLogger("api")

# [Windows Console UTF-8 Mode] 콘솔 코드페이지를 UTF-8로 설정 (이모지 지원)
if sys.platform == 'win32':
    try:
        import subprocess as _sp
        _sp.run(['chcp.com', '65001'], capture_output=True, shell=True)
    except Exception:
        pass

# [Windows Console Emoji Safe Guard] Windows 콘솔(cp949)에서 이모지 출력 보호
# cp949는 이모지를 표현할 수 없으므로, 모든 StreamHandler에 fallback encoding 적용
if sys.platform == 'win32':
    class _SafeStreamHandler(logging.StreamHandler):
        """StreamHandler that replaces unencodable chars (emojis) on Windows console."""
        def emit(self, record):
            try:
                msg = self.format(record)
                stream = self.stream
                # Write raw bytes via buffer to bypass console encoding entirely
                if hasattr(stream, 'buffer'):
                    stream.buffer.write(msg.encode('utf-8', errors='replace') + b'\n')
                    stream.flush()
                else:
                    stream.write(msg + self.terminator)
                    stream.flush()
            except RecursionError:
                raise
            except Exception:
                self.handleError(record)
    
    _root = logging.getLogger()
    for i, h in enumerate(list(_root.handlers)):
        if isinstance(h, logging.StreamHandler):
            safe_handler = _SafeStreamHandler(stream=h.stream)
            safe_handler.setLevel(h.level)
            safe_handler.setFormatter(h.formatter or logging.Formatter('%(message)s'))
            _root.handlers[i] = safe_handler

# [Dependency]
from app.dependency_manager import DependencyManager
DependencyManager.configure_pydub()

# [Services]
from app.services.adb_service import adb_service
from app.services.network_monitor import network_monitor
from app.services.network_core import network_service

# [Routers] - Certified Sovereign Modules
from app.routers import (
    ai_agent, ai_media, analytics_endpoints, approval, assets, auth, 
    automation_endpoints, brand_channels, bridge_api, bridge_audio, 
    bridge_config, bridge_config_v2, bridge_search, browser_profiles, browser,
    callback, captain_analytics, categories, channel_refresh, channels, 
    creative, creative_script_endpoints, custom_links, dashboard, channel_dna, 
    beats_editor, extension, files, hermes, image_gen, insights, 
    instagram_channels, logs, maintenance, mcp, mcp_registry,
    media_lab, notebooklm_accounts, oauth2_auth, 
    profiles, remover, render, reports, resource_manager,
    resource_manager_automation, scout, script_writer, scripts, 
    research, settings, stations, stream, studio, swarm, system, 
    tiktok_channels, tools, upload_rules, video, videos, wisdom,
    work_queue, youtube_channels, veo_prompt_agent,
    ddalkkak_proxy, queue_management, processing_verification, dashboard_reports, 
    health_deployment, ml_ab_search, operations, network,
    douyin_shorts_router
)
from app import job_queue, crud, models, scheduler
from app.utils.path_utils import normalize_path
from app.database import engine
from app.system_maintenance import system_maintenance

# [DB Sync]
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    
    # Silence health/bypass logging for performance
    # logging.getLogger("uvicorn.access").addFilter(StatusBypassFilter())

    # Startup Maintenance
    try:
        from app.migrate_db import repair_schema
        repair_schema()
    except: pass

    # Ensure source_external_id column exists
    try:
        from app.database import migrate_source_external_id
        migrate_source_external_id()
    except Exception as e:
        print(f"[Migration] source_external_id migration error: {e}")
    
    scheduler.start_scheduler()
    system_maintenance.start_scheduler()
    
    from app.services.captain_scheduler import captain_scheduler
    captain_scheduler.start_scheduler()
    
    network_service.initialize()
    from app.services.adb_service import adb_service
    adb_service.refresh_config() # [NEW] Sync with DB Settings
    
    from app.global_swarm_master import global_master
    asyncio.create_task(global_master.start_monitoring_loop())

    # [Startup Data Seeder] Seed DB with real YouTube data via yt-dlp if empty
    def seed_initial_data():
        import time as ttime
        ttime.sleep(2) # Reduced from 15s for faster initial loading
        try:
            from app.database import SessionLocal
            from app import models
            import yt_dlp
            db = SessionLocal()
            all_vids = db.query(models.Video).all()
            has_golden = False
            stale_ids = []
            for v in all_vids:
                raw = v.metadata_json
                meta = {}
                if isinstance(raw, str):
                    try: meta = json.loads(raw)
                    except: meta = {}
                elif isinstance(raw, dict):
                    meta = raw
                if meta.get("is_golden_nugget") is True:
                    has_golden = True
                else:
                    stale_ids.append(v.id)
            if has_golden:
                logger.info(f"[Seeder] {len(all_vids)} golden nuggets already exist, skipping.")
                db.close()
                return
            if stale_ids:
                logger.info(f"[Seeder] Removing {len(stale_ids)} stale records without golden flag...")
                db.query(models.Video).filter(models.Video.id.in_(stale_ids)).delete(synchronize_session=False)
                db.commit()
            logger.info("[Seeder] DB empty, fetching initial YouTube trending data...")
            search_terms = ["유튜브 인기급상승", "최신 유행", "한국 트렌드", "숏폼 레전드"]
            seen_ids = set()
            for term in search_terms:
                try:
                    ydl_opts = {'quiet': True, 'no_warnings': True, 'extract_flat': False, 'playlistend': 8}
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(f"ytsearch8:{term}", download=False)
                        for entry in (info.get('entries') or []):
                            vid = entry.get('id', '')
                            if not vid or vid in seen_ids:
                                continue
                            seen_ids.add(vid)
                            views = entry.get('view_count') or 0
                            subs = entry.get('channel_follower_count') or 0
                            likes = entry.get('like_count') or 0
                            comments = entry.get('comment_count') or 0
                            if views == 0:
                                continue
                            vsr = round(views / subs, 1) if subs > 0 else 0
                            ev = round((likes + comments) / views * 100, 2) if views > 0 else 0.0
                            from datetime import datetime
                            thumb = entry.get('thumbnail') or ''
                            video = models.Video(
                                video_id=vid,
                                title=(entry.get('title') or 'Unknown Title')[:500],
                                url=f"https://youtube.com/watch?v={vid}",
                                thumbnail_path=thumb,
                                view_count=views,
                                duration=entry.get('duration') or 0,
                                status="completed",
                                downloaded_at=datetime.now(),
                                metadata_json={
                                    "is_golden_nugget": True,
                                    "is_short": (entry.get('duration') or 0) <= 65,
                                    "subscribers": subs,
                                    "likes": likes,
                                    "comments": comments,
                                    "outlier_ratio": vsr,
                                    "ev_ratio": ev,
                                    "channel_name": entry.get('uploader', 'Unknown'),
                                    "category": f"실시간 트렌드 > {term}",
                                    "thumbnail": thumb,
                                }
                            )
                            db.add(video)
                except Exception as e:
                    logger.warning(f"[Seeder] yt-dlp search '{term}' failed: {e}")
            db.commit()
            count = db.query(models.Video).count()
            db.close()
            logger.info(f"[Seeder] Initial data seeding complete. {count} golden nuggets stored.")
        except Exception as e:
            logger.error(f"[Seeder] Failed: {e}")
    threading.Thread(target=seed_initial_data, daemon=True).start()

    # [Part 1: Database Self-Healing & Optional Migration]
    try:
        from app.database import SessionLocal
        from app.config import settings as app_settings
        db = SessionLocal()
        settings = db.query(models.Settings).first()
        
        # --- Migration Hook (PostgreSQL 모드에서만 실행) ---
        if app_settings.DATABASE_URL.startswith("postgresql"):
            try:
                import sqlite3, json, psycopg2
                sqlite_db = "/app/apps/api/viral_loop.db"
                if os.path.exists(sqlite_db) and not settings:
                    print(f"[Recovery] Checking SQLite source: {sqlite_db}")
                    s_conn = sqlite3.connect(sqlite_db); s_conn.row_factory = sqlite3.Row; s_cur = s_conn.cursor()
                    s_cur.execute("SELECT * FROM settings LIMIT 1"); row = s_cur.fetchone()
                    if row:
                        data = dict(row); print("[Recovery] Migrating settings data manually...")
                        from app.database import SQLALCHEMY_DATABASE_URL
                        p_conn = psycopg2.connect(SQLALCHEMY_DATABASE_URL.replace("postgresql+psycopg2", "postgresql"))
                        p_cur = p_conn.cursor()
                        json_keys = ['gemini_api_keys', 'groq_api_keys', 'fal_api_keys', 'elevenlabs_api_keys', 'typecast_api_keys', 'openrouter_api_keys', 'pexels_api_keys', 'pixabay_api_keys', 'muapi_api_keys', 'replicate_api_keys']
                        for k in json_keys:
                            if k in data and isinstance(data[k], str):
                                try: data[k] = json.loads(data[k])
                                except: data[k] = []
                        cols = ", ".join([f'\"{ k}\"' for k in data.keys() if k != 'id'])
                        vals = ", ".join(["%s"] * (len(data) - 1))
                        update_set = ", ".join([f'\"{ k}\"=EXCLUDED.\"{ k}\"' for k in data.keys() if k != 'id'])
                        sql = f'INSERT INTO settings (id, {cols}) VALUES (%s, {vals}) ON CONFLICT (id) DO UPDATE SET {update_set};'
                        p_cur.execute(sql, ([data['id']] + [json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in data.items() if k != 'id']))
                        p_conn.commit(); print("[Recovery] Settings data forced into PostgreSQL.")
                        p_cur.close(); p_conn.close(); settings = db.query(models.Settings).first()
                    s_conn.close()
            except ImportError:
                print("[Recovery] psycopg2 not installed — skipping PostgreSQL migration (standalone mode)")
        else:
            print(f"[Startup] Running in SQLite standalone mode: {app_settings.DATABASE_URL[:50]}")

        # --- Self-Healing (SQLite/PostgreSQL 공통) ---
        if settings:
            defaults = {
                "global_auto_download": True, "enable_trend_scheduling": True, "default_tts_engine": "google",
                "supertone_local_enabled": False, "ytdlp_auto_update": True, "openclaw_preferred_provider": "auto",
                "hermes_agent_provider": "groq", "hermes_agent_model": "llama-3.3-70b-versatile", "hermes_wisdom_depth": 3, "hermes_reflection_verbosity": "balanced",
                "hermes_auto_reflection": True, "hermes_auto_update_enabled": True, "scan_interval_minutes": 60
            }
            needs_commit = False
            for key, default_val in defaults.items():
                if getattr(settings, key, None) is None:
                    print(f"[Self-Healing] Setting default for {key} -> {default_val}")
                    setattr(settings, key, default_val); needs_commit = True
            if needs_commit:
                db.commit(); print("[Self-Healing] Database integrity restored.")
        else:
            from app import crud
            crud.get_settings(db)
            print("[Self-Healing] Created initial default settings.")
        db.close()
    except Exception as e:
        print(f"[Startup Recovery/Healing Failed]: {e}")

    yield
    scheduler.stop_scheduler()

app = FastAPI(
    title="Sovereign Hub API",
    description="The brain of the Sovereign Intelligence Fleet",
    version="6.5.1",
    lifespan=lifespan,
    redirect_slashes=True
)

# [Gateways]
# 1. Header Hardening (Trust Proxy)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# 2. Redirect Shield (Prevent api:8000 leakage)
@app.middleware("http")
async def redirect_shield_middleware(request: Request, call_next):
    response = await call_next(request)
    if response.status_code in [301, 302, 307, 308]:
        location = response.headers.get("Location")
        location = response.headers.get("Location")
        if location:
            # Shield against internal host/IP leakage in redirects
            internal_patterns = ["api:8000", "api:8001", "http://api", "172.", "10.", "localhost:8000"]
            if any(p in location for p in internal_patterns):
                from urllib.parse import urlparse
                parsed = urlparse(location)
                relative_path = parsed.path
                if parsed.query:
                    relative_path += f"?{parsed.query}"
                if parsed.fragment:
                    relative_path += f"#{parsed.fragment}"
                response.headers["Location"] = relative_path
    return response

# [DIAGNOSTIC] Global Request Tracer
@app.middleware("http")
async def trace_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    print(f"[TRACE] {request.method} {request.url.path} -> {response.status_code} ({process_time:.2f}ms)")
    return response

@app.get("/api/debug/routes")
def list_all_routes():
    return {"registered_routes": [r.path for r in app.routes if hasattr(r, 'path')]}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# [Windows Console UTF-8 Mode] 콘솔 코드페이지를 UTF-8로 설정 (이모지 지원)
if sys.platform == 'win32':
    try:
        import subprocess as _sp
        _sp.run(['chcp.com', '65001'], capture_output=True, shell=True)
    except Exception:
        pass


# --- Status & Health ---
@app.get("/health")
def health_check():
    return {"status": "healthy", "time": datetime.datetime.utcnow().isoformat()}

@app.get("/api/health")
def health_check_api():
    return {"status": "healthy", "time": datetime.datetime.utcnow().isoformat()}

@app.get("/status_bypass")
def get_network_status_bypass():
    # Use the comprehensive status method which handles fallbacks
    return adb_service.get_network_status_detail()

# --- Media Hosting ---
# Use local media folder unless overridden by docker env
from app.config import settings as app_settings
download_dir = os.environ.get("MEDIA_DIR", app_settings.MEDIA_ROOT)
os.makedirs(download_dir, exist_ok=True)
os.makedirs(os.path.join(download_dir, "downloads"), exist_ok=True)

@app.get("/media/{path:path}")
async def smart_media_server(path: str):
    root_path = os.path.join(download_dir, path)
    if os.path.isfile(root_path): return FileResponse(root_path)
    raw_path = os.path.join(download_dir, "raw", path)
    if os.path.isfile(raw_path): return FileResponse(raw_path)
    
    # [Smart Fallback] Check if the file is actually inside 'downloads'
    downloads_path = os.path.join(download_dir, "downloads", path)
    if os.path.isfile(downloads_path): return FileResponse(downloads_path)
    
    # [Smart Fallback] profile.jpg가 유실된 경우 동적 이니셜 아바타 생성
    if path.endswith("profile.jpg"):
        channel_name = os.path.basename(os.path.dirname(path))
        import urllib.parse
        from fastapi.responses import RedirectResponse
        safe_name = urllib.parse.quote(channel_name.replace("_", " "))
        return RedirectResponse(url=f"https://ui-avatars.com/api/?name={safe_name}&background=random&color=fff&size=256")
        
    raise HTTPException(status_code=404, detail="Asset not found")

app.mount("/files", StaticFiles(directory=download_dir), name="files")
temp_mount_dir = app_settings.TEMP_DIR
os.makedirs(temp_mount_dir, exist_ok=True)
app.mount("/temp", StaticFiles(directory=temp_mount_dir), name="temp")
if os.path.exists("thumbnails"): app.mount("/thumbnails", StaticFiles(directory="thumbnails"), name="thumbnails")

# --- Sovereign Hub: Router Distribution Map ---

# 1. Dashboard Core Modules (Standardized Prefix: /api/...)
app.include_router(profiles.router, prefix="/api/profiles", tags=["Ccore"])
app.include_router(settings.router, prefix="/api/settings", tags=["ops"])
app.include_router(swarm.router, prefix="/api/swarm", tags=["intelligence"])
app.include_router(wisdom.router, prefix="/api/wisdom", tags=["intelligence"])
app.include_router(scout.router, prefix="/api/scout", tags=["discovery"])
app.include_router(youtube_channels.router, prefix="/api/youtube", tags=["channels"])
app.include_router(tiktok_channels.router, prefix="/api/tiktok-channels", tags=["channels"])
app.include_router(instagram_channels.router, prefix="/api/instagram-channels", tags=["channels"])
app.include_router(browser_profiles.router, prefix="/api/browser-profiles", tags=["infra"])
app.include_router(work_queue.router, prefix="/api/work-queue", tags=["tasks"])
app.include_router(upload_rules.router, prefix="/api/upload-rules", tags=["infra"])
app.include_router(image_gen.router, prefix="/api/image-gen", tags=["creative"])
app.include_router(render.router, prefix="/api/render", tags=["creative"])
app.include_router(creative.router, prefix="/api/creative", tags=["creative"])
app.include_router(maintenance.router, prefix="/api/maintenance", tags=["ops"])
app.include_router(system.router, prefix="/api/system", tags=["ops"])
app.include_router(resource_manager.router, prefix="/api/resources", tags=["assets"])
app.include_router(captain_analytics.router, prefix="/api/captain", tags=["analytics"])
app.include_router(approval.router, prefix="/api", tags=["auth"])

app.include_router(network.router, prefix="/api/network", tags=["ops"])
app.include_router(resource_manager_automation.router, prefix="/api/automation/resources", tags=["automation"])

# 2. Flattened Access Nodes (Standardized Prefix: /api/...)
app.include_router(bridge_config.router, prefix="/api/bridge/config", tags=["bridge"])
app.include_router(media_lab.router, prefix="/api/lab", tags=["lab"])
app.include_router(insights.router, prefix="/api/insights", tags=["analytics"])
app.include_router(remover.router, prefix="/api/remover", tags=["ops"])
app.include_router(stream.router, prefix="/api/stream", tags=["media"])
app.include_router(stations.router, prefix="/api/stations", tags=["media"])
app.include_router(tools.router, prefix="/api/tools", tags=["ops"])
app.include_router(ai_agent.router, prefix="/api/agent", tags=["intelligence"])
app.include_router(veo_prompt_agent.router, prefix="/api/veo", tags=["intelligence"])
app.include_router(mcp.router, prefix="/api/mcp", tags=["intelligence"])
app.include_router(mcp_registry.router, prefix="/api/mcp", tags=["intelligence"])


app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
app.include_router(notebooklm_accounts.router, prefix="/api/notebooklm-accounts", tags=["infra"])

app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
app.include_router(channel_dna.router, tags=["channels"]) # channel_dna already has /api/channels prefix
app.include_router(videos.router, prefix="/api/videos", tags=["media"])
app.include_router(script_writer.router, prefix="/api/script", tags=["creative"])

app.include_router(research.router, prefix="/api", tags=["research"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(custom_links.router, prefix="/api/custom-links", tags=["ops"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["analytics"])

app.include_router(hermes.router, prefix="/api/hermes", tags=["hermes"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(scripts.router, prefix="/api/scripts")
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])
app.include_router(video.router, prefix="/api/video", tags=["video"])
app.include_router(ddalkkak_proxy.router, prefix="/api")
app.include_router(ddalkkak_proxy.direct_router, prefix="/api")
app.include_router(douyin_shorts_router.router)
app.include_router(files.router, prefix="/api/files", tags=["files"])
# app.include_router(callback.router, prefix="/api/callback", tags=["callback"])
app.include_router(extension.router, prefix="/api/extension", tags=["extension"])
app.include_router(brand_channels.router, prefix="/api/brand-channels", tags=["brand-channels"])
app.include_router(channel_refresh.router, prefix="/api/channels/refresh")


# 3. Special Integration Extensions
app.include_router(ai_media.router, prefix="/api/ai-media")
app.include_router(automation_endpoints.router, prefix="/api/automation")
app.include_router(creative_script_endpoints.router, prefix="/api/creative-scripts")
app.include_router(analytics_endpoints.router, prefix="/api/analytics")
app.include_router(bridge_api.router, prefix="/api/bridge")
app.include_router(bridge_config_v2.router, prefix="/api/bridge/config/v2")
app.include_router(bridge_search.router, prefix="/api/bridge/search")

# New Phase 7-10 Routers
app.include_router(queue_management.router)
app.include_router(processing_verification.router)
app.include_router(dashboard_reports.router)
app.include_router(health_deployment.router)
app.include_router(ml_ab_search.router)

# [Elite] Beats Editor — Command Studio
app.include_router(beats_editor.router, prefix="/api/beats", tags=["elite-studio"])
app.include_router(operations.router, prefix="/api/operations", tags=["elite-studio"])

app.include_router(browser.router)  # /api/browser/launch, /upload, /close, /engines

# --- Web Frontend Serve ---
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "dashboard", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    @app.get("/")
    def frontend_missing():
        return {"error": "Frontend build not found. Please run npm run build in apps/dashboard."}

# --- Tactical OPS ---
@app.post("/network/source/{source}")
def switch_network_source(source: str): 
    network_service.set_internet_source(source)
    if source.upper() == "WIFI": adb_service.enable_wifi()
    elif source.upper() == "LTE": adb_service.disable_wifi()
    return {"status": "success", "target": source}

@app.post("/network/rotate/{method}")
def rotate_ip(method: str):
    success = adb_service.rotate_ip(method=method)
    return {"status": "rotated" if success else "failed"}

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    import uvicorn
    # Pass app object directly for flawless PyInstaller packaging compatibility
    uvicorn.run(app, host="0.0.0.0", port=8000)
