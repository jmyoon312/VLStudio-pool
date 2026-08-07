from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from .. import database, models, schemas
from pydantic import BaseModel
import os
import subprocess
import platform
# import tkinter as tk
# from tkinter import filedialog

router = APIRouter(tags=["system"])

class PathRequest(BaseModel):
    path: str

import sys

@router.post("/pick-folder")
def pick_folder():
    """Stubbed for Docker/Headless: Tkinter not available."""
    # Return success with message instead of 501 to prevent UI crash
    return {"status": "manual_required", "message": "Headless environment detected. Please enter the path manually in the input field."}

@router.post("/pick-file")
def pick_file():
    """Stubbed for Docker/Headless: Tkinter not available."""
    # Return success with message instead of 501 to prevent UI crash
    return {"status": "manual_required", "message": "Headless environment detected. Please enter the file path manually in the input field."}

@router.post("/open-folder")
def open_folder(request: PathRequest, db: Session = Depends(database.get_db)):
    path = request.path
    original_path = path

    # 1. Try direct check
    if not os.path.exists(path):
        # 2. Try simple abspath (if relative)
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            path = abs_path
        else:
            # 3. Try resolving against Download Root (Settings)
            try:
                settings = db.query(models.Settings).first()
                from app.config import settings as settings_conf
                root_path = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
                if root_path:
                    joined_path = os.path.join(root_path, original_path)
                    if os.path.exists(joined_path):
                        path = joined_path
            except Exception as e:
                print(f"Error checking settings path: {e}")
                print(f"Error checking settings path: {e}")

    # Final check
    if not os.path.exists(path):
        # Try resolving relative path against project root (assuming backend is cwd)
        # e.g. path="downloads/rendered", cwd=".../backend" -> ".../downloads/rendered"
        # Try resolving relative path against backend dir and project root
        cwd = os.getcwd()
        basename = os.path.basename(cwd)
        
        # Candidate 1: Direct relative to CWD
        candidate1 = os.path.abspath(os.path.join(cwd, path))
        if os.path.exists(candidate1):
            path = candidate1
        else:
            # Candidate 2: Relative to project root (if we are in backend)
            if basename == "backend":
                project_root = os.path.dirname(cwd)
                candidate2 = os.path.abspath(os.path.join(project_root, path))
                if os.path.exists(candidate2):
                    path = candidate2
            # Candidate 3: Relative to backend (if we are in project root)
            else:
                backend_dir = os.path.join(cwd, "backend")
                candidate3 = os.path.abspath(os.path.join(backend_dir, path))
                if os.path.exists(candidate3):
                    path = candidate3
        
        # Try to just open the parent folder if the file itself is missing
        if not os.path.exists(path):
            parent = os.path.dirname(path)
            if os.path.exists(parent):
                path = parent
            else:
                 print(f"Path not found: {original_path} -> {path}")
                 raise HTTPException(status_code=404, detail=f"Path not found: {path} (Resolved: {os.path.abspath(path)})")
    
    # If the path exists but is a file, open its parent directory
    if os.path.isfile(path):
        path = os.path.dirname(path)

    import logging
    logger = logging.getLogger("uvicorn.error")
    
    try:
        # Determine if we should use the Windows Agent (for Docker environments)
        agent_url = os.getenv("WINDOWS_AGENT_URL", "http://host.docker.internal:8001")
        is_docker = os.path.exists("/.dockerenv")
        settings = db.query(models.Settings).first()

        if is_docker:
            # 1. Fetch Host Media Root from Agent itself (The Source of Truth)
            try:
                import requests
                health_resp = requests.get(f"{agent_url}/health", timeout=2)
                if health_resp.status_code == 200:
                    agent_info = health_resp.json()
                    host_media_root = agent_info.get("media_dir", "C:\\ViraLoopMedia")
                else:
                    host_media_root = "C:\\ViraLoopMedia" # Fallback
            except:
                host_media_root = "C:\\ViraLoopMedia"

            # Settings.root_download_path is usually '/app/media'
            from app.config import settings as settings_conf
            db_root = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
            target_path = os.path.abspath(path)
            
            if target_path.startswith(db_root):
                rel_path = target_path[len(db_root):].lstrip('/')
                win_path = os.path.join(host_media_root, rel_path).replace("/", "\\")
            else:
                # If path is not under root, just add 07_Downloads as suggested by user
                win_path = os.path.join(host_media_root, "07_Downloads", os.path.basename(path)).replace("/", "\\")
            
            win_path = win_path.replace("\\\\", "\\")
                
            # 3. Fallback to 8001 Agent (as suggested by user)
            try:
                logger.info(f"📡 Sending open_path request to Agent (8001): {win_path}")
                payload = {
                    "session_id": "SYSTEM_SHELL", 
                    "action": "open_path",
                    "value": win_path
                }
                # Try the standard action endpoint
                resp = requests.post(f"{agent_url}/action", json=payload, timeout=5)
                
                # Also try the simplified /open endpoint just in case
                try:
                    requests.post(f"{agent_url}/open", json={"path": win_path, "session_id": "SYSTEM_SHELL"}, timeout=2)
                except:
                    pass

                if resp.status_code == 200:
                    return {"ok": True, "message": "Folder open request sent to Windows Agent"}
                else:
                    logger.error(f"[FAIL] Agent returned error: {resp.status_code} - {resp.text}")
                    raise HTTPException(status_code=500, detail=f"Agent error: {resp.text}")
            except Exception as e:
                logger.error(f"[WARN] Agent communication failed: {e}")
                raise HTTPException(status_code=500, detail=f"Windows Agent (8001) is unreachable or failed: {e}")

        # --- Local execution fallback (ONLY for non-docker native environments) ---
        if platform.system() == "Windows":
            os.startfile(path)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", path])
        else:
            # Linux / WSL Logic
            is_wsl = False
            try:
                if os.path.exists('/proc/version'):
                    with open('/proc/version', 'r') as f:
                        if 'microsoft' in f.read().lower():
                            is_wsl = True
            except: pass

            if is_wsl:
                try:
                    wsl_proc = subprocess.run(["wslpath", "-w", os.path.abspath(path)], capture_output=True, text=True)
                    win_path = wsl_proc.stdout.strip() if wsl_proc.returncode == 0 else os.path.abspath(path)
                    try:
                        subprocess.Popen(["explorer.exe", win_path])
                    except:
                        subprocess.Popen(["/mnt/c/Windows/explorer.exe", win_path])
                except:
                    subprocess.Popen(["explorer.exe", "."])
            else:
                try:
                    subprocess.Popen(["xdg-open", path])
                except:
                    subprocess.Popen(["gio", "open", path])

        return {"ok": True}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset-database")
def reset_database():
    try:
        from ..database import engine
        from .. import models
        
        # Drop all tables
        models.Base.metadata.drop_all(bind=engine)
        
        # Create all tables
        models.Base.metadata.create_all(bind=engine)
        
        return {"ok": True, "message": "Database reset successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")


# ============================================
# yt-dlp Maintenance Endpoints
# ============================================

import importlib
import yt_dlp

def get_current_version_logic():
    """Get yt-dlp version via importlib.reload (safe for both dev & packaged builds).
    Subprocess fallback is only used in non-frozen dev mode as a secondary check."""
    try:
        importlib.reload(yt_dlp)
        return yt_dlp.version.__version__
    except Exception:
        pass
    # Fallback: subprocess (only safe in non-frozen dev mode)
    if not getattr(sys, 'frozen', False):
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'yt_dlp', '--version'],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
    return "Unknown"

@router.get("/ytdlp-version")
async def get_ytdlp_version():
    """Get current yt-dlp version"""
    return {"version": get_current_version_logic()}


@router.post("/update-ytdlp")
async def update_ytdlp():
    """Manually trigger yt-dlp update (Forces update regardless of schedule)"""
    try:
        from ..system_maintenance import system_maintenance
        
        # Use the shared maintenance logic which we fixed to use correct pip env
        result = await system_maintenance.update_ytdlp()
        
        if result['status'] == 'success':
            return {
                "success": True, 
                "message": result['message'], 
                "version": result['new_version']
            }
        else:
             return {
                "success": False, 
                "message": f"Update Failed: {result.get('error')}"
             }

    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

# ============================================
# CloakBrowser Maintenance Endpoints
# ============================================

def get_cloakbrowser_version():
    """Get current cloakbrowser version using importlib.metadata"""
    try:
        if sys.version_info >= (3, 8):
            from importlib.metadata import version, PackageNotFoundError
            try:
                return version("cloakbrowser")
            except PackageNotFoundError:
                pass
        
        # Fallback to pip show
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'show', 'cloakbrowser'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("Version:"):
                    return line.split(":", 1)[1].strip()
    except Exception as e:
        print(f"Error checking cloakbrowser version: {e}")
    return "Unknown or not installed"

@router.get("/cloakbrowser/version")
async def get_cloak_version():
    """Get current cloakbrowser version"""
    return {"version": get_cloakbrowser_version()}

@router.post("/cloakbrowser/update")
async def update_cloakbrowser():
    """Update cloakbrowser to the latest version"""
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '--upgrade', 'cloakbrowser[patchright]'],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            new_version = get_cloakbrowser_version()
            return {
                "success": True, 
                "message": "CloakBrowser 업데이트가 성공적으로 완료되었습니다.", 
                "version": new_version,
                "logs": result.stdout
            }
        else:
            return {
                "success": False, 
                "message": "업데이트 중 오류가 발생했습니다.",
                "logs": result.stderr
            }
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}


@router.get("/maintenance-status")
def get_maintenance_status():
    """Get maintenance status including last check time and auto-update setting"""
    try:
        from ..database import SessionLocal
        from .. import crud
        
        db = SessionLocal()
        try:
            settings = crud.get_settings(db)
            if not settings:
                return {
                    "auto_update_enabled": True,
                    "last_check": None,
                    "version": "Unknown"
                }
            
            return {
                "auto_update_enabled": settings.ytdlp_auto_update,
                "last_check": settings.ytdlp_last_check.isoformat() if settings.ytdlp_last_check else None,
                "version": settings.ytdlp_version or "Unknown"
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scheduler-status")
def get_scheduler_status(request: Request):
    """Get scheduler status and next run time"""
    try:
        scheduler = getattr(request.app.state, "scheduler", None)
        if not scheduler:
            return {"status": "inactive", "next_run": None}
            
        job = scheduler.get_job('channel_scan')
        if not job:
            return {"status": "no_job", "next_run": None}
            
        return {
            "status": "active" if scheduler.running else "stopped",
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        }
    except Exception as e:
        print(f"Scheduler status error: {e}")
        return {"status": "error", "message": str(e)}

# ============================================
# Config Preset Endpoints
# ============================================
from .. import schemas

@router.get("/config-presets/", response_model=list[schemas.ConfigPreset])
def get_config_presets(type: str, db: Session = Depends(database.get_db)):
    """Get presets by type"""
    return db.query(models.ConfigPreset).filter(models.ConfigPreset.type == type).all()

@router.post("/config-presets/", response_model=schemas.ConfigPreset)
def create_config_preset(preset: schemas.ConfigPresetCreate, db: Session = Depends(database.get_db)):
    """Create a new preset"""
    db_preset = models.ConfigPreset(
        type=preset.type,
        name=preset.name,
        config=preset.config
    )
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset

@router.delete("/config-presets/{preset_id}/")
def delete_config_preset(preset_id: int, db: Session = Depends(database.get_db)):
    """Delete a preset"""
    db_preset = db.query(models.ConfigPreset).filter(models.ConfigPreset.id == preset_id).first()
    if not db_preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    db.delete(db_preset)
    db.commit()
    return {"ok": True}
