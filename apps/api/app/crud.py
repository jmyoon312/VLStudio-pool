from sqlalchemy.orm import Session
from . import models, schemas
import os
from datetime import datetime
import re

# --- Settings ---
def get_settings(db: Session):
    settings = db.query(models.Settings).first()
    if not settings:
        from app.config import settings as settings_conf
        # Create default settings if not exists
        settings = models.Settings(
            root_download_path="",
            cookies_path=None,
            default_tts_engine="google",
            
            # [FIX] Use new plural fields with empty lists
            gemini_api_keys=[],
            elevenlabs_api_keys=[],
            typecast_api_keys=[],
            groq_api_keys=[],
            nvidia_api_keys=[],
            supertone_project_key=None,
            
            kokoro_tts_url="https://tts1.gogloo.gleeze.com",
            
            global_auto_download=True,
            scan_interval_minutes=60,
            ytdlp_auto_update=True,
            
            default_model_size="base",
            default_language="ko",
            whisper_model_path=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models--Systran--faster-whisper-base")) if os.path.exists(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models--Systran--faster-whisper-base"))) else os.path.join(os.path.expanduser("~"), ".cache", "faster_whisper"),
            
            # Distributed AI Grid Defaults
            audio_node_url="https://miscultivated-nonvertically-londa.ngrok-free.dev",
            audio_node_api_key=None,
            visual_node_url="https://unstalled-eustyle-chet.ngrok-free.dev",
            visual_node_api_key=None,
            
            # [NEW] Phase 1 Defaults
            pexels_api_keys=[],
            pixabay_api_keys=[],
            fal_api_keys=[],
            replicate_api_keys=[],
            muapi_api_keys=[],
            n8n_base_url="http://localhost:5678",

            # [Phase 5: Sovereign Hermes Intelligence]
            hermes_agent_provider="google",
            hermes_agent_model="gemini-2.5-pro",
            hermes_wisdom_depth=3,
            hermes_reflection_verbosity="balanced",
            hermes_auto_reflection=True,
            hermes_auto_update_enabled=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def create_settings(db: Session, settings: schemas.SettingsCreate):
    # Convert Pydantic model to DB model
    # Ensure lists are passed correctly
    db_settings = models.Settings(**settings.dict())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def update_settings(db: Session, settings: schemas.SettingsCreate):
    db_settings = db.query(models.Settings).first()
    if db_settings:
        update_data = settings.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_settings, key, value)
        db.commit()
        db.refresh(db_settings)
    return db_settings

# --- Channels ---
def get_channels(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Channel).offset(skip).limit(limit).all()

def create_channel(db: Session, channel: schemas.ChannelCreate):
    db_channel = models.Channel(**channel.dict())
    db.add(db_channel)
    db.commit()
    db.refresh(db_channel)
    return db_channel

def get_channel(db: Session, channel_id: int):
    return db.query(models.Channel).filter(models.Channel.id == channel_id).first()

def delete_channel(db: Session, channel_id: int):
    db_channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if db_channel:
        db.delete(db_channel)
        db.commit()
    return db_channel

def update_channel_status(db: Session, channel_id: int, status: str):
    db_channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if db_channel:
        db_channel.status = status
        db.commit()
        db.refresh(db_channel)
    return db_channel

def update_channel(db: Session, channel_id: int, channel_update: schemas.ChannelUpdate):
    db_channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not db_channel:
        return None
    
    update_data = channel_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_channel, key, value)
    
    db.commit()
    db.refresh(db_channel)
    return db_channel

def get_channel_by_url(db: Session, url: str):
    return db.query(models.Channel).filter(models.Channel.url == url).first()

def get_active_channels(db: Session):
    return db.query(models.Channel).filter(models.Channel.status == "active").all()

# --- Videos ---
def get_videos(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    channel_id: int = None,
    category_id: int = None, # [NEW]
    folder: str = None, # [NEW] Strict Folder Filter
    search_query: str = None,
    mode: str = "video", # 'video' or 'script'
    upload_status: str = None, 
    exclude_used: bool = False,
    is_script_only: bool = None, # [FIX] Add explicit filter parameter
    sort_by: str = "upload_date",
    sort_order: str = "desc"
):
    from sqlalchemy import or_

    query = db.query(models.Video)

    # [FIX] Mode-based filtering
    # Strict separation to prevent overlap
    if mode == "video":
        # Videos: Must NOT be script-only
        if is_script_only is not None:
            query = query.filter(models.Video.is_script_only == is_script_only)
        else:
            query = query.filter(models.Video.is_script_only == False)
    elif mode == "script":
        # Subtitles/Scripts: Must be script-only items
        if is_script_only is not None:
            query = query.filter(models.Video.is_script_only == is_script_only)
        else:
            query = query.filter(models.Video.is_script_only == True)
        
    if channel_id:
        query = query.filter(models.Video.channel_id == channel_id)

    if folder: # [NEW] Strict Folder Filter
        # Normalize folder separator to match DB content (usually depends on OS, but contains works)
        # We assume file_path contains the folder name segment
        query = query.filter(models.Video.file_path.contains(folder))

    if category_id: # [NEW]
        query = query.join(models.Channel).filter(models.Channel.category_id == category_id)
        
    if search_query:
        query = query.filter(models.Video.title.contains(search_query))

    if upload_status: 
        query = query.filter(models.Video.upload_status == upload_status)
        
    if exclude_used:
        query = query.filter(
            models.Video.upload_status == None,
            models.Video.script_analysis == None
        )

    # Sorting
    if sort_by == "priority":
        # [NEW] Smart Sort: Priority DESC, then Upload Date DESC
        if sort_order == "asc":
            query = query.order_by(models.Video.priority_level.asc(), models.Video.upload_date.asc())
        else:
            query = query.order_by(models.Video.priority_level.desc(), models.Video.upload_date.desc())
    elif sort_by == "view_count":
        # Sort by view count from metadata (requires JSON extraction or if we had a column)
        # We don't have a view_count column, it's in metadata_json.
        # SQLite doesn't easily sort by JSON field without extraction function.
        # Fallback to upload_date if complex.
        # Ideally we should add view_count column if sorting is critical.
        # For now, let's sort by upload_date as default for stability.
        order_col = models.Video.upload_date
        # Use single column sort logic below
        if sort_order == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())
            
    elif sort_by == "created_at":
        order_col = models.Video.id # Proxy for creation time
        if sort_order == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())
            
    else:
        # Default: upload_date
        order_col = models.Video.upload_date
        if sort_order == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())

    return query.offset(skip).limit(limit).all()

def create_video(db: Session, video: schemas.VideoCreate):
    db_video = models.Video(**video.dict())
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video

def get_video(db: Session, video_id: int):
    return db.query(models.Video).filter(models.Video.id == video_id).first()

def get_video_by_platform_id(db: Session, video_id: str):
    return db.query(models.Video).filter(models.Video.video_id == video_id).first()

def get_recent_videos_only(db: Session, limit: int = 10):
    from sqlalchemy.orm import joinedload
    return db.query(models.Video)\
        .options(joinedload(models.Video.channel))\
        .filter(models.Video.is_script_only == False)\
        .filter(models.Video.channel_id.isnot(None))\
        .order_by(models.Video.downloaded_at.desc())\
        .limit(limit)\
        .all()

def get_recent_scripts(db: Session, limit: int = 10):
    from sqlalchemy.orm import joinedload
    return db.query(models.Video)\
        .options(joinedload(models.Video.channel))\
        .filter(models.Video.is_script_only == True)\
        .filter(models.Video.channel_id.isnot(None))\
        .order_by(models.Video.downloaded_at.desc())\
        .limit(limit)\
        .all()


# --- Custom Links ---
def get_custom_links(db: Session):
    return db.query(models.CustomLink).order_by(models.CustomLink.order_index).all()

def create_custom_link(db: Session, link: schemas.CustomLinkCreate):
    # Auto-assign order_index
    max_order = db.query(models.CustomLink).order_by(models.CustomLink.order_index.desc()).first()
    new_order = (max_order.order_index + 1) if max_order else 0
    
    db_link = models.CustomLink(**link.dict())
    db_link.order_index = new_order
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link

def update_custom_link(db: Session, link_id: int, link_update: schemas.CustomLinkUpdate):
    db_link = db.query(models.CustomLink).filter(models.CustomLink.id == link_id).first()
    if not db_link:
        return None
    
    update_data = link_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_link, key, value)
    
    db.commit()
    db.refresh(db_link)
    return db_link

def delete_custom_link(db: Session, link_id: int):
    db_link = db.query(models.CustomLink).filter(models.CustomLink.id == link_id).first()
    if db_link:
        db.delete(db_link)
        db.commit()
    return db_link

def reorder_custom_links(db: Session, ordered_ids: list[int]):
    for index, link_id in enumerate(ordered_ids):
        db_link = db.query(models.CustomLink).filter(models.CustomLink.id == link_id).first()
        if db_link:
            db_link.order_index = index
    db.commit()
    return True

# --- Script Styles ---
def get_script_styles(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ScriptStyle).offset(skip).limit(limit).all()

def get_script_style(db: Session, style_id: int):
    return db.query(models.ScriptStyle).filter(models.ScriptStyle.id == style_id).first()

def create_script_style(db: Session, style: schemas.ScriptStyleCreate):
    db_style = models.ScriptStyle(**style.dict())
    db.add(db_style)
    db.commit()
    db.refresh(db_style)
    return db_style

def update_script_style(db: Session, style_id: int, style_update: schemas.ScriptStyleUpdate):
    db_style = get_script_style(db, style_id)
    if not db_style:
        return None
    update_data = style_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_style, key, value)
    db.commit()
    db.refresh(db_style)
    return db_style

def delete_script_style(db: Session, style_id: int):
    db_style = get_script_style(db, style_id)
    if db_style:
        db.delete(db_style)
        db.commit()
    return db_style

# --- Style Presets ---
def get_style_presets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.StylePreset).offset(skip).limit(limit).all()

def get_style_preset(db: Session, preset_id: int):
    return db.query(models.StylePreset).filter(models.StylePreset.id == preset_id).first()

def create_style_preset(db: Session, preset: schemas.StylePresetCreate):
    db_preset = models.StylePreset(**preset.dict())
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset

def update_style_preset(db: Session, preset_id: int, preset_update: schemas.StylePresetUpdate):
    db_preset = get_style_preset(db, preset_id)
    if not db_preset:
        return None
    update_data = preset_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_preset, key, value)
    db.commit()
    db.refresh(db_preset)
    return db_preset

    return db_preset

def delete_style_preset(db: Session, preset_id: int):
    db_preset = get_style_preset(db, preset_id)
    if db_preset:
        db.delete(db_preset)
        db.commit()
    return db_preset

# --- Daily Reports ---
def get_daily_reports(db: Session, skip: int = 0, limit: int = 30):
    return db.query(models.DailyReport).order_by(models.DailyReport.report_date.desc()).offset(skip).limit(limit).all()

def get_latest_daily_report(db: Session):
    return db.query(models.DailyReport).order_by(models.DailyReport.report_date.desc()).first()

def create_daily_report(db: Session, report_data: dict):
    db_report = models.DailyReport(**report_data)
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def delete_daily_reports(db: Session, ids: list[int]):
    stmt = db.query(models.DailyReport).filter(models.DailyReport.id.in_(ids))
    count = stmt.delete(synchronize_session=False)
    db.commit()
    return count

def mark_report_read(db: Session, report_id: int):
    report = db.query(models.DailyReport).filter(models.DailyReport.id == report_id).first()
    if report:
        report.is_read = True
        db.commit()
        db.refresh(report)
    return report

def get_daily_report(db: Session, report_id: int):
    return db.query(models.DailyReport).filter(models.DailyReport.id == report_id).first()
