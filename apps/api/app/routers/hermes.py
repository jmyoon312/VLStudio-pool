from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import os
import subprocess
import logging
import re
import requests
from .. import crud, schemas, database
from app.global_swarm_master import global_master

logger = logging.getLogger(__name__)

router = APIRouter(tags=["hermes"])

def fetch_latest_release_info(repo: str, fallback: str) -> dict:
    headers = {"User-Agent": "ViraLoop-Dashboard/1.0"}
    try:
        url = f"https://api.github.com/repos/{repo}/releases/latest"
        resp = requests.get(url, headers=headers, timeout=3)
        latest_name = fallback
        tag_name = None
        if resp.status_code == 200:
            data = resp.json()
            latest_name = data.get("name") or data.get("tag_name") or fallback
            tag_name = data.get("tag_name")
        
        tag_url = f"https://api.github.com/repos/{repo}/tags"
        tag_resp = requests.get(tag_url, headers=headers, timeout=3)
        if tag_resp.status_code == 200:
            tags = tag_resp.json()
            if tags:
                if tag_name:
                    for t in tags:
                        if t.get("name") == tag_name:
                            return {"name": latest_name, "tag": tag_name, "sha": t.get("commit", {}).get("sha")}
                return {"name": tags[0].get("name", fallback), "tag": tags[0].get("name"), "sha": tags[0].get("commit", {}).get("sha")}
    except:
        pass
    return {"name": fallback, "tag": None, "sha": None}

def get_display_version(project_root: str, path: str, latest_info: dict) -> str:
    def is_clean_version(v: str) -> bool:
        return bool(re.match(r'^v\d', v)) or ('.' in v and any(c.isdigit() for c in v))

    # 1. .version file
    version_file = os.path.join(project_root, path, ".version")
    if os.path.exists(version_file):
        try:
            with open(version_file, "r") as f:
                v = f.read().strip()
                if is_clean_version(v): return v
        except: pass

    # 2. git fallback
    import shutil
    if shutil.which("git"):
        try:
            subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"], cwd=project_root)
            res = subprocess.run(["git", "describe", "--tags", "--always", "--abbrev=0"], cwd=project_root, capture_output=True, text=True)
            tag = res.stdout.strip()
            
            if tag and is_clean_version(tag):
                return tag
                
            # 3. Match SHA
            sha_res = subprocess.run(
                ["git", "log", "-1", "--format=%H", "--", path],
                cwd=project_root, capture_output=True, text=True
            )
            local_sha = sha_res.stdout.strip()
            if local_sha and latest_info.get("sha") and (local_sha.startswith(latest_info["sha"]) or latest_info["sha"].startswith(local_sha)):
                return latest_info["name"]
        except: pass
    
    return latest_info["name"]

@router.get("/status")
def get_hermes_status(db: Session = Depends(database.get_db)):
    """
    Returns the current status and identity of the Hermes Intelligence Core.
    Standardized to hide Git hashes.
    """
    settings = crud.get_settings(db)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    agent_path = "apps/api/app/agent/hermes_core"
    
    hermes_latest = fetch_latest_release_info("NousResearch/hermes-agent", "v0.11.0")
    local_version = get_display_version(project_root, agent_path, hermes_latest)

    return {
        "identity": "Sovereign Strategic Coordinator",
        "provider": settings.hermes_agent_provider,
        "model": settings.hermes_agent_model,
        "status": "ONLINE",
        "wisdom_depth": settings.hermes_wisdom_depth,
        "auto_reflection": settings.hermes_auto_reflection,
        "version": {
            "local": local_version,
            "latest": hermes_latest["name"],
            "github_url": "https://github.com/NousResearch/hermes-agent",
            "homepage_url": "https://nousresearch.com"
        }
    }

@router.put("/settings", response_model=schemas.Settings)
def update_hermes_settings(hermes_settings: schemas.HermesSettings, db: Session = Depends(database.get_db)):
    """
    Updates Hermes-specific cognitive parameters.
    """
    current_settings = crud.get_settings(db)
    
    update_data = {
        "hermes_agent_provider": hermes_settings.agent_provider,
        "hermes_agent_model": hermes_settings.agent_model,
        "hermes_wisdom_depth": hermes_settings.hermes_wisdom_depth,
        "hermes_reflection_verbosity": hermes_settings.reflection_verbosity,
        "hermes_auto_reflection": hermes_settings.auto_reflection,
        "hermes_auto_update_enabled": hermes_settings.auto_update_enabled,
        "github_token": hermes_settings.github_token
    }
    
    for key, value in update_data.items():
        setattr(current_settings, key, value)
    
    db.commit()
    db.refresh(current_settings)
    
    # [NEW] Clear brain router model cache to pick up model setting updates immediately
    try:
        from app.agent.brain_router import brain_router
        brain_router.clear_cache()
    except Exception as e:
        logger.warning(f"Could not clear brain router cache in update_hermes_settings: {e}")

    return current_settings

@router.post("/update", response_model=schemas.HermesUpdateResponse)
def update_hermes_agent(db: Session = Depends(database.get_db)):
    """
    Safe Update: Updates only the hermes_core directory from GitHub.
    """
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            
        target_dir = "apps/api/app/agent/hermes_core"
        github_url = "https://github.com/NousResearch/hermes-agent.git"
        
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "*"])
        logger.info(f"📡 [Hermes Update] Fetching from {github_url}...")
        subprocess.run(["git", "fetch", github_url, "master"], cwd=project_root)
        result = subprocess.run(["git", "checkout", "FETCH_HEAD", "--", target_dir], cwd=project_root, capture_output=True, text=True)

        if result.returncode != 0:
             return schemas.HermesUpdateResponse(
                status="error",
                message=f"Git checkout failed: {result.stderr}",
                version_info=None
             )

        # Update .version file
        hermes_latest = fetch_latest_release_info("NousResearch/hermes-agent", "v0.11.0")
        full_target = os.path.join(project_root, target_dir)
        try:
            with open(os.path.join(full_target, ".version"), "w") as f:
                f.write(hermes_latest["name"])
        except: pass

        return schemas.HermesUpdateResponse(
            status="success", 
            message="루피(헤르메스) 지능 코어가 깃허브 최신본으로 개별 업데이트되었습니다. (ViraLoop 본체 유지)",
            version_info=hermes_latest["name"]
        )
    except Exception as e:
        logger.error(f"❌ [Hermes] Update system error: {str(e)}")
        return schemas.HermesUpdateResponse(
            status="error",
            message=str(e),
            version_info=None
        )
