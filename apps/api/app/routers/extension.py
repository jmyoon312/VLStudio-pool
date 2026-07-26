from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import shutil
import os
from datetime import datetime
from .. import crud, schemas, database, models

router = APIRouter(tags=["videos"])

@router.post("/extension-upload")
async def extension_upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    url: str = Form(None),
    source: str = Form("extension"),
    db: Session = Depends(database.get_db)
):
    """
    Receive video from browser extension
    Automatically creates channel and video records
    """
    try:
        # Get settings
        settings = crud.get_settings(db)
        if not settings:
            settings = crud.create_settings(db, schemas.SettingsCreate())
        
        from app.config import settings as settings_conf
        download_root = settings.root_download_path if settings.root_download_path else settings_conf.MEDIA_ROOT
        
        # Create extension downloads directory
        extension_dir = os.path.join(download_root, "_extension_downloads")
        os.makedirs(extension_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(extension_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create or find "Browser Extension" channel
        channel_name = "Browser Extension Downloads"
        channel = db.query(models.Channel).filter(models.Channel.name == channel_name).first()
        
        if not channel:
            channel = models.Channel(
                name=channel_name,
                url="extension://downloads",
                platform="extension",
                folder_name="_extension_downloads",
                status="active",
                subscriber_count=0
            )
            db.add(channel)
            db.commit()
            db.refresh(channel)
        
        # Extract video ID from URL if provided
        video_id = None
        if url and "youtube.com/watch?v=" in url:
            video_id = url.split("watch?v=")[1].split("&")[0]
        
        if not video_id:
            video_id = f"ext_{int(datetime.now().timestamp())}"
        
        # Create video record
        video = models.Video(
            channel_id=channel.id,
            video_id=video_id,
            title=title,
            url=url,
            file_path=file_path,
            upload_date=datetime.now(),
            downloaded_at=datetime.now(),
            status="completed",
            view_count=0,
            duration=0,
            metadata_json={
                "source": source,
                "original_filename": file.filename,
                "extension_download": True
            }
        )
        
        db.add(video)
        db.commit()
        db.refresh(video)
        
        return {
            "status": "success",
            "message": "Video uploaded successfully",
            "video_id": video.id,
            "file_path": file_path
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
