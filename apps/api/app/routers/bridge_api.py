import logging
import os
import shutil
import asyncio
import json
import tempfile
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

from app.database import get_db
from app import models, schemas
from app.llm_manager import LLMClient
from app.video_engine import VideoGenClient
from app.services.intelligence.video_analyzer import VideoAnalyzer
# import n8n_client # Future integration

router = APIRouter(
    responses={404: {"description": "Not found"}},
)

# --- Data Models ---
class DownloadRequest(BaseModel):
    url: str
    format: str = "mp4"

class TranscribeRequest(BaseModel):
    file_path: str
    language: str = "ko"

class WorkflowRequest(BaseModel):
    workflow_id: str
    parameters: Dict[str, Any]

class TrimRequest(BaseModel):
    file_path: str
    start: float = 0
    duration: float = 10

class AssetPrepareRequest(BaseModel):
    urls: List[str]

class AssetGenerateRequest(BaseModel):
    type: str
    prompt: str
    config: Optional[Dict[str, Any]] = None

# --- Endpoints ---

@router.post("/download")
async def download_media(request: DownloadRequest):
    """
    Wraps existing downloader logic.
    """
    try:
        from app.downloader import downloader
        print(f"🤖 [Bridge] Agent requested download: {request.url}")
        
        # Use existing service
        # Defaulting to temp path context if managed by agent
        result = downloader.download_single_video(
            video_url=request.url,
            root_download_path="downloads/_agent_temp",
            force_hd=True 
        )
        
        if result.get("status") == "success":
            return {
                "status": "success", 
                "file_path": result.get("file_path"),
                "meta": result.get("metadata", {})
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error"))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
async def transcribe_media(request: TranscribeRequest):
    """
    Wraps Whisper (SubtitleEngine) to transcribe audio/video.
    """
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
    
    try:
        print(f"🤖 [Bridge] Agent requested transcription: {request.file_path}")
        
        # Import SubtitleEngine dynamically
        try:
            from subtitle_core import SubtitleEngine
        except ImportError:
            # Try adding parent dir if needed, similar to video_engine logic
            import sys
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # app/..
            if backend_dir not in sys.path: sys.path.append(backend_dir)
            from subtitle_core import SubtitleEngine
            
        from app.dependency_manager import DependencyManager
        
        engine = SubtitleEngine(
            ffmpeg_path=DependencyManager.get_ffmpeg_path(),
            model_path=os.getenv("WHISPER_MODEL_PATH", "base") 
        )
        
        # Extract raw SRT (model_name="base" or explicit)
        raw_srt, error = engine.extract_subtitle(
            request.file_path, 
            model_name="base", 
            language=request.language
        )
        
        if error:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {error}")
            
        return {
            "status": "completed",
            "srt_content": raw_srt
        }
    except Exception as e:
        logger.error(f"Bridge Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from app.schemas.pixeling import PixelingDeepControlRequest
import uuid

@router.post("/pixeling/render")
async def render_pixeling_bridge(request: PixelingDeepControlRequest):
    """
    Bridge endpoint for Swarm Agents (Pixie) to trigger Pixeling renders with deep control.
    """
    try:
        print(f"🤖 [Bridge] Agent requested Pixeling Render (Template: {request.project.template_id})")
        
        # Here we would normally enqueue this payload to the Pixeling Engine.
        # For now, we mock the queue response for the agent.
        job_id = f"px_{uuid.uuid4().hex[:8]}"
        
        # Return success to the agent so it knows the task is queued/running
        return {
            "status": "success",
            "job_id": job_id,
            "message": "Pixeling render job has been queued.",
            "estimated_duration": 45
        }
    except Exception as e:
        logger.error(f"Bridge Pixeling Render Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pixeling/learning/{niche}")
async def get_pixelearning_data(niche: str):
    """
    Bridge endpoint for Swarm Agents to query PixeLearning database for production knowledge.
    """
    try:
        print(f"🤖 [Bridge] Agent querying PixeLearning for niche: {niche}")
        
        # Mocking PixeLearning RAG Knowledge Base response
        learning_data = {
            "niche": niche,
            "best_practices": {
                "template": "TPL_썰형",
                "bgm_mood": "suspenseful",
                "ducking_required": True,
                "subtitle_style": "karaoke",
                "subtitle_colors": {"primary": "#FFFF00", "stroke": "#000000"}
            },
            "pacing": "Fast (trim silence under 0.5s)",
            "hook_advice": "Start with a contrarian question within the first 3 seconds."
        }
        
        return {
            "status": "success",
            "knowledge": learning_data
        }
    except Exception as e:
        logger.error(f"Bridge PixeLearning Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/render-remotion")
@router.post("/render") # [ALIAS] For backward compatibility
async def render_remotion(request: Request, body: Dict[str, Any]):
    """
    Triggers Remotion render via CLI with Self-Healing Harness (Linux/WSL2).
    """
    props = body.get("props", {})
    comp_id = body.get("composition", "UniversalVideo")
    from app.config import settings as app_settings
    import uuid

    if not props:
        raise HTTPException(status_code=400, detail="Missing props")

    REMOTION_ROOT = os.path.expanduser("/app/apps/web")
    
    out_name = body.get("outName", f"agent_render_{uuid.uuid4().hex[:8]}.mp4")
    output_path = os.path.join(app_settings.MEDIA_ROOT, "_agent_renders", out_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Build LLM callable that bridges to the configured Gemini/OpenAI model
    def _llm_proxy(system_prompt: str, user_msg: str) -> str:
        import base64
        from app import crud
        from app.database import SessionLocal as _SL
        with _SL() as _db:
            db_settings = crud.get_settings(_db)
            from app.schemas import Settings as _S
            _s = _S.model_validate(db_settings)
            _llm = LLMClient(_s)
        return _llm.generate_content(
            prompt=user_msg,
            model_name="gemini-1.5-flash",  # Fast model for debugging
            system_instruction=system_prompt,
        )

    # Wrap RemotionRenderer with the Self-Healing Harness
    from app.services.remotion_renderer import RemotionRenderer
    from app.services.automation.render_harness import RenderHarness

    publisher_url = str(request.base_url).rstrip("/")
    renderer = RemotionRenderer(
        frontend_dir=REMOTION_ROOT,
        media_root=app_settings.MEDIA_ROOT,
        base_url=publisher_url,
    )
    harness = RenderHarness(renderer=renderer, llm_callable=_llm_proxy, max_retries=3)

    try:
        final_path = await harness.run_async(scene_data=props, output_path=output_path)
        return {"status": "success", "file_path": final_path, "self_healed": True}
    except RuntimeError as e:
        logger.error(f"❌ [Bridge] Terminal render failure after all retries: {e}")
        raise HTTPException(status_code=500, detail=f"Render failed after retries: {str(e)[:300]}")

@router.post("/trim")
async def trim_video(request: TrimRequest):
    """
    Trims a video file using FFmpeg.
    """
    print(f"🤖 [Bridge] Trim Request: {request.file_path} ({request.start}s, {request.duration}s)")
    
    # Check if file exists. If relative, try to resolve it.
    actual_path = request.file_path
    if not os.path.isabs(actual_path):
        # Try relative to current backend root
        potential_path = os.path.abspath(actual_path)
        if not os.path.exists(potential_path):
            # Try prepending downloads dir if not present
            if not actual_path.startswith("downloads/"):
                potential_path = os.path.abspath(os.path.join("downloads/_agent_temp", actual_path))
        actual_path = potential_path

    if not os.path.exists(actual_path):
        print(f"❌ [Bridge] File not found: {actual_path} (Original: {request.file_path})")
        raise HTTPException(status_code=404, detail=f"File not found: {actual_path}")
    
    try:
        from app.video_engine import VideoEngine
        engine = VideoEngine()
        
        # We use a temporary output name
        output_name = f"trim_{os.path.basename(actual_path)}"
        out_path = os.path.join(os.path.dirname(actual_path), output_name)
        
        # Call the engine (Simplified for bridge)
        # Note: In a real world production, this should be async or queued.
        # For the swarm agent, we'll run it and return the result.
        
        from app.dependency_manager import DependencyManager
        ffmpeg_path = DependencyManager.get_ffmpeg_path()
        
        import subprocess
        cmd = [
            ffmpeg_path, "-y",
            "-ss", str(request.start),
            "-t", str(request.duration),
            "-i", actual_path,
            "-c", "copy", # Fast trim without re-encoding
            out_path
        ]
        
        print(f"Executing Trim: {' '.join(cmd)}")
        subprocess.run(cmd, check=True, capture_output=True)
        
        return {"status": "success", "file_path": out_path, "duration": request.duration}
    except Exception as e:
        print(f"❌ [Bridge] Trim error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-asset")
async def generate_asset(request: AssetGenerateRequest):
    """
    Generates visual asset (image/video) via AI.
    Used by OpenClaw agent for content creation.
    """
    logger.info(f"🤖 [Bridge] Asset generation request: type={request.type}, prompt={request.prompt[:50]}...")
    
    try:
        if request.type == "image":
            from app.services.image_gen_service import ImageGenService
            from app.config import settings as app_settings
            
            service = ImageGenService(app_settings)
            mode = request.config.get("mode", "auto") if request.config else "auto"
            style = request.config.get("style", None) if request.config else None
            
            image_path = service.generate_image(
                prompt=request.prompt,
                mode=mode,
                style=style
            )
            
            return {
                "status": "success",
                "asset_type": "image",
                "file_path": image_path,
                "prompt": request.prompt
            }
            
        elif request.type == "video":
            from app.video_engine import VideoGenClient
            from app.config import settings as app_settings
            
            client = VideoGenClient(app_settings)
            model = request.config.get("model", "kling-v1") if request.config else "kling-v1"
            
            video_path = await client.generate_video(
                prompt=request.prompt,
                model=model
            )
            
            return {
                "status": "success",
                "asset_type": "video",
                "file_path": video_path,
                "prompt": request.prompt,
                "model": model
            }
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported asset type: {request.type}")
            
    except Exception as e:
        logger.error(f"Asset Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Missing Endpoints from Master Prompt ---

@router.post("/preprocess")
async def preprocess_media(request: Dict[str, Any]):
    """
    Wraps FFmpeg for trim/normalize via MediaProcessor.
    Input: { "file_path": str, "tasks": ["normalize"] }
    """
    path = request.get("file_path")
    if not path or not os.path.exists(path):
        raise HTTPException(404, "File not found")
        
    try:
        from app.services.media_processor import media_processor
        
        # If explicit trim params exist? Not yet in schema.
        # Assuming general 'normalize' task for now.
        processed_path = media_processor.process(path, request.get('tasks', []))
        
        # Replace original file path reference might be dangerous, returning new path
        return {
            "status": "success", 
            "file_path": processed_path, # New standardized file
            "note": "Media standardized (h264/aac/loudnorm)"
        }
    except Exception as e:
        raise HTTPException(500, f"Processing Failed: {e}")

@router.get("/workflows")
async def list_workflows():
    """
    Returns available automation workflows (n8n or internal).
    """
    # Placeholder: Fetch from DB or n8n API
    return {
        "workflows": [
            {"id": "wf_1", "name": "Daily News Summary", "platform": "n8n"},
            {"id": "wf_2", "name": "Viral Shorts Generator", "platform": "internal"},
            {"id": "wf_3", "name": "Upload to YouTube", "platform": "n8n"}
        ]
    }

@router.post("/workflow/run")
async def run_workflow(request: WorkflowRequest):
    """
    Triggers a workflow by ID.
    """
    print(f"🤖 [Bridge] Running Workflow {request.workflow_id} with params: {request.parameters}")
    # Integration point for n8n webhook or internal job queue
    return {"status": "queued", "job_id": f"job_{int(asyncio.get_event_loop().time())}"}

@router.post("/prepare-assets")
async def prepare_assets(request: AssetPrepareRequest):
    """
    Standardizes a list of assets (Download -> FFmpeg -> Local Path).
    """
    try:
        from app.services.asset_factory import asset_factory
        print(f"🤖 [Bridge] Agent requested asset preparation for: {request.urls}")
        paths = await asset_factory.prepare_assets(request.urls)
        return {"status": "success", "paths": paths}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-asset")
async def generate_asset(request: AssetGenerateRequest):
    """
    Generates an asset via Unified Factory (Production API + Colab Fallback).
    """
    try:
        from app.services.asset_factory import asset_factory
        logger.info(f"🌉 [Bridge] Agent requested generation: {request.type} | {request.prompt[:30]}...")
        # AssetFactory now handles the heavy lifting via production APIs
        result = await asset_factory.generate_colab_asset(request.type, request.prompt, request.config)
        return result
    except Exception as e:
        logger.error(f"❌ [Bridge] Generation Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bridge generation error: {str(e)}")

@router.post("/n8n-trigger")
async def trigger_n8n(request: Dict[str, Any]):
    webhook = request.get("webhook_url")
    data = request.get("data")
    return {"status": "success", "detail": "N8n Triggered (Simulation)"}

# --- ClawD 3.5 Expansion ---

@router.post("/work-queue/add")
async def add_to_work_queue_bridge(request: Dict[str, Any]):
    """
    Adds a video to the system work queue for upload.
    Input: { "title": str, "video_path": str, "platforms": ["youtube"], "description": str }
    """
    try:
        from app.routers.work_queue import create_queue_item, WorkQueueItemCreate
        from app.database import SessionLocal
        
        # Standardize input
        item_data = WorkQueueItemCreate(
            title=request.get("title", "Generated by AI"),
            video_file_path=request.get("video_path"),
            description=request.get("description", ""),
            target_platforms=request.get("platforms", ["youtube"]),
            source_type="AI_AGENT",
            approval_required=True # Default to manual approval for safety
        )
        
        with SessionLocal() as db:
            item = create_queue_item(item_data, db)
            return {"status": "success", "item_id": item.id}
    except Exception as e:
        logger.error(f"Bridge Work Queue Add Failed: {e}")
        raise HTTPException(500, str(e))

@router.get("/videos/list")
async def list_videos_bridge(limit: int = 10):
    """
    Lists recent videos from the database.
    """
    try:
        from app.database import SessionLocal
        from app import models
        
        with SessionLocal() as db:
            videos = db.query(models.Video).order_by(models.Video.upload_date.desc()).limit(limit).all()
            return {
                "videos": [
                    {
                        "id": v.video_id,
                        "title": v.title,
                        "file_path": v.file_path,
                        "date": v.upload_date.isoformat() if v.upload_date else None
                    } for v in videos
                ]
            }
    except Exception as e:
        logger.error(f"Bridge Video List Failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/media-info")
async def get_media_info_bridge(request: Dict[str, Any]):
    """
    Returns technical metadata for a file using ffprobe.
    """
    path = request.get("file_path")
    if not path or not os.path.exists(path):
        raise HTTPException(404, "File not found")
        
    try:
        from app.dependency_manager import DependencyManager
        # [FIX] Use get_ffprobe_path() directly instead of deriving it manually
        ffprobe_path = DependencyManager.get_ffprobe_path()
        
        cmd = [
            ffprobe_path, "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", path
        ]
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        # [FIX] Add 30-second timeout to prevent indefinite hang if ffprobe fails
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        except asyncio.TimeoutError:
            proc.kill()
            raise Exception("ffprobe timed out after 30 seconds")
        
        if proc.returncode != 0:
            raise Exception(f"probe failed: {stderr.decode()}")
            
        return json.loads(stdout.decode())
    except Exception as e:
        logger.error(f"Bridge Media Info Failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/detect-scenes")
async def detect_scenes_bridge(request: Dict[str, Any]):
    """
    Exposes scene detection to the agent.
    """
    path = request.get("file_path")
    threshold = request.get("threshold", 30.0)
    
    if not path or not os.path.exists(path):
        raise HTTPException(404, "File not found")
        
    try:
        from app.routers.editor import detect_scenes_endpoint, DetectScenesRequest
        # We can call the endpoint function directly or implement logic
        # For bridge, let's keep it simple and reuse editor logic
        from app.editor_engine import detect_scenes
        scenes = detect_scenes(path, threshold)
        return {"status": "success", "scenes": scenes}
    except Exception as e:
        logger.error(f"Bridge Scene Detection Failed: {e}")
        raise HTTPException(500, str(e))

@router.get("/assets")
async def list_agent_assets():
    """
    Lists files in the agent's temporary directory.
    """
    temp_dir = os.path.abspath("downloads/_agent_temp")
    if not os.path.exists(temp_dir):
        return {"assets": []}
    
    import glob
    files = []
    # Scan for common media types
    for ext in ['mp4', 'png', 'jpg', 'mp3', 'wav']:
        for path in glob.glob(os.path.join(temp_dir, f"**/*.{ext}"), recursive=True):
            name = os.path.basename(path)
            # Create a simple web-accessible URL if possible, 
            # or just return the path for the /io/stream endpoint
            files.append({
                "name": name,
                "path": path,
                "type": "video" if ext == "mp4" else "image" if ext in ["png", "jpg"] else "audio",
                "size": os.path.getsize(path)
            })
    
    # Also check stylized dir
    stylized_dir = os.path.join(temp_dir, "standardized")
    if os.path.exists(stylized_dir):
         for ext in ['mp4', 'png', 'jpg', 'mp3', 'wav']:
            for path in glob.glob(os.path.join(stylized_dir, f"*.{ext}")):
                name = "[STD] " + os.path.basename(path)
                files.append({
                    "name": name,
                    "path": path,
                    "type": "video" if ext == "mp4" else "image" if ext in ["png", "jpg"] else "audio",
                    "size": os.path.getsize(path)
                })

    return {"assets": sorted(files, key=lambda x: os.path.getmtime(x['path']), reverse=True)}

# --- NEW Endpoints for ClawDBot Tools ---

@router.post("/generate-speech")
async def generate_speech_bridge(request: Dict[str, Any]):
    """
    Generates TTS audio using configured TTS engine.
    """
    try:
        from app.tts_engine import TTSEngine
        from app.config import settings as app_settings
        
        text = request.get("text")
        voice_id = request.get("voice_id")
        engine = request.get("engine", "google")
        
        tts = TTSEngine(app_settings)
        result = await tts.generate_audio(
            text=text,
            engine=engine,
            language="ko",
            voice_id=voice_id
        )
        
        return {"status": "success", "file_path": result.get("file_path")}
    except Exception as e:
        logger.error(f"TTS Generation Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workflows")
async def list_workflows_bridge():
    """
    Lists available automation workflows.
    """
    return {
        "workflows": [
            {"id": "daily_viral", "name": "Daily Viral Production", "description": "Generate and upload viral shorts"},
            {"id": "incubation", "name": "Account Incubation", "description": "Warmup activities for new accounts"},
            {"id": "research", "name": "Competitor Research", "description": "Analyze trending content"}
        ]
    }

@router.post("/verify-script-dna")
async def verify_script_dna(request: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Critiques a script based on the channel's DNA.
    """
    script = request.get("script")
    channel_id = request.get("channel_id")
    
    if not script or not channel_id:
        raise HTTPException(400, "Missing script or channel_id")
        
    from ..models import BrandChannel
    channel = db.query(BrandChannel).filter(BrandChannel.id == channel_id).first()
    if not channel or not channel.style_signature:
        return {"status": "warning", "message": "No DNA found for this channel. Skipping verification."}
        
    try:
        from ..config import settings as app_settings
        llm_client = LLMClient(app_settings)
        
        prompt = f"""
        당신은 채널의 'Style DNA'를 수호하는 비정형 콘텐츠 품질 검사관입니다.
        아래의 '채널 DNA'를 기준으로 작성된 '비디오 대본'이 이 채널의 색깔에 맞는지 검토해주세요.
        
        [채널 DNA]
        {json.dumps(channel.style_signature, indent=2, ensure_ascii=False)}
        
        [검토할 대본]
        {script}
        
        [검토 항목]
        - Pacing: DNA의 전환 속도를 지키고 있는가?
        - Tone: 브랜드 특유의 말투와 감정을 유지하는가?
        - Hook: DNA가 정의한 강력한 오프닝 패턴을 따르는가?
        
        결과는 '점수 (0-100)'와 '수정 제안 (피드백)'을 담아 JSON으로만 답변하세요.
        이 제안에 따라 대본이 다시 작성될 것입니다.
        """
        
        response = llm_client.generate_content(prompt, model_name=getattr(app_settings, "REVIEW_MODEL", "gemini-1.5-flash"))
        # Parse JSON
        import re
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return {"status": "success", "verification": json.loads(match.group(0))}
        return {"status": "success", "raw": response}
        
    except Exception as e:
        logger.error(f"Script Verification Failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/workflows/run")
async def run_workflow_bridge(request: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Triggers an n8n workflow or internal logic.
    """
    workflow_id = request.get("workflow_id")
    parameters = request.get("parameters", {})
    
    try:
        from ..crud import get_settings
        settings = get_settings(db)
        if not settings or not settings.n8n_base_url:
            # Fallback for now if not configured
            return {
                "status": "started",
                "workflow_id": workflow_id,
                "message": "n8n_base_url not configured. Running placeholder logic."
            }
            
        import httpx
        target_url = f"{settings.n8n_base_url}/webhook/{workflow_id}"
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(target_url, json=parameters, timeout=30.0)
            return {
                "status": "success",
                "webhook_url": target_url,
                "n8n_status": resp.status_code,
                "response": resp.json() if resp.status_code < 400 else resp.text
            }
            
    except Exception as e:
        logger.error(f"Workflow Trigger Failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/deep-analyze")
async def deep_analyze_bridge(request: Dict[str, Any]):
    """
    Performs multimodal video deconstruction (Vibe/Story/Source).
    """
    file_path = request.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(404, "File not found")
        
    try:
        from app.config import settings as app_settings
        llm_client = LLMClient(app_settings)
        analyzer = VideoAnalyzer(llm_client)
        
        result = await analyzer.deep_analyze(file_path)
        return {"status": "success", "analysis": result}
    except Exception as e:
        logger.error(f"Deep Analysis Failed: {e}")
        raise HTTPException(500, str(e))

@router.get("/channel-dna/{channel_id}")
async def get_channel_dna(
    channel_id: int, 
    sync: bool = False,
    db: Session = Depends(get_db)
):
    """
    Fetches the Style Signature (DNA) for a specific channel.
    If sync=True or DNA is empty, triggers synthesis from reference videos.
    """
    from ..models import BrandChannel, Video
    from datetime import datetime
    
    channel = db.query(BrandChannel).filter(BrandChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(404, "Channel not found")
    
    # Trigger Sync if requested or empty
    if sync or not channel.style_signature:
        ref_id = channel.reference_channel_id
        if not ref_id:
            # Fallback: Try to find any channel that matches niche/title or has videos
            # For now, if no ref_id, we can't sync DNA unless we have a niche
            if not channel.style_signature:
                 return {
                    "channel_id": channel_id,
                    "status": "ERROR",
                    "message": "No reference_channel_id linked. Cannot sync DNA."
                }
        else:
            try:
                # 1. Get Top 5 Viral Videos for reference
                videos = db.query(Video).filter(
                    Video.channel_id == ref_id,
                    Video.is_script_only == False
                ).order_by(Video.viral_score.desc()).limit(5).all()
                
                paths = [v.file_path for v in videos if v.file_path and os.path.exists(v.file_path)]
                
                if len(paths) > 0:
                    from ..config import settings as app_settings
                    llm_client = LLMClient(app_settings)
                    analyzer = VideoAnalyzer(llm_client)
                    
                    logger.info(f"🧬 [DNA Bridge] Syncing DNA for Channel {channel_id} using {len(paths)} videos.")
                    dna = await analyzer.aggregate_channel_dna(paths)
                    
                    if dna and "error" not in dna:
                        channel.style_signature = dna
                        channel.last_dna_sync = datetime.now()
                        db.commit()
                        db.refresh(channel)
                else:
                    logger.warning(f"⚠️ [DNA Bridge] No video files found for reference channel {ref_id}")

            except Exception as e:
                logger.error(f"DNA Sync Failed: {e}")
                # Don't raise, just return current state with warning
    
    return {
        "channel_id": channel_id,
        "title": channel.title,
        "growth_phase": channel.growth_phase,
        "last_sync": channel.last_dna_sync,
        "dna": channel.style_signature or {}
    }

@router.get("/global-config")
async def get_global_swarm_config(db: Session = Depends(get_db)):
    """
    Fetches the global swarm settings.
    """
    from app.models import GlobalSwarmConfig
    config = db.query(GlobalSwarmConfig).first()
    if not config:
        # Create default if missing
        config = GlobalSwarmConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
        
    return config


# ─── New Sovereign MCP Bridge Endpoints ──────────────────────────────

class SubtitleRequest(BaseModel):
    video_path: str
    language: str = "ko"
    style: Optional[str] = "default"
    burn_in: bool = True

class BGMRequest(BaseModel):
    video_path: str
    mood: Optional[str] = "neutral"
    
class SFXRequest(BaseModel):
    video_path: str
    style: Optional[str] = "dynamic"

class SkillCreateRequest(BaseModel):
    skill_name: str
    description: str
    parameters: Optional[Dict[str, Any]] = None

@router.post("/generate-subtitles")
async def bridge_generate_subtitles(request: SubtitleRequest):
    """
    [MCP:EDITOR] generate_subtitle_track 스킬 브릿징
    """
    from app.services.mcp.mcp_server import generate_subtitle_track
    return await generate_subtitle_track(
        video_path=request.video_path,
        style=request.style,
        language=request.language
    )

@router.post("/generate-bgm")
async def bridge_generate_bgm(request: BGMRequest):
    """
    [MCP:MEDIA] generate_background_music 스킬 브릿징
    """
    from app.services.mcp.mcp_server import generate_background_music
    return await generate_background_music(
        mood=request.mood,
        duration_sec=request.duration_sec,
        engine=request.engine
    )

@router.post("/generate-sfx")
async def bridge_generate_sfx(request: SFXRequest):
    """
    [MCP:MEDIA] generate_sfx_for_video 스킬 브릿징
    """
    from app.services.mcp.mcp_server import generate_sfx_for_video
    return await generate_sfx_for_video(
        sfx_descriptions=request.sfx_descriptions,
        video_path=request.video_path,
        mix_into_video=request.mix_into_video
    )

@router.post("/mcp/create-skill")
async def bridge_create_mcp_skill(request: SkillCreateRequest):
    """
    [MCP:COORDINATOR] create_mcp_skill 스킬 브릿징
    """
    from app.services.mcp.mcp_server import create_mcp_skill
    return await create_mcp_skill(
        skill_name=request.skill_name,
        description=request.description,
        agent_role=request.agent_role,
        inputs=request.inputs,
        expected_output=request.expected_output,
        implementation_hint=request.implementation_hint,
        auto_append=request.auto_append
    )

# ─── Script & Market Analysis Bridge ─────────────────────────────────

class MarketGapRequest(BaseModel):
    niche: str

class DirectorSchemaRequest(BaseModel):
    script_content: str
    mood: str = "dramatic"

class ScriptGenerateRequest(BaseModel):
    topic: str
    niche: str

class ScriptMutationRequest(BaseModel):
    script: str
    persona: str
    intensity: float = 0.8

@router.post("/mcp/scout-market")
async def bridge_scout_market(request: MarketGapRequest):
    try:
        from app.services.mcp.mcp_server import scout_market_gap
        return await scout_market_gap(niche=request.niche)
    except Exception as e:
        logger.error(f"Bridge Scout Market Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mcp/generate-schema")
async def bridge_generate_schema(request: DirectorSchemaRequest):
    try:
        from app.services.mcp.mcp_server import generate_director_schema
        return await generate_director_schema(script_content=request.script_content, mood=request.mood)
    except Exception as e:
        logger.error(f"Bridge Generate Schema Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mcp/generate-script")
async def bridge_generate_script(request: ScriptGenerateRequest, db: Session = Depends(get_db)):
    try:
        from app.services.mcp.mcp_server import mcp
        if not mcp:
            raise HTTPException(status_code=503, detail="MCP Server not initialized")
            
        from app.llm_manager import LLMClient
        import base64
        from app import crud
        from app.schemas import Settings as SettingsSchema
        
        db_settings = crud.get_settings(db)
        s = SettingsSchema.model_validate(db_settings)
        llm = LLMClient(s)
        
        prompt = f"당신은 시니어 대상 바이럴 영상 전문가입니다. '{request.niche}' 분야의 '{request.topic}' 주제로 강력한 후크와 도파민을 유발하는 숏폼 대본을 작성하세요."
        # Use a reliable model for scriptwriting
        script = llm.generate_content(prompt, model_name=getattr(s, "WRITER_MODEL", "gemini-1.5-flash"))
        
        return {"status": "success", "script": script}
    except Exception as e:
        logger.error(f"Bridge Generate Script Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mcp/mutate-script")
async def bridge_mutate_script(request: ScriptMutationRequest):
    try:
        from app.services.mcp.mcp_server import mutate_script_persona
        return await mutate_script_persona(original_script=request.script, persona=request.persona, intensity=request.intensity)
    except Exception as e:
        logger.error(f"Bridge Mutate Script Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RenderShortsRequest(BaseModel):
    background_video: str
    words: List[Dict[str, Any]]
    title: Optional[str] = "Generated Shorts"
    sync_video: Optional[str] = None
    output_name: Optional[str] = None

@router.post("/mcp/render-shorts")
async def bridge_render_shorts(request: RenderShortsRequest):
    try:
        from app.services.mcp.mcp_server import render_video_shorts
        return await render_video_shorts(
            background_video=request.background_video,
            words=request.words,
            title=request.title,
            sync_video=request.sync_video,
            output_name=request.output_name
        )
    except Exception as e:
        logger.error(f"Bridge Render Shorts Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import JSONResponse
import uuid
from datetime import datetime

@router.post("/llm_proxy/v1/chat/completions")
async def bridge_llm_proxy(request: Request, db: Session = Depends(get_db)):
    import base64
    """
    OpenAI-compatible /chat/completions endpoint that routes requests through
    VLStudio's configured LLM settings. This is used by external tools like Ddalkkak
    to seamlessly use the user's preferred AI model.
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        
        system_instruction = None
        prompt_parts = []
        images = []
        
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "system":
                system_instruction = content if isinstance(content, str) else str(content)
            elif role == "user":
                if isinstance(content, str):
                    prompt_parts.append(content)
                elif isinstance(content, list):
                    for part in content:
                        if part.get("type") == "text":
                            prompt_parts.append(part.get("text", ""))
                        elif part.get("type") == "image_url":
                            url = part.get("image_url", {}).get("url", "")
                            if url.startswith("data:"):
                                mime, b64 = url.split(";base64,", 1)
                                mime = mime.replace("data:", "")
                                images.append({"mime_type": mime, "data": base64.b64decode(b64)})
        
        prompt = " ".join(prompt_parts)
        
        is_json_mode = body.get("response_format", {}).get("type") == "json_object"
        if is_json_mode:
            json_instruction = "IMPORTANT: You MUST return ONLY valid JSON. Do not include markdown formatting or any other text. Output RAW JSON ONLY."
            if system_instruction:
                system_instruction += "\n\n" + json_instruction
            else:
                system_instruction = json_instruction

        # 1. Get settings and init LLMClient
        from app import crud
        from app.schemas import Settings as SettingsSchema
        
        db_settings = crud.get_settings(db)
        if not db_settings:
            db_settings = crud.create_settings(db, SettingsSchema())
        
        requested_model = body.get("model", "")
        auth_header = request.headers.get("Authorization", "")
        bearer_token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else None
        
        # Determine the model to use
        if requested_model == "youtube1":
            model_name = "youtube1/youtube1"
            if bearer_token:
                # Override DB settings so llm_manager uses the token from Ddalkkak
                db_settings.youtube1_api_keys = [bearer_token]
        else:
            model_name = getattr(db_settings, "default_llm_model", None)
            if not model_name:
                model_name = "auto"
            
        llm = LLMClient(db_settings)
        
        # 2. Call generate_content
        logger.info(f"🤖 [Bridge LLM Proxy] Forwarding request to model: {model_name}")
        response_text = llm.generate_content(
            prompt=prompt, 
            model_name=model_name, 
            system_instruction=system_instruction, 
            full_response=False, 
            images=images if images else None
        )
        
        # if response is dictionary, stringify it
        if isinstance(response_text, dict):
            response_text = json.dumps(response_text, ensure_ascii=False)
            
        if isinstance(response_text, str) and response_text.startswith("ERROR:"):
            logger.error(f"Bridge LLM generation failed: {response_text}")
            return JSONResponse({"error": {"message": response_text, "type": "server_error"}}, status_code=500)
            
        # 3. Format as OpenAI Response
        return JSONResponse({
            "id": f"chatcmpl-bridge-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": body.get("model", "default-model"),
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            }
        })

    except Exception as e:
        logger.error(f"LLM Proxy Error: {e}")
        return JSONResponse({"error": {"message": str(e), "type": "server_error"}}, status_code=500)

