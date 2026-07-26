from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import subprocess
import os
import uuid

from .. import models
from ..database import get_db
from app import dependency_manager

router = APIRouter(tags=["Stations"])

# --- Pydantic Schemas ---
class StationPlaylistBase(BaseModel):
    name: str
    tracks_json: List[dict] # {path, title, duration}

class StationCreate(BaseModel):
    name: str
    rtmp_url: Optional[str] = None
    background_video_path: str = None

class StationUpdate(BaseModel):
    name: Optional[str] = None
    rtmp_url: Optional[str] = None
    background_video_path: Optional[str] = None
    server_mode: Optional[str] = None # [NEW]

class StationResponse(StationCreate):
    id: int
    status: str
    current_playlist_id: Optional[int]
    pid: Optional[int]
    last_error: Optional[str]
    thumbnail_path: Optional[str] # [NEW]
    server_mode: Optional[str] # [NEW]

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.post("/", response_model=StationResponse)
def create_station(station: StationCreate, db: Session = Depends(get_db)):
    db_station = models.Station(
        name=station.name,
        rtmp_url=station.rtmp_url or "", # Use empty string for DB compatibility
        background_video_path=station.background_video_path,
        status=models.StationStatus.OFFLINE
    )
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station

@router.get("/", response_model=List[StationResponse])
def list_stations(db: Session = Depends(get_db)):
    return db.query(models.Station).all()

@router.get("/{station_id}", response_model=StationResponse)
def get_station(station_id: int, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

@router.patch("/{station_id}", response_model=StationResponse)
def update_station(station_id: int, updates: StationUpdate, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    if updates.name is not None:
        station.name = updates.name
    if updates.rtmp_url is not None:
        station.rtmp_url = updates.rtmp_url
    if updates.background_video_path is not None:
        station.background_video_path = updates.background_video_path
    if updates.server_mode is not None:
        station.server_mode = updates.server_mode
        
    db.commit()
    db.refresh(station)
    db.commit()
    db.refresh(station)
    return station

@router.delete("/{station_id}")
def delete_station(station_id: int, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # Optional: Stop if running?
    if station.status != models.StationStatus.OFFLINE:
       try:
           from ..services import station_manager
           station_manager.stop_station(station_id, db)
       except:
           pass

    db.delete(station)
    db.commit()
    return {"message": "Station deleted successfully"}

@router.get("/{station_id}/playlist", response_model=StationPlaylistBase)
def get_station_playlist(station_id: int, db: Session = Depends(get_db)):
    """
    Returns the CURRENTLY active playlist tracks for the station.
    """
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    if not station.current_playlist_id:
        return {"name": "No Playlist", "tracks_json": []}

    playlist = db.query(models.StationPlaylist).filter(models.StationPlaylist.id == station.current_playlist_id).first()
    if not playlist:
        return {"name": "Unknown", "tracks_json": []}

    return {"name": playlist.name, "tracks_json": playlist.tracks_json}

@router.post("/{station_id}/design")
def update_station_design(station_id: int, design: dict, db: Session = Depends(get_db)):
    """
    Updates the design (layout_config) and playlist of the station from Studio State.
    Expects { "scene": {...}, "playlist": [...], "thumbnail_data": "base64..." }
    """
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # 1. Update Layout Config
    # Check if we have multiple scenes
    if "scenes" in design:
        # Store the entire design state including scenes and activeSceneId
        # We also ensure the legacy 'scene' is available if possible, or just store the raw design
        # Ideally, we just store `design` but we might want to sanitize
        station.layout_config = {
            "scenes": design.get("scenes"),
            "activeSceneId": design.get("activeSceneId"),
            # For compatibility, maybe set 'scene' to the active one?
            "scene": design.get("scene", {}) 
        }
    else:
        # Legacy Mode: Store single scene
        station.layout_config = design.get("scene", {})
    
    # 2. Update Thumbnail (if provided)
    thumb_data = design.get("thumbnail_data")
    if thumb_data:
        try:
            import base64
            # thumb_data might be "data:image/png;base64,..."
            if "," in thumb_data:
                thumb_data = thumb_data.split(",")[1]
            
            image_bytes = base64.b64decode(thumb_data)
            
            # Save to assets/station_thumbs/
            thumb_dir = "frontend/public/assets/station_thumbs"
            os.makedirs(thumb_dir, exist_ok=True)
            
            filename = f"station_{station_id}_{int(datetime.now().timestamp())}.png"
            path = os.path.join(thumb_dir, filename)
            
            with open(path, "wb") as f:
                f.write(image_bytes)
                
            # Public URL path
            station.thumbnail_path = f"/assets/station_thumbs/{filename}"
        except Exception as e:
            print(f"Failed to save thumbnail: {e}")

    # 3. Update Background Video if present in scene
    # This is important for the headless streamer (logic in start_station uses this)
    # Find first video layer or background prop
    bg_video = None
    
    # Search in scenes if multi-scene
    scenes_to_check = design.get("scenes", [])
    if not scenes_to_check:
        scenes_to_check = [design.get("scene", {})]

    # Check active scene only or first scene? 
    # Usually we want the background of the *active* scene or just any valid background
    # Let's check first scene that has one
    for scene in scenes_to_check:
        if scene.get("backgroundVideo"):
             bg_video = scene.get("backgroundVideo")
             break
        
        layers = scene.get("layers", [])
        for layer in layers:
            if layer.get("type") == "video" or layer.get("type") == "image":
                 # Use the first media layer as background
                 src = layer.get("src") or layer.get("filePath")
                 if src:
                     bg_video = src
                     break
        if bg_video: break
    
    if bg_video:
        if bg_video.startswith("file:///"):
            bg_video = bg_video[8:]
        station.background_video_path = bg_video

    # 4. Update Playlist (if provided)
    raw_playlist = design.get("playlist", [])
    if raw_playlist:
        # Convert Studio Track format to StationPlaylist format
        tracks_json = []
        for track in raw_playlist:
            path = track.get("file_path") or track.get("filePath") or track.get("src")
            if path and path.startswith("file:///"):
                 path = path[8:]
            
            tracks_json.append({
                "path": path,
                "title": track.get("title", "Unknown"),
                "duration": track.get("duration", 0),
                "weight": 1
            })
            
        # Create or Update Playlist attached to station?
        # Let's create a new one to track versions, or update existing if simple.
        # Strategy: Create new linked playlist
        new_playlist = models.StationPlaylist(
            station_id=station.id,
            name=f"Design Import {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            tracks_json=tracks_json
        )
        db.add(new_playlist)
        db.commit()
        db.refresh(new_playlist)
        station.current_playlist_id = new_playlist.id

    db.commit()
    return {"message": "Design updated", "layout_config": station.layout_config}

@router.get("/{station_id}/design")
def get_station_design(station_id: int, db: Session = Depends(get_db)):
    """Retrieve the full design state to reload into Studio"""
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
        
    config = station.layout_config or {}
    
    # Check if modern format
    if "scenes" in config:
        return config
    
    # Legacy Format Reconstruct
    scene = config
    
    # Reconstruct Playlist
    playlist = []
    if station.current_playlist_id:
        sp = db.query(models.StationPlaylist).filter(models.StationPlaylist.id == station.current_playlist_id).first()
        if sp and sp.tracks_json:
            for t in sp.tracks_json:
                playlist.append({
                    "id": str(uuid.uuid4()), # Generate temp ID for Studio
                    "title": t.get("title"),
                    "file_path": t.get("path"),
                    "duration": t.get("duration"),
                    "artist": "Unknown" # Optional
                })

    return {
        "scene": scene,
        "playlist": playlist
    }
