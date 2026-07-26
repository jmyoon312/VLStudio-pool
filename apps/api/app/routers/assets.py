from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, database, models, schemas
import os
import glob
from typing import List, Optional
import pydantic
import requests
import uuid
import shutil
import datetime
from sqlalchemy.orm import Session
from .. import crud, database, models, schemas

router = APIRouter(tags=["assets"])

# Response Models
class VideoAsset(pydantic.BaseModel):
    id: int
    title: str
    video_id: str
    thumbnail_url: Optional[str] = None
    file_path: Optional[str] = None
    duration: Optional[int] = 0

class ScriptAsset(pydantic.BaseModel):
    filename: str
    path: str
    preview: str
    size: int

def get_web_url_helper(request, path):
    # Simple helper to convert local path to web static URL if needed
    # Assuming standard static mount
    if not path: return ""
    filename = os.path.basename(path)
    # return f"{request.base_url}static/{filename}" # Simplified
    # For thumbnails, usually they are external URLs or local paths served statically
    return path 

@router.get("/videos", response_model=List[VideoAsset])
def get_videos(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    """
    Fetch downloaded videos from the database.
    """
    videos = db.query(models.Video).filter(models.Video.status == "completed").offset(skip).limit(limit).all()
    
    results = []
    for v in videos:
        # Resolve Thumbnail URL
        # If thumbnail_path starts with http, use it.
        # If local, we might need to serve it.
        thumb = v.thumbnail_path
        
        results.append(VideoAsset(
            id=v.id,
            title=v.title or "Untitled",
            video_id=v.video_id,
            thumbnail_url=thumb,
            file_path=v.file_path,
            duration=v.duration
        ))
    return results

@router.get("/scripts", response_model=List[ScriptAsset])
def get_scripts():
    """
    Scan the persistent 'scripts_library' directory for .txt, .srt, .ass files.
    """
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    scripts_dir = os.path.join(backend_root, "scripts_library")
    
    if not os.path.exists(scripts_dir):
        os.makedirs(scripts_dir)
        # Create a sample file
        with open(os.path.join(scripts_dir, "sample_script.txt"), "w", encoding="utf-8") as f:
            f.write("This is a sample script for the ViraLoop Engine.")

    files = []
    # extensions = ['*.txt', '*.srt', '*.ass', '*.vtt']
    # glob doesn't support multiple exts in older python, iterating manually
    
    for ext in ['txt', 'srt', 'ass', 'vtt']:
        for file_path in glob.glob(os.path.join(scripts_dir, f"*.{ext}")):
            filename = os.path.basename(file_path)
            size = os.path.getsize(file_path)
            
            # Read preview (first 100 chars)
            preview = ""
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    preview = f.read(100).replace("\n", " ") + "..."
            except:
                preview = "Unreadable"
                
            files.append(ScriptAsset(
                filename=filename,
                path=file_path,
                preview=preview,
                size=size
            ))
            
    return files
    return files

@router.post("/query", response_model=List[VideoAsset])
def query_assets(query: schemas.AssetQuery, db: Session = Depends(database.get_db)):
    """
    Dynamic Asset Query.
    Finds videos matching criteria: Channel, Keywords, Date, Limit.
    """
    q = db.query(models.Video).filter(models.Video.status == "completed")
    
    # 1. Channel Filter
    if query.source_channel_id:
        q = q.filter(models.Video.channel_id == query.source_channel_id)
        
    # 2. Time Range
    if query.time_range_hours:
        import datetime
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=query.time_range_hours)
        q = q.filter(models.Video.upload_date >= cutoff)
        
    # 3. Keywords (Naive LIKE search)
    if query.keywords:
        for k in query.keywords:
            # Check title or video_id
            # q = q.filter(models.Video.title.ilike(f"%{k}%")) # Assuming Postgres ILIKE or SQLite LIKE
            q = q.filter(models.Video.title.contains(k)) 
            
    # 4. Sorting
    if query.sort_by == "viral_score":
        q = q.order_by(models.Video.viral_score.desc())
    else:
        q = q.order_by(models.Video.upload_date.desc())
        
    videos = q.limit(query.limit).all()
    
    results = []
    for v in videos:
        thumb = v.thumbnail_path
        results.append(VideoAsset(
            id=v.id,
            title=v.title or "Untitled",
            video_id=v.video_id,
            thumbnail_url=thumb,
            file_path=v.file_path,
            duration=v.duration
        ))
    return results

class StockAsset(pydantic.BaseModel):
    id: str
    url: str
    thumbnail: str
    type: str # video/image
    source: str

class AssetImportRequest(pydantic.BaseModel):
    url: str
    title: str

@router.post("/import-url")
def import_asset_from_url(payload: AssetImportRequest, db: Session = Depends(database.get_db)):
    """
    Downloads an image/video from a URL and saves it as an Asset.
    Useful for saving Research Tool results.
    """
    try:
        # 1. Setup Storage
        upload_dir = "media/uploads"
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
            
        # 2. Generate Filename
        ext = payload.url.split('?')[0].split('.')[-1]
        if len(ext) > 4 or not ext:
            ext = "jpg" # Default to jpg if extension is weird
            
        filename = f"{uuid.uuid4()}.{ext}"
        local_path = os.path.join(upload_dir, filename)
        abs_path = os.path.abspath(local_path)
        
        # 3. Download
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        r = requests.get(payload.url, stream=True, headers=headers, timeout=10, proxies={'http': 'socks5://127.0.0.1:10800', 'https': 'socks5://127.0.0.1:10800'})
        r.raise_for_status()
        
        with open(abs_path, 'wb') as f:
            r.raw.decode_content = True
            shutil.copyfileobj(r.raw, f)
            
        # 4. Create DB Entry
        # We assume it's an "Image" but Video table handles assets.
        # We might need to differentiate type, but for now we put it in Video table.
        # is_script_only=False.
        
        new_asset = models.Video(
            video_id=f"asset_{uuid.uuid4().hex[:8]}", # Unique ID
            title=payload.title,
            url=payload.url,
            file_path=abs_path,
            thumbnail_path=abs_path, # For images, file IS thumbnail
            upload_date=datetime.datetime.utcnow(),
            status="completed",
            duration=0, # Image
            description="Imported from Web Search",
            channel_id=None # No specific channel
        )
        
        db.add(new_asset)
        db.commit()
        db.refresh(new_asset)
        
        return {
            "id": new_asset.id,
            "title": new_asset.title,
            "file_path": new_asset.file_path,
            "message": "Asset imported successfully"
        }
        
    except Exception as e:
        print(f"Import Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stock/{media_type}")
def search_stock_assets(media_type: str, keyword: Optional[str] = ""):
    """
    Search for stock assets (Pexels Integration).
    Currently returns MOCK data for demonstration.
    """
    # Real implementation would call Pexels/Pixabay API here.
    # API_KEY = os.getenv("PEXELS_API_KEY")
    
    # Mock Response
    mock_data = []
    
    if media_type == "video":
        mock_data = [
            {
                "id": "mock_v_1",
                "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "thumbnail": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
                "type": "video",
                "source": "MockPexels"
            },
            {
                "id": "mock_v_2",
                "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                "thumbnail": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
                "type": "video",
                "source": "MockPixabay"
            }
        ]
    else:
        mock_data = [
             {
                "id": "mock_i_1",
                "url": "https://via.placeholder.com/1080x1920.png?text=Stock+Image+1",
                "thumbnail": "https://via.placeholder.com/300x169.png?text=Preview+1",
                "type": "image",
                "source": "MockUnsplash"
            }
        ]
        
    return {"results": [StockAsset(**item) for item in mock_data]}
