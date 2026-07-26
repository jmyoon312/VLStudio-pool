from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, UploadFile, File, Form
import shutil
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from .. import crud, schemas, database, models
from ..downloader import downloader
from ..utils.file_manager import delete_video_files
import os
import asyncio
import random
import subprocess

from ..utils.path_utils import normalize_path, get_absolute_path, clean_transcript
from ..utils.transcriber import get_transcriber

router = APIRouter(tags=["videos"])

class DownloadRequest(BaseModel):
    url: str
    category_id: Optional[int] = None
    use_bypass: bool = False
    headless: bool = True # New Field, default True
    script_only: bool = False # [NEW]

class BatchDownloadRequest(BaseModel):
    urls: List[str]
    category_id: Optional[int] = None

    urls: List[str]
    category_id: Optional[int] = None

@router.post("/upload_studio")
def upload_studio_file(
    file: UploadFile = File(...),
    subfolder: str = Form("studio_uploads")
):
    """
    Upload file for Live Studio (NO DB storage - independent from gallery)
    """
    # Get settings without DB dependency
    try:
        from ..database import SessionLocal
        from .. import crud
        db = SessionLocal()
        try:
            settings = crud.get_settings(db)
            if not settings:
                settings = crud.create_settings(db, schemas.SettingsCreate())
            from app.config import settings as settings_conf
            download_root = normalize_path(settings.root_download_path if settings.root_download_path else settings_conf.MEDIA_ROOT)
        finally:
            db.close()
    except Exception as e:
        # Fallback to default path
        download_root = "downloads"
        
    # 1. Prepare Directory
    target_dir = os.path.join(download_root, subfolder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 2. Save File
    safe_filename = downloader.sanitize_filename(file.filename)
    file_path = os.path.join(target_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # 3. NO DB STORAGE - Studio files are independent from gallery
    # Return file info only
    return {
        "status": "success",
        "file_path": file_path,
        "filename": safe_filename,
        "message": "File uploaded to Studio (not saved to gallery)"
    }

class DeleteStudioFileRequest(BaseModel):
    file_path: str

@router.post("/delete_studio_file")
def delete_studio_file(request: DeleteStudioFileRequest):
    """
    Delete a file uploaded to Studio.
    """
    file_path = request.file_path
    if not os.path.exists(file_path):
         # If file doesn't exist, just consider it success (idempotent)
         return {"status": "ignored", "message": "File already gone"}
    
    try:
        if os.path.isfile(file_path):
            os.remove(file_path)
            return {"status": "success", "message": "File deleted"}
        else:
             return {"status": "error", "message": "Path is not a file"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

def generate_subtitles_task(video_id: int):
    """
    Background task to generate subtitles using Whisper.
    """
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        print(f"[AI SUB] Starting transcription task for Video ID: {video_id}")
        
        video = db.query(models.Video).get(video_id)
        if not video or not video.file_path:
            print(f"[AI SUB] Video record {video_id} not found. Skipping.")
            return
            
        # [FIX] Resovle absolute path before checking existence
        abs_video_path = get_absolute_path(video.file_path)
        
        if not os.path.exists(abs_video_path):
            print(f"[AI SUB] Video file missing on disk: {abs_video_path}. Skipping.")
            return

        # 1. Check if subtitles already exist
        base, _ = os.path.splitext(abs_video_path)
        found = False
        for ext in ['.srt', '.vtt', '.ko.srt', '.en.srt', '.ja.srt', '.zh.srt']:
            if os.path.exists(base + ext):
                found = True
                break
        
        if found:
            print(f"[AI SUB] Subtitles already exist for {video.title}. Skipping.")
            return

        # 2. Get Whisper Settings
        settings = crud.get_settings(db)
        model_size = settings.default_model_size if settings and settings.default_model_size else "base"
        model_path = settings.whisper_model_path if settings and settings.whisper_model_path else None

        print(f"[AI SUB] Starting transcription for {video.title} (ID: {video_id}) using {model_size} model...")
        
        # 3. Transcribe (Passing absolute path via Isolated Subprocess)
        import subprocess
        import json
        import sys
        
        cli_path = os.path.join(os.path.dirname(__file__), "..", "utils", "cli_transcribe.py")
        cmd = [
            sys.executable, cli_path,
            "--video_path", abs_video_path,
            "--model_size", str(model_size)
        ]
        if model_path:
            cmd.extend(["--model_path", str(model_path)])
            
        print(f"[AI SUB] Spawning isolated transcription process to prevent VRAM conflict (GTX 1060 Safe Mode)...")
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        result = {"status": "error", "message": f"Subprocess failed with Code {process.returncode}"}
        output = process.stdout
        
        if process.returncode != 0:
            print(f"❌ [AI SUB] Subprocess Runtime Error. Check logs.")
            print(f"--- STDERR ---\n{process.stderr}\n--------------")
            
        try:
            # Extract JSON bound by markers
            if "---TRANSCRIPTION_JSON_START---" in output:
                json_str = output.split("---TRANSCRIPTION_JSON_START---")[1].split("---TRANSCRIPTION_JSON_END---")[0].strip()
                result = json.loads(json_str)
        except Exception as json_e:
            print(f"[AI SUB] JSON Parse Error: {json_e}")
            print(f"[AI SUB] Raw Output: {output}")

        if result.get('status') == 'success':
            print(f"✅ [AI SUB] Successfully generated subtitles for {video.title} in {result['language']}")
            
            # [NEW] Update video metadata with detected language
            if not video.metadata_json:
                video.metadata_json = {}
            
            # Force SQLAlchemy to recognize the JSON change
            from sqlalchemy.orm.attributes import flag_modified
            video.metadata_json['language'] = result['language']
            flag_modified(video, "metadata_json")
            db.commit()
            print(f"DEBUG: Updated video language to {result['language']} after transcription.")
        else:
            print(f"❌ [AI SUB] Transcription failed: {result['message']}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ [AI SUB] Error in transcription task: {e}")
    finally:
        db.close()

@router.post("/upload")
def upload_video(
    file: UploadFile = File(...),
    subfolder: str = Form("studio_uploads"),
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    if not settings:
        settings = crud.create_settings(db, schemas.SettingsCreate())
        
    # 1. Prepare Directory
    from app.config import settings as settings_conf
    download_root = normalize_path(settings.root_download_path if settings.root_download_path else settings_conf.MEDIA_ROOT)
    target_dir = os.path.join(download_root, subfolder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 2. Save File
    safe_filename = downloader.sanitize_filename(file.filename)
    file_path = os.path.join(target_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # 3. Register in DB (to appear in Library)
    # Ensure "Studio Uploads" Channel exists
    channel_name = "Studio Uploads"
    channel = db.query(models.Channel).filter(models.Channel.name == channel_name).first()
    if not channel:
        channel = models.Channel(
            name=channel_name,
            url=f"local://{channel_name}",
            platform="local",
            folder_name=subfolder,
            status="active",
            subscriber_count=0
        )
        db.add(channel)
        db.commit()
        db.refresh(channel)
        
    # Create Video Record
    video_id = f"local_{int(datetime.now().timestamp())}_{safe_filename}"
    
    # [Phase 1-1] Generate dynamic thumbnail
    thumbnail_filename = f"{os.path.splitext(safe_filename)[0]}.jpg"
    thumbnail_full_path = os.path.join(target_dir, thumbnail_filename)
    thumbnail_db_path = None
    try:
        from ..video_engine import VideoGenClient
        engine = VideoGenClient(settings)
        thumbnail_db_path = engine.generate_thumbnail(video_path=file_path, output_path=thumbnail_full_path, capture_ratio=0.3)
    except Exception as e:
        print(f"⚠️ Thumbnail generation failed: {e}")

    video = models.Video(
        channel_id=channel.id,
        video_id=video_id,
        title=safe_filename,
        file_path=file_path,
        thumbnail_path=thumbnail_db_path, # [FIX] Automatically generated
        upload_date=datetime.now(),
        view_count=0,
        duration=0,
        status="completed",
        metadata_json={"source": "upload", "original_filename": file.filename}
    )
    
    db.add(video)
    db.commit()
    db.refresh(video)
    
    return {"status": "success", "file_path": file_path, "video": video}

@router.post("/download")
def download_video(download_req: DownloadRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    # Get global settings for download path
    settings = crud.get_settings(db)
    if not settings:
        # Should not happen if initialized correctly, but handle it
        settings = crud.create_settings(db, schemas.SettingsCreate())
        
    print(f"DEBUG: Endpoint received download request for URL: {download_req.url}")
        
    # Determine download path based on category
    from ..utils.path_utils import get_standardized_download_path
    download_root = get_standardized_download_path(settings)
    
    # 1. Resolve Channel Info FIRST (Required for correct folder structure)
    print(f"DEBUG: Resolving channel info for {download_req.url}")
    try:
        channel_info = downloader.get_channel_info(download_req.url)
    except Exception as e:
        print(f"Warning: Failed to resolve channel info early: {e}")
        channel_info = None

    channel_name = "Unknown_Channel"
    channel_thumbnail = None
    
    if channel_info:
        channel_name = channel_info.get('name') or channel_info.get('uploader') or "Unknown_Channel"
        channel_thumbnail = channel_info.get('thumbnail')
        print(f"DEBUG: Resolved Channel: {channel_name}")
    
    # Logic to determine category:
    target_category_id = download_req.category_id
    use_temp_storage = False
    category = None # [FIX] Initialize variable to avoid UnboundLocalError
    
    if not target_category_id:
        # Search DB by channel name if info available
        if channel_info:
            channel = db.query(models.Channel).filter(models.Channel.name == channel_name).first()
            if channel and channel.category_id:
                target_category_id = channel.category_id
            else:
                use_temp_storage = True
        else:
            use_temp_storage = True

    # 2. Construct Path
    safe_channel_name = downloader.sanitize_filename(channel_name).replace(" ", "_").strip()
    
    if target_category_id:
        category = crud.get_category(db, target_category_id)
        if category:
            cat_folder = category.folder_name or sanitize_folder_name(category.name)
            # [FIX] Append Channel Name folder
            download_root = os.path.join(download_root, cat_folder, safe_channel_name)
    else:
        # Temp Storage Path
        download_root = os.path.join(download_root, "_temp_storage", safe_channel_name)

    os.makedirs(download_root, exist_ok=True)

    # Download profile image if available
    if channel_thumbnail:
        import requests
        profile_path = os.path.join(download_root, "profile.jpg")
        if not os.path.exists(profile_path):
            try:
                print(f"Downloading profile image for {channel_name}...")
                headers = {'User-Agent': 'Mozilla/5.0'}
                response = requests.get(channel_thumbnail, headers=headers, timeout=10, proxies={'http': 'socks5://127.0.0.1:10800', 'https': 'socks5://127.0.0.1:10800'})
                if response.status_code == 200:
                    with open(profile_path, 'wb') as f:
                        f.write(response.content)
            except Exception as e:
                print(f"Failed to download profile image: {e}")

    # [FIX] Use high-level download_single_video instead of direct YTDLP call
    # This re-enables Smart Strategy selection (Bypass mode for TikTok, Douyin, etc.)
    result = downloader.download_single_video(
        video_url=download_req.url,
        root_download_path=download_root,
        cookies_path=settings.cookies_path if settings.cookies_path and os.path.exists(settings.cookies_path) else None,
        script_only=getattr(download_req, 'script_only', False),
        force_hd=True
    )

    if result.get('status') != 'success':
        raise HTTPException(status_code=500, detail=f"Download failed: {result.get('error', 'Unknown error')}")

    metadata = result.get('metadata', {})
    video_file = result.get('file_path')

    if not video_file:
        raise HTTPException(status_code=500, detail="Downloaded file not found")

    # Save to Database
    try:
        from datetime import datetime

        # 1. Handle Channel
        # [FIX] Do NOT auto-create channels during direct downloads.
        # Creating a channel here would cause the scheduler to start
        # monitoring it automatically, downloading all new videos from that channel.
        # Only link to an EXISTING registered channel, otherwise leave channel_id=null.
        channel_id = None
        if category:
            channel_name_meta = metadata.get('uploader') or metadata.get('channel') or channel_name or ""
            channel_url_meta = metadata.get('uploader_url') or metadata.get('channel_url') or ""

            # Only look up — never create
            existing_channel = None
            if channel_name_meta:
                existing_channel = db.query(models.Channel).filter(
                    models.Channel.name == channel_name_meta
                ).first()
            if not existing_channel and channel_url_meta:
                existing_channel = db.query(models.Channel).filter(
                    models.Channel.url == channel_url_meta
                ).first()

            if existing_channel:
                channel_id = existing_channel.id
                print(f"[DL] Linked video to existing channel: {existing_channel.name} (id={channel_id})")
            else:
                print(f"[DL] Channel '{channel_name_meta}' not registered — saving video without channel (channel_id=null)")

        # 2. Parse upload_date
        upload_date = None
        ud_str = metadata.get('upload_date')
        if ud_str:
            try:
                from datetime import datetime as dt
                upload_date = dt.strptime(ud_str, '%Y%m%d')
            except: pass

        # 3. Find thumbnail (relative path)
        thumbnail_path = None
        if video_file:
            base = os.path.splitext(video_file)[0]
            for ext in ['.jpg', '.webp', '.png']:
                candidate = base + ext
                if os.path.exists(candidate):
                    thumbnail_path = candidate
                    break

        # 4. Make paths relative to root_download_path
        from app.config import settings as settings_conf
        root = settings.root_download_path if settings.root_download_path else settings_conf.MEDIA_ROOT
        rel_file = os.path.relpath(video_file, root) if root and os.path.isabs(video_file) else video_file
        rel_thumb = os.path.relpath(thumbnail_path, root) if (thumbnail_path and root and os.path.isabs(thumbnail_path)) else thumbnail_path

        # [FIX] Use centralized save_video_to_db instead of direct models.Video creation 
        # to ensure all triggers (transcription, history, metrics) are applied consistently.
        # [NEW] auto_create_channel=False: Prevent registering new channels during manual downloads.
        is_script_only = getattr(download_req, 'script_only', False)
        video = save_video_to_db(db, result, metadata, channel_id, category.id if category else None, is_script_only, background_tasks, auto_create_channel=False)

    except Exception as e:
        print(f"❌ Failed to save video to DB: {e}")

    return {
        "status": "success",
        "message": "Download completed",
        "file_path": video_file,
        "video": video
    }


def save_video_to_db(db: Session, result: dict, metadata: dict, channel_id: Optional[int], category_id: Optional[int], is_script_only: bool = False, background_tasks: Optional[BackgroundTasks] = None, auto_create_channel: bool = True):
    """
    Helper to save video to DB.
    
    Args:
        channel_id: If provided, use this channel directly (preferred)
        category_id: If channel_id is None, use this to create/find channel
        background_tasks: Optional FastAPI background tasks
        auto_create_channel: [NEW] If False, do NOT create a new channel if it doesn't exist.
    """
    # [FIX] Use provided channel_id if available, otherwise find/create channel
    if channel_id is None:
        # Original logic: find or create channel from metadata
        channel_name = metadata.get('uploader') or "Unknown"
        channel_url = metadata.get('uploader_url') or f"local://{channel_name}"
        
        # [FIX] Extract Subscriber Count
        sub_count = metadata.get('channel_follower_count') or metadata.get('uploader_sub_count') or 0
        
        channel = db.query(models.Channel).filter(models.Channel.url == channel_url).first()
        if not channel:
            channel = db.query(models.Channel).filter(models.Channel.name == channel_name).first()
            
        if not channel:
            if not auto_create_channel:
                print(f"[DL] Skipping channel creation for '{channel_name}' as requested (auto_create_channel=False)")
                # Proceed with channel_id = None
            else:
                channel = models.Channel(
                    url=channel_url,
                    name=channel_name,
                    platform=metadata.get('extractor_key', 'youtube'),
                    folder_name=downloader.sanitize_filename(channel_name).replace(" ", "_"),
                    category_id=category_id,
                    status="active",
                    subscriber_count=sub_count
                )
                try:
                    db.add(channel)
                    db.commit()
                    db.refresh(channel)
                except:
                    db.rollback()
                    channel = db.query(models.Channel).filter(models.Channel.name == channel_name).first()
        else:
            # Update subscriber count if it changed
            if sub_count > 0:
                channel.subscriber_count = sub_count
                db.commit()
        
        if channel:
            channel_id = channel.id
    else:
        # [NEW] Use provided channel_id directly
        channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
        if not channel:
            raise ValueError(f"Channel with id {channel_id} not found")

    # Video Logic
    video = db.query(models.Video).filter(models.Video.video_id == metadata.get('id')).first()
    
    # Extract Stats
    view_count = metadata.get('view_count') or 0
    duration = metadata.get('duration') or 0
    like_count = metadata.get('like_count') or 0
    comment_count = metadata.get('comment_count') or 0
    
    # [FIX] Calculate Initial Scores
    viral_score = 0.0
    effective_subs = (channel.subscriber_count if channel and channel.subscriber_count else 0) or 1000
    if effective_subs > 0:
        viral_score = round((view_count / effective_subs) * 100, 1)

    # [FIX] Calculate Velocity Score (Lifetime Average for new videos)
    upload_dt = datetime.strptime(metadata.get('upload_date'), '%Y%m%d') if metadata.get('upload_date') else datetime.now()
    lifetime_hours = max(0.1, (datetime.now() - upload_dt).total_seconds() / 3600)
    velocity_score = round(view_count / lifetime_hours, 1)
    
    # Inject into metadata so frontend sees it immediately in JSON
    metadata['viral_score'] = viral_score
    metadata['velocity_score'] = velocity_score
    metadata['view_count'] = view_count # Ensure sync

    if not video:
        video = models.Video(
            channel_id=channel_id,
            video_id=metadata.get('id'),
            title=metadata.get('title'),
            file_path=result.get('file_path'),
            thumbnail_path=result.get('thumbnail_path'),
            upload_date=upload_dt,
            metadata_json=metadata,
            is_script_only=is_script_only,
            view_count=view_count, 
            duration=duration,     
            viral_score=viral_score, 
            velocity_score=velocity_score,
            url=metadata.get('url') or metadata.get('webpage_url') # [FIX] Add missing URL for transcription check
        )
        db.add(video)
        db.commit() # Commit to get ID
        db.refresh(video)
        
        # [FIX] Create Initial History Point
        initial_history = models.VideoHistory(
            video_id=video.id,
            view_count=view_count,
            timestamp=datetime.now()
        )
        db.add(initial_history)
        
        # We can create a separate table for likes/comments if needed later, 
        # but for now VideoHistory only supports view_count.
        
        db.commit()
        
        # [MODIFIED] User requested to disable automatic Whisper transcription during download.
        # Transcription must now be triggered manually via tools if needed.
        
        return video
        
    else:
        video.file_path = result.get('file_path')
        video.thumbnail_path = result.get('thumbnail_path')
        video.metadata_json = metadata
        video.is_script_only = is_script_only
        video.status = "completed"
        # Update current stats too if they changed (re-download case)
        video.view_count = view_count
        video.duration = duration
        if channel_id and not video.channel_id:
            video.channel_id = channel_id
            
        db.commit()
        return video


import re

def sanitize_folder_name(name):
    return re.sub(r'[\\/*?:"<>|]', "", name).replace(" ", "_")

@router.get("/{video_id}", response_model=schemas.Video)
def read_video(video_id: int, db: Session = Depends(database.get_db)):
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # [NEW] Populate full content for the editor
    content = video.description or ""
    
    # Try to load from file if available (full transcript)
    if video.file_path:
        abs_path = get_absolute_path(video.file_path)
        base, _ = os.path.splitext(abs_path)
        found_sub = None
        # Priority: ko.srt (YouTube default) -> ko.vtt -> vtt/srt (better for analysis) -> txt (raw)
        for ext in ['.ko.srt', '.ko.vtt', '.en.srt', '.en.vtt', '.vtt', '.srt', '.txt']:
            potential = base + ext
            if os.path.exists(potential):
                found_sub = potential
                break
        
        if found_sub:
            try:
                with open(found_sub, 'r', encoding='utf-8') as f:
                    raw_content = f.read() # Read FULL content for single view
                    content = clean_transcript(raw_content)
            except Exception as e:
                logger.error(f"Error reading transcript file: {e}")

    # Attach content to the object so schema can pick it up
    try:
        setattr(video, "content", clean_transcript(content))
    except Exception:
        pass
        
    return video

@router.get("/", response_model=List[schemas.Video])
def read_videos(
    skip: int = 0, 
    limit: int = 100, 
    channel_id: int = None, 
    category_id: int = None, # [NEW]
    folder: str = None, # [NEW]
    search: str = None,
    mode: str = "video", # [NEW]
    is_script_only: bool = None,
    upload_status: str = None, # [NEW] Filter
    exclude_used: bool = False, # [NEW]
    sort_by: str = "priority", # [FIX] Default smart sort (Priority > Date)
    sort_order: str = "desc",
    db: Session = Depends(database.get_db),
    request: Request = None
):
    try:
        from ..utils import get_web_url
        
        videos = crud.get_videos(
            db, 
            skip=skip, 
            limit=limit, 
            channel_id=channel_id,
            category_id=category_id, # [NEW]
            folder=folder, # [NEW]
            search_query=search,
            mode=mode, # [NEW]
            upload_status=upload_status,
            exclude_used=exclude_used,
            is_script_only=is_script_only, # [FIX] Pass explicit filter
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Post-process videos for safety & script content
        safe_videos = []
        for video in videos:
            try:
                # [FIX] Check file existence
                if video.file_path and not os.path.exists(video.file_path):
                     # If file missing, mark it? Or just let it be?
                     # Ideally we mark it, but schemas don't have that yet, only schemas.AssetQuery
                     pass

                # [NEW] Populate Content for Script Mode
                if mode == "script":
                    content = video.description or ""
                    
                    # Try to load from file if available (subtitle or txt)
                    if video.file_path:
                        base, _ = os.path.splitext(video.file_path)
                        found_sub = None
                        for ext in ['.ko.vtt', '.en.vtt', '.vtt', '.srt', '.txt']:
                            if os.path.exists(base + ext):
                                found_sub = base + ext
                                break
                        
                        if found_sub:
                            try:
                                with open(found_sub, 'r', encoding='utf-8') as f:
                                    # Read first 500 chars for preview
                                    file_text = f.read(1000)
                                    if file_text:
                                        content = file_text
                            except: pass
                    
                    # Assign to schema field (We need to ensure it's a dict or object that permits assignment if it's ORM)
                    # SQLAlchemy objects: we can set attributes usually, but 'content' is not in model, only schema.
                    # So we need to convert to Pydantic first?
                    # Or we can just attach it if possible.
                    # Better: Convert to dict or schema manually or attach dynamic attr if Pydantic 'from_attributes' handles it?
                    # Pydantic 'from_attributes' reads attributes. Python objects allow dynamic attrs?
                    # No, SQLAlchemy models might limit it.
                    # Let's use `setattr`.
                    try:
                        setattr(video, "content", content)
                    except Exception:
                        # If setattr fails (e.g., on SQLAlchemy model), skip it
                        pass

                safe_videos.append(video)
            except Exception:
                pass
        
        return safe_videos


    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR in read_videos: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error in read_videos: {str(e)}")

@router.post("/batch-download")
async def batch_download(
    request: BatchDownloadRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    results = []
    
    # Get global settings
    settings = crud.get_settings(db)
    if not settings:
        settings = crud.create_settings(db, schemas.SettingsCreate())
    
    from ..utils.path_utils import get_standardized_download_path
    download_root = get_standardized_download_path(settings)
    
    # Determine category path
    target_category_id = request.category_id
    if target_category_id:
        category = crud.get_category(db, target_category_id)
        if category:
            download_root = os.path.join(download_root, category.folder_name)
    else:
        # Default to temp if no category
        download_root = os.path.join(download_root, "_temp_storage")
        os.makedirs(download_root, exist_ok=True)

    for url in request.urls:
        if not url.strip():
            continue
            
        try:
            # 1. Download (Network Phase) - Await this to prevent IP ban
            print(f"Downloading: {url}")
            result = downloader.download_single_video(
                video_url=url,
                root_download_path=download_root,
                cookies_path=settings.cookies_path
            )
            
            if result['status'] == 'success':
                # 2. Save to DB
                metadata = result.get('metadata')
                if metadata:
                    # (Simplified DB logic for batch - reuse existing logic if possible, 
                    # but for now let's duplicate the essential parts to keep it self-contained or call a helper)
                    # To avoid massive code duplication, we should ideally refactor DB saving into a helper function.
                    # For this task, I will implement the minimal DB save here.
                    
                    # ... (Channel/Video creation logic similar to single download) ...
                    # For brevity and reliability, let's assume the single download function handles DB? 
                    # No, download_single_video ONLY downloads. The DB logic was in the route handler.
                    # I should extract DB logic to a helper function.
                    
                    # Refactoring DB logic to helper:
                    # Unified DB save with transcription trigger
                    # [NEW] auto_create_channel=False for batch manual downloads too
                    save_video_to_db(db, result, metadata, None, target_category_id, False, background_tasks, auto_create_channel=False)
                
                # 3. Background Conversion (CPU Phase) - Fire and Forget
                raw_file = result.get('raw_file_path', result['file_path'])
                if raw_file and os.path.exists(raw_file):
                    print(f"Queuing background conversion for {raw_file}")
                    background_tasks.add_task(run_background_conversion, raw_file, db)
                
                results.append({"url": url, "status": "success", "title": metadata.get('title')})
            else:
                results.append({"url": url, "status": "failed", "error": result.get('error')})

            # 4. Random Delay (Reduced for speed)
            delay = random.uniform(2, 5)
            print(f"Sleeping for {delay:.2f}s...")
            await asyncio.sleep(delay)
            
        except Exception as e:
            print(f"Batch error for {url}: {e}")
            results.append({"url": url, "status": "failed", "error": str(e)})

    return {"results": results}

async def run_background_conversion(input_path: str, db: Session):
    # Wrapper to run conversion and update DB
    # Note: db session might be closed if passed directly from request? 
    # Better to create new session or pass ID. 
    # BackgroundTasks runs after response, so dependency injection session is closed.
    # We must create a new session.
    
    from ..database import SessionLocal
    new_db = SessionLocal()
    try:
        print(f"Background converting: {input_path}")
        result = await downloader.convert_to_h264(input_path, delete_original=True)
        
        if result['status'] == 'success':
            # Update DB
            # We need to find the video by file path (old path)
            # Or pass video_id to this function. 
            # Passing path is risky if it changes, but input_path is the raw one.
            # The DB currently has the raw path (saved in save_video_to_db).
            
            video = new_db.query(models.Video).filter(models.Video.file_path == input_path).first()
            if video:
                video.file_path = result['output_path']
                video.status = "completed"
                new_db.commit()
                print(f"DB updated for converted video: {video.title}")
            else:
                print(f"Warning: Video record not found for path {input_path}")
    except Exception as e:
        print(f"Background conversion error: {e}")
    finally:
        new_db.close()


@router.get("/{video_id}/subtitles")
def get_video_subtitles(video_id: int, db: Session = Depends(database.get_db)):
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not video.file_path:
        raise HTTPException(status_code=404, detail="Video file path not found")

    # [FIX] Use get_absolute_path to handle 'downloads/' prefix correctly
    abs_file_path = get_absolute_path(video.file_path)
    directory = os.path.dirname(abs_file_path)

    if not os.path.exists(directory):
         print(f"DEBUG: Subtitle directory not found: {directory}")
         return {"content": "Directory not found."}

    # Get video filename without extension (use absolute path for consistency)
    video_basename = os.path.splitext(os.path.basename(abs_file_path))[0]
    
    subtitle_path = None
    
    # List all files in directory to find matching subtitle
    try:
        # robust subtitle finder
        candidates = []
        for f in os.listdir(directory):
            # [NEW] Expanded extensions to include .txt
            if f.lower().endswith(('.vtt', '.srt', '.txt')):
                # Match if starts with basename (most reliable)
                if f.lower().startswith(video_basename.lower()):
                    candidates.append(os.path.join(directory, f))
                # Fallback to ID check
                elif video.video_id and video.video_id in f:
                    candidates.append(os.path.join(directory, f))
        
        if candidates:
            # [NEW] Language prioritization
            # 1. Main Language of video (from metadata)
            # 2. English (Universal fallback)
            # 3. Korean (User locale)
            # 4. Others
            
            video_lang = (video.metadata_json or {}).get('language', '').lower()
            
            def sort_key(p):
                base = os.path.basename(p).lower()
                score = 100
                
                # Filter priority
                if video_lang and (f'.{video_lang}.' in base or base.endswith(f'.{video_lang}.srt') or base.endswith(f'.{video_lang}.vtt')):
                    score = 1
                elif '.en.' in base or base.endswith('.en.srt') or base.endswith('.en.vtt'):
                    score = 10 if video_lang != 'en' else 1
                elif '.ko.' in base or base.endswith('.ko.srt') or base.endswith('.ko.vtt'):
                    score = 20 if video_lang != 'ko' else 1
                
                return (score, len(base))
            
            candidates.sort(key=sort_key)
            subtitle_path = candidates[0]
            print(f"DEBUG: Found {len(candidates)} subs. Video Lang: {video_lang}. Selected: {os.path.basename(subtitle_path)}")
    except OSError:
        pass

    if not subtitle_path or not os.path.exists(subtitle_path):
        return {"content": "No subtitles found."}

    try:
        with open(subtitle_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Clean content (remove timestamps and metadata)
        import re
        
        lines = content.splitlines()
        cleaned_lines = []
        is_vtt = subtitle_path.lower().endswith('.vtt')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line == "WEBVTT":
                continue
            # Skip numeric counters
            if line.isdigit():
                continue
            # Skip timestamps (00:00:00.000 --> 00:00:05.000)
            if '-->' in line:
                continue
            
            # Remove HTML-like tags (e.g. <c.colorCCCCCC>)
            line = re.sub(r'<[^>]+>', '', line)
            
            # Remove [music] tag (case-insensitive)
            line = re.sub(r'\[music\]', '', line, flags=re.IGNORECASE)
            
            # Avoid duplicates if they are close (simple de-dupe)
            if cleaned_lines and cleaned_lines[-1] == line:
                continue
                
            cleaned_lines.append(line)
            
        return {"content": "\n".join(cleaned_lines)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading subtitle: {str(e)}")

@router.post("/{video_id}/generate-subtitles")
def trigger_subtitle_generation(
    video_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    """
    Triggers subtitle generation for an already-downloaded video.
    Called directly from the Gallery subtitle viewer modal.
    """
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.file_path:
        raise HTTPException(status_code=400, detail="Video has no file path")
    
    abs_path = get_absolute_path(video.file_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail=f"Video file not found on disk: {abs_path}")
    
    background_tasks.add_task(generate_subtitles_task, video_id)
    return {"status": "queued", "message": f"자막 생성이 시작되었습니다. 잠시 후 다시 확인하세요."}


class BatchDetailsRequest(BaseModel):
    ids: List[int]

@router.post("/batch-details")
def get_batch_details(request: BatchDetailsRequest, db: Session = Depends(database.get_db)):
    """
    Fetch lightweight details for a list of video IDs (Title + Transcript).
    Used by Inspectors for Batch Navigation.
    """
    if not request.ids:
        return []
    
    videos = db.query(models.Video).filter(models.Video.id.in_(request.ids)).all()
    
    # Map to simple objects
    results = []
    for vid in videos:
        # Transcript extraction logic (reused from read_videos script mode)
        transcript = vid.description or ""
        if vid.file_path:
             try:
                base, _ = os.path.splitext(vid.file_path)
                found_sub = None
                for ext in ['.ko.vtt', '.en.vtt', '.vtt', '.srt', '.txt']:
                    if os.path.exists(base + ext):
                        found_sub = base + ext
                        break
                if found_sub:
                    with open(found_sub, 'r', encoding='utf-8') as f:
                        transcript = f.read()
             except: pass
             
        results.append({
            "id": vid.id,
            "title": vid.title,
            "transcript": transcript or None, # Explicit null if empty
            "channel_name": vid.channel.name if vid.channel else "Unknown"
        })
        
    return results

# Batch API Models
class BatchVideoOperation(BaseModel):
    video_ids: List[int]
    keep_file: bool = False # [NEW] Soft delete option

# Batch Upload
@router.post("/batch/upload")
def batch_upload_videos(request: BatchVideoOperation, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    """
    Triggers upload for multiple videos in background to avoid timeout.
    Updates status to 'PENDING_UPLOAD' immediately.
    """
    results = []
    for vid in request.video_ids:
        video = crud.get_video(db, vid)
        if not video:
             results.append({"id": vid, "status": "not_found"})
             continue
             
        if video.upload_status in ["COMPLETED", "UPLOADING", "WAITING_FOR_MOBILE"]:
             results.append({"id": vid, "status": "skipped", "reason": video.upload_status})
             continue
             
        # Mark as PENDING
        video.upload_status = "PENDING_UPLOAD"
        db.commit()
        
        # Queue Background Task
        background_tasks.add_task(run_background_upload, vid)
        results.append({"id": vid, "status": "queued"})
        
    return {"results": results}

async def run_background_upload(video_id: int):
    # Stealth Protocol: Phase 3 Wrapper
    from ..services.youtube_uploader import youtube_uploader
    from ..database import SessionLocal
    
    db = SessionLocal()
    try:
        print(f"Background Upload Started for {video_id}...")
        await asyncio.to_thread(youtube_uploader.upload_video, db, video_id)
    except Exception as e:
        print(f"Background Upload Error Wrapper: {e}")
    finally:
        db.close()

# Batch Delete
@router.post("/batch/delete")
def batch_delete_videos(request: BatchVideoOperation, db: Session = Depends(database.get_db)):
    deleted_count = 0
    errors = []
    
    for video_id in request.video_ids:
        video = crud.get_video(db, video_id)
        if not video: continue
            
        # Physical Deep Clean (Only if keep_file is False)
        if not request.keep_file:
            try:
                delete_video_files(video.file_path, video.thumbnail_path)
            except Exception as e:
                errors.append(f"File cleanup failed for video {video_id}: {e}")

        try:
            db.delete(video)
            deleted_count += 1
        except Exception as e:
            errors.append(f"DB delete failed for video {video_id}: {e}")
    
    db.commit()
    
    return {
        "status": "success" if not errors else "partial_success", 
        "deleted_count": deleted_count,
        "errors": errors
    }

# [NEW] Manual HD Download Endpoint
class ManualHDDownloadRequest(BaseModel):
    video_id: int

@router.post("/manual-hd-download")
def manual_hd_download(
    request: ManualHDDownloadRequest,
    db: Session = Depends(database.get_db)
):
    """
    Manual HD download - replaces existing low-quality video with HD version
    Uses high-quality format selector to bypass bot detection
    """
    video = crud.get_video(db, request.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Extract URL from video.url or metadata_json or construct from video_id
    video_url = video.url
    if not video_url and video.metadata_json:
        # Try to get from metadata
        video_url = video.metadata_json.get('webpage_url') or video.metadata_json.get('url')
    if not video_url and video.video_id:
        # Construct YouTube URL from video_id
        video_url = f"https://www.youtube.com/watch?v={video.video_id}"
    
    if not video_url:
        raise HTTPException(status_code=400, detail="Video URL not found in database or metadata")
    
    # Get settings
    settings = crud.get_settings(db)
    if not settings:
        settings = crud.create_settings(db, schemas.SettingsCreate())
    
    # Get channel for path construction
    channel = db.query(models.Channel).filter(models.Channel.id == video.channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Construct proper download path with category/channel structure
    from app.config import settings as settings_conf
    download_root = normalize_path(settings.root_download_path if settings.root_download_path else settings_conf.MEDIA_ROOT)
    
    if channel.category_id:
        category = crud.get_category(db, channel.category_id)
        if category:
            cat_folder = category.folder_name or sanitize_folder_name(category.name)
            download_folder = os.path.join(download_root, cat_folder, channel.folder_name or channel.name)
        else:
            download_folder = os.path.join(download_root, channel.folder_name or channel.name)
    else:
        download_folder = os.path.join(download_root, "_temp_storage", channel.folder_name or channel.name)
    
    os.makedirs(download_folder, exist_ok=True)
    
    print(f"🎬 Starting manual HD download for: {video.title}")
    print(f"📁 Download folder: {download_folder}")
    
    # Delete old file if exists
    if video.file_path and os.path.exists(video.file_path):
        try:
            os.remove(video.file_path)
            print(f"🗑️ Deleted old file: {video.file_path}")
        except Exception as e:
            print(f"Warning: Could not delete old file: {e}")
    
    # Simple direct yt-dlp call
    try:
        import subprocess
        from datetime import datetime
        
        # Sanitize filename
        safe_title = "".join(c for c in video.title if c.isalnum() or c in (' ', '-', '_')).strip()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_template = os.path.join(download_folder, f"{timestamp}_{safe_title}.%(ext)s")
        
        # yt-dlp command
        cmd = [
            'yt-dlp',
            # [FIX] No client restrictions - yt-dlp smart defaults provide full quality access
            '--format', 'bestvideo[height<=1080]+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--output', output_template,
            '--write-thumbnail',
            '--write-sub',
            '--write-auto-sub',
            '--sub-lang', 'en,ko',
            '--convert-subs', 'srt',
            '--embed-subs',
            '--no-playlist',
            video_url
        ]
        
        print(f"Running: {' '.join(cmd)}")
        
        # Run yt-dlp
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=600  # 10 minutes
        )
        
        if result.returncode == 0:
            # Find downloaded file
            import glob
            video_files = glob.glob(os.path.join(download_folder, f"{timestamp}_{safe_title}.*"))
            hd_file = None
            
            for file in video_files:
                if file.endswith(('.mp4', '.mkv', '.webm')):
                    hd_file = file
                    break
            
            if hd_file:
                # Update existing video record with HD file
                video.file_path = hd_file
                video.downloaded_at = datetime.now()
                
                # Mark as HD in metadata
                if video.metadata_json is None:
                    video.metadata_json = {}
                
                # Ensure metadata_json is a dict
                if isinstance(video.metadata_json, str):
                    import json
                    video.metadata_json = json.loads(video.metadata_json)
                
                video.metadata_json['is_hd'] = True
                video.metadata_json['hd_downloaded_at'] = datetime.now().isoformat()
                
                # Force SQLAlchemy to detect the change
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(video, 'metadata_json')
                
                db.commit()
                db.refresh(video)
                
                print(f"✅ HD flag set: {video.metadata_json}")
                
                return {
                    "status": "success",
                    "message": "HD download completed (replaced original)",
                    "file_path": hd_file,
                    "video_id": video.id
                }
            else:
                raise HTTPException(status_code=500, detail="Downloaded file not found")
        else:
            error_msg = result.stderr or result.stdout or "Unknown error"
            print(f"yt-dlp error: {error_msg}")
            raise HTTPException(status_code=400, detail=f"Download failed: {error_msg[:200]}")
            
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Download timeout (10 minutes)")
    except Exception as e:
        print(f"HD download error: {e}")
        raise HTTPException(status_code=500, detail=f"HD download failed: {str(e)}")

class DeleteVideosRequest(BaseModel):
    video_ids: List[int]

@router.post("/delete")
def delete_videos(request: DeleteVideosRequest, db: Session = Depends(database.get_db)):
    # Legacy alias or keep mainly for singular/old calls
    # Reuse batch logic
    return batch_delete_videos(BatchVideoOperation(video_ids=request.video_ids), db)

@router.post("/{video_id}/mark-viewed")
def mark_video_viewed(video_id: int, db: Session = Depends(database.get_db)):
    """Mark a video as viewed (for new video indicator)"""
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video.viewed_at = datetime.now()
    db.commit()
    db.refresh(video)
    
    return {"ok": True, "viewed_at": video.viewed_at}

# [NEW] YouTube Upload Integration
class VideoUploadRequest(BaseModel):
    privacy_status: str = "private" # public, private, unlisted
    made_for_kids: bool = False

@router.post("/{video_id}/upload-to-youtube")
def upload_video_to_youtube(video_id: int, request: VideoUploadRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    """
    Triggers Stealth Upload.
    Now queues background task instead of synchronous wait, to support IP Rotation delays.
    """
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    if video.upload_status in ["COMPLETED", "UPLOADING"]:
         raise HTTPException(status_code=400, detail=f"Video is {video.upload_status}")

    # Mark as Queued
    video.upload_status = "PENDING_UPLOAD"
    db.commit()
    
    background_tasks.add_task(run_background_upload, video_id)
    
    return {"status": "queued", "message": "Upload queued in background (Stealth Mode)"}
    # End of Route (Legacy code removed)



# [NEW] Patch Endpoint for Operations
class VideoUpdate(BaseModel):
    workflow_mode: Optional[str] = None
    upload_status: Optional[str] = None
    priority_level: Optional[int] = None
    metadata_json: Optional[dict] = None

@router.patch("/{video_id}")
def update_video_status(video_id: int, update: VideoUpdate, db: Session = Depends(database.get_db)):
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    if update.workflow_mode is not None:
        video.workflow_mode = update.workflow_mode
    if update.upload_status is not None:
        video.upload_status = update.upload_status
    if update.priority_level is not None:
        video.priority_level = update.priority_level
    if update.metadata_json is not None:
        # Merge or replace. For full project state sync, replacing is more reliable.
        video.metadata_json = update.metadata_json
        
    db.commit()
    db.refresh(video)
    return video

# Subtitle Generation
class GenerateSubtitleRequest(BaseModel):
    language: str = "ko"
    model: str = "base"

@router.post("/{video_id}/generate-subtitle")
def generate_video_subtitle(video_id: int, request: GenerateSubtitleRequest, db: Session = Depends(database.get_db)):
    video = crud.get_video(db, video_id)
    if not video or not video.file_path:
        raise HTTPException(status_code=404, detail="Video or file not found")
    
    if not os.path.exists(video.file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    # Get settings for model path
    settings = crud.get_settings(db)
    model_path = settings.whisper_model_path if settings else None

    try:
        from ..utils.transcriber import get_transcriber
        transcriber = get_transcriber(model_size=request.model, model_path=model_path)
        
        # Explicit output path based on request language
        base = os.path.splitext(video.file_path)[0]
        srt_path = f"{base}.{request.language}.srt"
        
        result = transcriber.transcribe(video.file_path, output_srt_path=srt_path)
        
        if result['status'] == 'success':
            return {"status": "success", "path": result['srt_path'], "language": result['language']}
        else:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {result['message']}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{video_id}/subtitle")
def get_video_subtitle(video_id: int, language: str = "ko", db: Session = Depends(database.get_db)):
    ...  # (Omitted content for brevity in thought, but I will replace exactly what is in the file)

# ... (rest of the file remains, removing the dangling lines at 1282-1285)

@router.get("/{video_id}/subtitle")
def get_video_subtitle(video_id: int, language: str = "ko", db: Session = Depends(database.get_db)):
    """Get the content of the subtitle file for a video."""
    video = crud.get_video(db, video_id)
    if not video or not video.file_path:
        raise HTTPException(status_code=404, detail="Video not found")
        
    # Logic to find subtitle file
    directory = os.path.dirname(video.file_path)
    basename = os.path.splitext(os.path.basename(video.file_path))[0]
    
    # Priority: {basename}.{lang}.srt -> {basename}.srt -> {basename}.{lang}.vtt -> {basename}.vtt
    candidates = [
        f"{basename}.{language}.srt",
        f"{basename}.srt",
        f"{basename}.{language}.vtt",
        f"{basename}.vtt"
    ]
    
    found_path = None
    for c in candidates:
        p = os.path.join(directory, c)
        if os.path.exists(p):
            found_path = p
            break
            
    if not found_path:
        # Try finding ANY srt file in the folder with the same basename start?
        # For now, strict matching is safer.
        raise HTTPException(status_code=404, detail="Subtitle file not found")
        
    try:
        import re
        with open(found_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Clean SRT content if requested or by default
        # Remove timestamps and indices to just get text
        lines = content.splitlines()
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            # Skip empty lines
            if not line: continue
            # Skip numeric indices (e.g. "1")
            if line.isdigit(): continue
            # Skip timestamps (e.g. "00:00:00,000 --> 00:00:02,000")
            if '-->' in line: continue
            
            # Remove bracketed content like [Music], (Applause)
            line = re.sub(r'\[.*?\]', '', line)
            line = re.sub(r'\(.*?\)', '', line)
            
            # Normalize whitespace (fix double spaces)
            line = re.sub(r'\s+', ' ', line).strip()
            
            if not line: continue
            
            if not line: continue
            
            cleaned_lines.append(line)
            
        # Join all lines significantly to handle mid-sentence SRT breaks
        full_text = " ".join(cleaned_lines)
        
        # Normalize whitespace again to be safe
        full_text = re.sub(r'\s+', ' ', full_text).strip()
        
        # Split by sentence: Replace (. ? !) followed by space with Newline
        # Simple regex, might split on "Mr. Smith" but acceptable for now
        formatted_text = re.sub(r'([.?!])\s+', r'\1\n', full_text)
        
        return {"content": formatted_text, "format": "text", "original_format": os.path.splitext(found_path)[1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading subtitle file: {str(e)}")
        
@router.post("/force-stats-update")
def force_stats_update(db: Session = Depends(database.get_db)):
    """Force run the video stats update scheduler."""
    # Lazy import to avoid circular dependency if any (though services usually safe)
    from ..services import scheduler
    try:
        scheduler.update_video_stats(db)
        return {"status": "success", "message": "Stats update triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{video_id}/analysis", response_model=schemas.VideoAnalysis)
def get_video_analysis(video_id: int, db: Session = Depends(database.get_db)):
    # 1. Get Video & Subtitles
    video = crud.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    content = ""
    # reuse subtitle reading logic logic (simplified)
    if video.file_path:
        directory = os.path.dirname(video.file_path)
        video_basename = os.path.splitext(os.path.basename(video.file_path))[0]
        subtitle_path = None
        try:
            candidates = []
            if os.path.exists(directory):
                for f in os.listdir(directory):
                    if f.lower().endswith(('.vtt', '.srt')):
                        if f.lower().startswith(video_basename.lower()) or (video.video_id and video.video_id in f):
                            candidates.append(os.path.join(directory, f))
            if candidates:
                # Same sort key as get_subtitles
                def sort_key(p):
                    base = os.path.basename(p).lower()
                    if '.en.' in base: return (1, len(base))
                    if '.ko.' in base: return (2, len(base))
                    return (100, len(base))
                candidates.sort(key=sort_key)
                subtitle_path = candidates[0]
                
            if subtitle_path and os.path.exists(subtitle_path):
                with open(subtitle_path, "r", encoding="utf-8") as f:
                    raw_content = f.read()
                    # Basic cleaning
                    import re
                    lines = raw_content.splitlines()
                    cleaned = []
                    for line in lines:
                        if not line.strip() or "-->" in line or line.isdigit() or line == "WEBVTT": continue
                        # remove tags
                        line = re.sub(r'<[^>]+>', '', line)
                        cleaned.append(line)
                    content = " ".join(cleaned)
        except:
            pass
            
    # 2. Analyze
    import collections
    
    words = content.split()
    word_count = len(words)
    char_count = len(content)
    
    # Top Keywords
    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "is", "are", "was", "were", "it", "this", "that", "i", "you", "he", "she", "we", "they"}
    filtered_words = [w.lower() for w in words if len(w) > 2 and w.lower() not in stop_words]
    counter = collections.Counter(filtered_words)
    top_keywords = [{"text": k, "value": v} for k, v in counter.most_common(20)]
    
    # Sentiment Heuristic
    # Simple check for positive/negative words
    pos_words = {"good", "great", "excellent", "amazing", "love", "like", "best", "happy", "thanks", "thank", "fun", "cool"}
    neg_words = {"bad", "terrible", "worst", "hate", "sad", "angry", "boring", "awful", "error", "fail", "wrong"}
    
    pos_score = sum(1 for w in filtered_words if w in pos_words)
    neg_score = sum(1 for w in filtered_words if w in neg_words)
    
    total_score = pos_score + neg_score
    if total_score == 0:
        sentiment_label = "Neutral"
        sentiment_score = 0.5
    else:
        ratio = pos_score / total_score
        sentiment_score = ratio
        if ratio > 0.6: sentiment_label = "Positive"
        elif ratio < 0.4: sentiment_label = "Negative"
        else: sentiment_label = "Neutral"

    return {
        "word_count": word_count,
        "char_count": char_count,
        "sentiment_label": sentiment_label,
        "sentiment_score": sentiment_score,
        "top_keywords": top_keywords,
        "engagement_graph": [] # Placeholder
    }

@router.get("/{video_id}/history")
def get_video_history(video_id: int, db: Session = Depends(database.get_db)):
    """
    Get historical metrics for a video.
    """
    history_items = db.query(models.VideoHistory).filter(models.VideoHistory.video_id == video_id).order_by(models.VideoHistory.timestamp.asc()).all()
    
    # If no history, return current state as single point or empty
    if not history_items:
        video = crud.get_video(db, video_id)
        if video:
            return [{
                "timestamp": video.downloaded_at,
                "view_count": video.metadata_json.get("view_count", 0) if video.metadata_json else 0,
                "viral_score": video.viral_score,
                "velocity_score": video.velocity_score
            }]
        return []

    return [{
        "timestamp": item.timestamp,
        "view_count": item.view_count,
        # History table might ideally store viral/velocity snapshots too, but for now we might only have view_count.
        # Check models.VideoHistory definition in fix_db.py. It only has view_count.
        # We can simulate metrics or if the user wants viral history, we need to add those cols to history table.
        # For now, let's just return view_count trends. Use 0 for others or imply them.
        "viral_score": 0, # Placeholder until schema update
        "velocity_score": 0 
    } for item in history_items]
