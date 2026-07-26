from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from openai import OpenAI
from sqlalchemy.orm import Session
from typing import List
import json
from .. import crud, schemas, database
# from ..models import GoogleProject # Removed
import os
import subprocess
from app.services.orchestrator import SovereignOrchestrator

router = APIRouter(tags=["settings"])

@router.get("", response_model=schemas.Settings)
@router.get("/", response_model=schemas.Settings, include_in_schema=False)
def read_settings(db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    if not settings:
        # Create default
        settings = crud.create_settings(db, schemas.SettingsCreate())
    
    # [NEW] Expunge from session to modify paths in memory only (dynamic display)
    db.expunge(settings)
    from app.config import settings as settings_conf
    if not settings.root_download_path:
        settings.root_download_path = settings_conf.MEDIA_ROOT
    if not settings.cookies_path:
        settings.cookies_path = os.path.join(settings_conf.MEDIA_ROOT, "cookies.txt").replace("\\", "/")

    # Safe FFmpeg Check
    try:
        try:
            from app import dependency_manager
        except ImportError:
            import sys
            # Add backend root to sys.path if not present
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            if backend_root not in sys.path:
                sys.path.append(backend_root)
            from app import dependency_manager
            
        ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        if os.path.exists(ffmpeg_path):
            settings.ffmpeg_status = ffmpeg_path # Return full path
        else:
            settings.ffmpeg_status = "Missing"
    except Exception as e:
        print(f"FFmpeg check failed in settings: {e}")
        settings.ffmpeg_status = f"Error: {str(e)}"
        
    return settings

@router.put("", response_model=schemas.Settings)
@router.put("/", response_model=schemas.Settings, include_in_schema=False)
def update_settings(
    settings: schemas.SettingsBase, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    from app.config import settings as settings_conf
    # If the user saved the default resolved path, convert it back to empty string for portability
    if settings.root_download_path in [settings_conf.MEDIA_ROOT, settings_conf.root_download_path]:
        settings.root_download_path = ""
    default_cookies_path = os.path.join(settings_conf.MEDIA_ROOT, "cookies.txt").replace("\\", "/")
    if settings.cookies_path in [default_cookies_path, os.path.join(settings_conf.MEDIA_ROOT, "cookies.txt")]:
        settings.cookies_path = None
        
    updated = crud.update_settings(db, settings)
    
    # [FIX] Clear LLM Cache on Settings Update
    try:
        from .. import llm_manager
        if hasattr(llm_manager, 'clear_model_cache_global'):
             llm_manager.clear_model_cache_global()
        from app.agent.brain_router import brain_router
        brain_router.clear_cache()
    except Exception as e:
        print(f"⚠️ Failed to clear LLM cache: {e}")
    
    # Also clear DB model cache to force fresh fetch
    try:
        db_settings = crud.get_settings(db)
        if db_settings:
            db_settings.model_cache = None
            db_settings.model_cache_updated_at = None
            db.commit()
    except Exception as e:
        print(f"⚠️ Failed to clear DB model cache: {e}")

    # [NEW] Automatic Sync to Agents (The OpenClaw Way)
    try:
        orchestrator = SovereignOrchestrator(db)
        background_tasks.add_task(orchestrator.sync_paperclip)
        background_tasks.add_task(orchestrator.sync_openclaude)
        print("🔄 [Settings] Automatic Agent Sync Scheduled.")
    except Exception as e:
        print(f"⚠️ Failed to trigger automatic agent sync: {e}")

    # [NEW] Refresh ADB service configuration
    try:
        from app.services.adb_service import adb_service
        adb_service.refresh_config(updated)
    except Exception as e:
        print(f"⚠️ Failed to refresh ADB service: {e}")

    return updated

@router.patch("", response_model=schemas.Settings)
def patch_settings(
    settings: schemas.SettingsUpdate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(database.get_db)
):
    """
    Partially update settings.
    """
    current_settings = crud.get_settings(db)
    if not current_settings:
        current_settings = crud.create_settings(db, schemas.SettingsCreate())

    update_data = settings.model_dump(exclude_unset=True)
    from app.config import settings as settings_conf
    if 'root_download_path' in update_data:
        if update_data['root_download_path'] in [settings_conf.MEDIA_ROOT, settings_conf.root_download_path]:
            update_data['root_download_path'] = ""
    if 'cookies_path' in update_data:
        default_cookies_path = os.path.join(settings_conf.MEDIA_ROOT, "cookies.txt").replace("\\", "/")
        if update_data['cookies_path'] in [default_cookies_path, os.path.join(settings_conf.MEDIA_ROOT, "cookies.txt")]:
            update_data['cookies_path'] = None
    
    threshold_changed = (
        'auto_hd_viral_threshold' in update_data or 
        'auto_hd_velocity_threshold' in update_data
    )
    
    for key, value in update_data.items():
        setattr(current_settings, key, value)
    
    db.commit()
    db.refresh(current_settings)
    
    try:
        from .. import llm_manager
        if hasattr(llm_manager, 'clear_model_cache_global'):
             llm_manager.clear_model_cache_global()
        from app.agent.brain_router import brain_router
        brain_router.clear_cache()
    except Exception as e:
        print(f"⚠️ Failed to clear LLM cache: {e}")
    
    # Also clear DB model cache to force fresh fetch
    try:
        db_settings = crud.get_settings(db)
        if db_settings:
            db_settings.model_cache = None
            db_settings.model_cache_updated_at = None
            db.commit()
    except Exception as e:
        print(f"⚠️ Failed to clear DB model cache: {e}")

    if threshold_changed:
        try:
            def run_scan():
                import importlib
                from app import database
                import app.services.auto_hd
                try:
                    importlib.reload(app.services.auto_hd)
                    print("🔄 [AUTO-HD] Module reloaded successfully.")
                except Exception as reload_err:
                    print(f"⚠️ [AUTO-HD] Module reload failed: {reload_err}")

                from app.services.auto_hd import scan_all_videos_for_auto_hd
                db_new = database.SessionLocal()
                try:
                    scan_all_videos_for_auto_hd(db_new)
                finally:
                    db_new.close()

            background_tasks.add_task(run_scan)
            print("🚀 Scheduled immediate Auto HD scan.")
        except Exception as e:
             print(f"⚠️ Failed to schedule Auto HD scan: {e}")
        
    try:
        from app.services.orchestrator import SovereignOrchestrator
        orchestrator = SovereignOrchestrator(db)
        orchestrator.sync_all()
        print("✅ [Orchestrator] Synchronized LLM settings to all Hubs.")
    except Exception as e:
        print(f"⚠️ [Orchestrator] Sync failed: {e}")

    # [NEW] Refresh ADB service configuration
    try:
        from app.services.adb_service import adb_service
        adb_service.refresh_config(current_settings)
    except Exception as e:
        print(f"⚠️ Failed to refresh ADB service: {e}")

    return current_settings

@router.post("/restore", response_model=schemas.Settings)
def restore_settings(settings: schemas.SettingsBase, db: Session = Depends(database.get_db)):
    updated = crud.update_settings(db, settings)
    try:
        from .. import llm_manager
        if hasattr(llm_manager, 'clear_model_cache_global'):
             llm_manager.clear_model_cache_global()
        from app.agent.brain_router import brain_router
        brain_router.clear_cache()
    except Exception as e:
        print(f"⚠️ Failed to clear LLM cache: {e}")
    return updated

@router.get("/check-openrouter-key", response_model=dict)
def check_openrouter_key(db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    api_key = settings.openrouter_api_key
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key not set")
    client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
    try:
        client.models.list()
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}

@router.post("/test-connection")
def test_connection(request: schemas.LLMTestRequest, db: Session = Depends(database.get_db)):
    from .. import llm_manager
    settings = crud.get_settings(db)
    client = llm_manager.LLMClient(settings)
    result = client.test_provider_connectivity(
        provider=request.provider,
        base_url=request.base_url,
        api_key=request.api_key
    )
    return result

@router.get("/rate-limiting", response_model=dict)
def get_rate_limiting_settings():
    try:
        from app.config.feature_flags import feature_flags
        from app.services.rate_limiting import get_rate_limiter
        
        settings = {
            "enabled": feature_flags.is_enabled('ENABLE_RATE_LIMITER'),
            "circuit_breaker_enabled": feature_flags.is_enabled('ENABLE_CIRCUIT_BREAKER'),
            "mode": feature_flags.get_mode(),
            "available_modes": [
                {"value": "SAFE", "label": "SAFE (분당 20회)", "description": "가장 안전 - YouTube 차단 위험 최소"},
                {"value": "BALANCED", "label": "BALANCED (분당 30회)", "description": "균형 - 성능과 안전성 조화"},
                {"value": "AGGRESSIVE", "label": "AGGRESSIVE (분당 60회)", "description": "빠름 - 차단 위험 있음 (비권장)"}
            ],
            "stats": None
        }
        if settings["enabled"]:
            try:
                limiter = get_rate_limiter(settings["mode"])
                settings["stats"] = limiter.get_stats()
            except Exception as e:
                print(f"Failed to get rate limiter stats: {e}")
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")

@router.put("/rate-limiting", response_model=dict)
def update_rate_limiting_settings(
    settings_update: schemas.RateLimitSettingsUpdate,
    db: Session = Depends(database.get_db)
):
    try:
        from app.utils.env_manager import update_env_file
        from app.config.feature_flags import feature_flags
        
        enabled = settings_update.enabled if settings_update.enabled is not None else True
        cb_enabled = settings_update.circuit_breaker_enabled if settings_update.circuit_breaker_enabled is not None else True

        update_env_file({
            'ENABLE_RATE_LIMITER': str(enabled).lower(),
            'ENABLE_CIRCUIT_BREAKER': str(cb_enabled).lower(),
            'RATE_LIMIT_MODE': settings_update.mode
        })
        
        if enabled:
            feature_flags.enable('ENABLE_RATE_LIMITER')
        else:
            feature_flags.disable('ENABLE_RATE_LIMITER')
            
        if cb_enabled:
            feature_flags.enable('ENABLE_CIRCUIT_BREAKER')
        else:
            feature_flags.disable('ENABLE_CIRCUIT_BREAKER')
        
        feature_flags._flags['RATE_LIMIT_MODE'] = settings_update.mode
        
        if settings_update.requests_per_minute is not None:
             settings_obj = crud.get_settings(db)
             if not settings_obj:
                 settings_obj = crud.create_settings(db, schemas.SettingsCreate())
                 
             settings_obj.rate_limit_requests = settings_update.requests_per_minute
             if settings_update.rate_limit_window is not None:
                 settings_obj.rate_limit_window = settings_update.rate_limit_window
             if settings_update.circuit_breaker_threshold is not None:
                 settings_obj.circuit_breaker_threshold = settings_update.circuit_breaker_threshold
             
             if settings_update.enable_view_stats_collection is not None:
                 settings_obj.enable_view_stats_collection = settings_update.enable_view_stats_collection

             db.commit()
             db.refresh(settings_obj)
             
             from app.services.rate_limiting import get_rate_limiter
             limiter = get_rate_limiter(settings_update.mode)
             limiter.update_config(
                 settings_obj.rate_limit_requests, 
                 settings_obj.rate_limit_window, 
                 settings_obj.circuit_breaker_threshold
             )
        
        return {
            "status": "success",
            "message": "Rate limiting 설정이 업데이트되었습니다",
            "settings": {
                "enabled": enabled,
                "circuit_breaker_enabled": cb_enabled,
                "mode": settings_update.mode,
                "requests_per_minute": settings_update.requests_per_minute,
                "rate_limit_window": settings_update.rate_limit_window,
                "circuit_breaker_threshold": settings_update.circuit_breaker_threshold
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@router.get("/system")
def get_system_settings(db: Session = Depends(database.get_db)):
    try:
        from app.config.feature_flags import feature_flags
        from app.services.rate_limiting import get_rate_limiter
        
        settings = crud.get_settings(db)
        if not settings:
             settings = crud.create_settings(db, schemas.SettingsCreate())

        rl_enabled = feature_flags.is_enabled('ENABLE_RATE_LIMITER')
        rl_mode = feature_flags.get_mode()
        limiter = get_rate_limiter(rl_mode)
        requests_per_min = limiter.config.get('requests_per_minute', 20)

        return {
            "general": {
                "language": settings.default_language or "ko",
                "theme": "dark",
                "notifications": True
            },
             "rate_limiting": {
                "mode": rl_mode,
                "requests_per_minute": settings.rate_limit_requests or requests_per_min,
                "rate_limit_window": settings.rate_limit_window or 60,
                "circuit_breaker_threshold": settings.circuit_breaker_threshold or 5,
                "enabled": rl_enabled,
                "enable_view_stats_collection": settings.enable_view_stats_collection
            },
            "maintenance": {
                "auto_cleanup": True, 
                "cleanup_interval_days": 30, 
                "backup_enabled": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/maintenance")
def update_maintenance_settings(
    settings_update: schemas.MaintenanceSettingsUpdate,
    db: Session = Depends(database.get_db)
):
    return {
        "status": "success",
        "message": "유지보수 설정이 저장되었습니다",
        "maintenance": settings_update.dict()
    }

import requests

@router.get("/versions", response_model=schemas.AllAgentVersions)
def get_agent_versions():
    """
    Returns the official upstream latest versions and local versions for all agents.
    Standardizes on 'local | latest' and hides Git SHAs using regex.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    headers = {"User-Agent": "ViraLoop-Dashboard/1.0"}

    def get_git_sha(path: str) -> str:
        try:
            res = subprocess.run(
                ["git", "log", "-1", "--format=%H", "--", path],
                cwd=project_root, capture_output=True, text=True, shell=(os.name == 'nt')
            )
            return res.stdout.strip()
        except: return ""

    def fetch_latest_release_info(repo: str, fallback: str) -> dict:
        try:
            url = f"https://api.github.com/repos/{repo}/releases/latest"
            resp = requests.get(url, headers=headers, timeout=3)
            latest_name = fallback
            tag_name = None
            if resp.status_code == 200:
                data = resp.json()
                latest_name = data.get("name") or data.get("tag_name") or fallback
                tag_name = data.get("tag_name")
            return {"name": latest_name, "tag": tag_name, "sha": None}
        except: return {"name": fallback, "tag": None, "sha": None}

    def get_display_version(path: str, latest_info: dict) -> str:
        import re
        # 1. .version file
        version_file = os.path.join(project_root, path, ".version")
        if os.path.exists(version_file):
            try:
                with open(version_file, "r") as f:
                    v = f.read().strip()
                    if v: return v
            except: pass
        return latest_info["name"]

    import shutil
    def get_oc_version():
        oc_path = shutil.which("openclaude")
        if oc_path:
            try:
                res = subprocess.run(["openclaude", "--version"], capture_output=True, text=True, shell=True)
                return res.stdout.strip() or "v0.25.1"
            except: pass
        return "v0.25.1"

    claw_latest = fetch_latest_release_info("openclaw/openclaw", "openclaw 2026.4.29")
    paper_latest = fetch_latest_release_info("paperclipai/paperclip", "v2026.428.0")
    claude_latest = fetch_latest_release_info("Gitlawb/openclaude", "v0.25.1")
    hermes_latest = fetch_latest_release_info("ViraLoop/hermes", "v0.11.0")

    return {
        "openclaw": {
            "local": get_display_version("apps/swarm", claw_latest),
            "latest": claw_latest["name"],
            "github_url": "https://github.com/openclaw/openclaw",
            "homepage_url": "https://openclaw.io"
        },
        "paperclip": {
            "local": get_display_version("infra/paperclip", paper_latest),
            "latest": paper_latest["name"],
            "github_url": "https://github.com/paperclipai/paperclip",
            "homepage_url": "https://paperclip.ai"
        },
        "openclaude": {
            "local": get_oc_version(),
            "latest": claude_latest["name"],
            "github_url": "https://github.com/Gitlawb/openclaude",
            "homepage_url": "https://claude.ai"
        },
        "hermes": {
            "local": get_display_version("apps/api/app/agent/hermes_core", hermes_latest),
            "latest": hermes_latest["name"],
            "github_url": "https://github.com/ViraLoop/hermes",
            "homepage_url": "https://viral-hermes.ai"
        }
    }

@router.post("/sync-paperclip")
def execute_paperclip_sync(db: Session = Depends(database.get_db)):
    orchestrator = SovereignOrchestrator(db)
    return orchestrator.sync_paperclip()

@router.post("/sync-openclaude")
def execute_openclaude_sync(db: Session = Depends(database.get_db)):
    orchestrator = SovereignOrchestrator(db)
    return orchestrator.sync_openclaude()

@router.post("/paperclip/update")
def update_paperclip(db: Session = Depends(database.get_db)):
    try:
        project_root = "/app"
        if not os.path.exists(project_root):
            project_root = "/app"
            
        target_dir = "infra/paperclip"
        github_url = "https://github.com/paperclipai/paperclip.git"
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"])
        subprocess.run(["git", "fetch", "--tags", github_url, "master"], cwd=project_root)
        subprocess.run(["git", "checkout", "FETCH_HEAD", "--", target_dir], cwd=project_root)
        full_target = os.path.join(project_root, target_dir)
        subprocess.run(["pnpm", "install"], cwd=full_target)
        try:
            latest_ver = fetch_latest_release_info("paperclipai/paperclip", "v2026.428.0")["name"]
            with open(os.path.join(full_target, ".version"), "w") as f:
                f.write(latest_ver)
        except: pass
        orchestrator = SovereignOrchestrator(db)
        orchestrator.sync_paperclip()
        return {"status": "success", "message": "Paperclip OS가 업데이트되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/openclaude/update")
def update_openclaude(db: Session = Depends(database.get_db)):
    try:
        subprocess.run(["npm", "install", "-g", "@gitlawb/openclaude@latest"], capture_output=True, text=True)
        ver_proc = subprocess.run(["openclaude", "--version"], capture_output=True, text=True)
        version = ver_proc.stdout.strip() or "Latest"
        orchestrator = SovereignOrchestrator(db)
        sync_res = orchestrator.sync_openclaude()
        return {"status": "success", "message": f"OpenClaude가 업데이트되었습니다 ({version}).", "version": version, "sync": sync_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/openclaw/update")
def update_openclaw(db: Session = Depends(database.get_db)):
    try:
        project_root = "/app"
        if not os.path.exists(project_root):
            project_root = "/app"
        target_dir = "apps/swarm"
        github_url = "https://github.com/openclaw/openclaw.git"
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"])
        subprocess.run(["git", "fetch", "--tags", github_url, "master"], cwd=project_root)
        subprocess.run(["git", "checkout", "FETCH_HEAD", "--", target_dir], cwd=project_root)
        full_target = os.path.join(project_root, target_dir)
        subprocess.run(["npm", "install"], cwd=full_target)
        try:
            latest_ver = fetch_latest_release_info("openclaw/openclaw", "openclaw 2026.4.29")["name"]
            with open(os.path.join(full_target, ".version"), "w") as f:
                f.write(latest_ver)
        except: pass
        return {"status": "success", "message": "OpenClaw가 업데이트되었습니다."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
