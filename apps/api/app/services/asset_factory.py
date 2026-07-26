import logging
import os
import uuid
import requests
import asyncio
from pathlib import Path
from typing import List, Dict
from app.services.media_processor import media_processor
from app.database import SessionLocal
from app import crud
from app.config import settings as app_settings
# [NEW] Import VideoGenClient for production assets
from ..video_engine import VideoGenClient

logger = logging.getLogger(__name__)

class AssetFactory:
    def __init__(self):
        # [FIX] Cross-platform temp directory
        self.root_dir = Path(app_settings.TEMP_DIR)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir = self.root_dir / "standardized"
        self.processed_dir.mkdir(exist_ok=True)

    def _enhance_prompt(self, asset_type: str, prompt: str) -> str:
        """
        Appends quality suffixes based on asset type.
        """
        if asset_type == 'image':
            suffix = ", masterpiece, best quality, cinematic lighting, 8k, highly detailed"
            if suffix.lower() not in prompt.lower():
                return f"{prompt.rstrip(',')}{suffix}"
        elif asset_type in ['video', 'ai-video']:
            suffix = ", cinematic video, high dynamic range, smooth motion, 4k"
            if suffix.lower() not in prompt.lower():
                return f"{prompt.rstrip(',')}{suffix}"
        return prompt

    async def download_asset(self, url: str) -> str:
        """
        Downloads an asset to the local scratch disk.
        """
        try:
            filename = f"raw_{uuid.uuid4()}_{os.path.basename(url.split('?')[0])}"
            if not filename.endswith(('.mp4', '.wav', '.mp3', '.png', '.jpg')):
                # Fallback extension if missing
                filename += ".bin"
            
            dest_path = self.root_dir / filename
            
            logger.info(f"Downloading asset from {url} to {dest_path}")
            
            # Use threading for synchronous requests to avoid blocking event loop
            def fetch():
                with requests.get(url, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    with open(dest_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                return str(dest_path)

            return await asyncio.to_thread(fetch)
        except Exception as e:
            logger.error(f"Download failed for {url}: {e}")
            raise e

    async def prepare_assets(self, urls: List[str]) -> List[str]:
        """
        Full Pipeline: [Download -> Standardize -> Return Paths]
        """
        local_paths = []
        for url in urls:
            try:
                # 1. Download
                local_raw = await self.download_asset(url)
                
                # 2. Standardize (FFmpeg)
                # Note: MediaProcessor.process currently uses -16 LUFS. 
                # We'll call it for now, or implement custom params.
                ext = local_raw.split('.')[-1].lower()
                if ext in ['mp4', 'mov', 'avi', 'mkv', 'wav', 'mp3']:
                    logger.info(f"Standardizing media: {local_raw}")
                    # We pass 'normalize' task which triggers loudnorm
                    standardized = media_processor.process(local_raw, ["normalize"])
                    local_paths.append(standardized)
                else:
                    # Images or unsupported formats stay raw for now
                    local_paths.append(local_raw)
                    
            except Exception as e:
                logger.error(f"Failed to prepare asset {url}: {e}")
                # We keep going if one fails, or should we abort?
        
        return local_paths

    async def generate_colab_asset(self, asset_type: str, prompt: str, config: Dict = None) -> Dict:
        """
        Proxy to Distributed Colab Grid (Audio Node vs Visual Node).
        """
        # Node Configuration (Fetch from DB for dynamism)
        db = SessionLocal()
        try:
            settings = crud.get_settings(db)
            AUDIO_NODE_URL = settings.audio_node_url or "https://miscultivated-nonvertically-londa.ngrok-free.dev"
            VISUAL_NODE_URL = settings.visual_node_url or "https://unstalled-eustyle-chet.ngrok-free.dev"
            AUDIO_NODE_KEY = settings.audio_node_api_key
            VISUAL_NODE_KEY = settings.visual_node_api_key
        finally:
            db.close()
        
        config = config or {}
        enhanced_prompt = self._enhance_prompt(asset_type, prompt)
        
        if asset_type == 'audio' or asset_type == 'tts':
            endpoint = f"{AUDIO_NODE_URL}/generate/tts"
            headers = {"X-API-Key": AUDIO_NODE_KEY} if AUDIO_NODE_KEY else {}
            payload = {
                "text": prompt, # TTS text shouldn't be "enhanced" with image keywords
                "voice": config.get("voice", "sohee"),
                "age": config.get("age", "default"),
                "emotion": config.get("emotion", "neutral"),
                "speed": config.get("speed", "normal"),
                "language": config.get("language", "auto"),
                "dialect": config.get("dialect", "standard"), # New Dialect Support
                "manual_instruction": config.get("manual_instruction", "")
            }
        elif asset_type == 'image':
            endpoint = f"{VISUAL_NODE_URL}/generate/image"
            headers = {"X-API-Key": VISUAL_NODE_KEY} if VISUAL_NODE_KEY else {}
            payload = {"prompt": enhanced_prompt}
        elif asset_type == 'video' or asset_type == 'ai-video':
            # [UPGRADE] Bypassing flaky Colab, use Production VideoGenClient (Kling-v1, etc.)
            logger.info(f"🚀 [AssetFactory] Redirecting {asset_type} to VideoGenClient Production API...")
            
            try:
                # 1. Initialize Engine
                from app.schemas import Settings
                engine = VideoGenClient(settings) # 'settings' variable is already fetched from DB above
                
                # 2. Call Production API (Kling-v1 default)
                # Note: VideoGenClient.generate_video (HiggsfieldService) already polls and returns local path
                model = config.get("model", "kling-v1")
                aspect_ratio = config.get("aspect_ratio", "9:16")
                
                # We need to run it in a thread if it wasn't async, but VideoGenClient is async
                local_video_path = await engine.generate_video(prompt, model=model, aspect_ratio=aspect_ratio)
                
                logger.info(f"✅ [AssetFactory] Production Video Generated: {local_video_path}")
                
                # Return standardized result
                return {"status": "success", "file_path": local_video_path}
                
            except Exception as e:
                logger.error(f"❌ [AssetFactory] Production Video Gen Failed: {e}")
                # Fallback to Colab logic only if absolutely necessary, but here we've decided to abandon Colab for videos
                raise e
        else:
            raise ValueError(f"Unknown asset type: {asset_type}")
        
        try:
            def call_api():
                # Colab servers use Form data for these specific endpoints
                resp = requests.post(endpoint, data=payload, headers=headers, timeout=180) # Increased timeout for video
                resp.raise_for_status()
                
                # These endpoints return FileResponse (Binary). We need to save it.
                filename = f"gen_{asset_type}_{uuid.uuid4()}"
                ext = ".wav" if asset_type in ['audio', 'tts'] else (".mp4" if asset_type in ['video', 'ai-video'] else ".png")
                dest_path = self.root_dir / (filename + ext)
                
                with open(dest_path, 'wb') as f:
                    f.write(resp.content)
                return str(dest_path)

            local_path = await asyncio.to_thread(call_api)
            
            # Standardization (FFmpeg)
            if asset_type in ['audio', 'tts', 'video', 'ai-video']:
                standardized = media_processor.process(local_path, ["normalize"])
                return {"status": "success", "file_path": standardized, "raw_path": local_path}
            
            return {"status": "success", "file_path": local_path}
            
        except Exception as e:
            logger.error(f"Colab Generation Failed ({asset_type}): {e}")
            if asset_type == 'image':
                from app.services.image_gen_service import image_gen_service
                path = await image_gen_service.generate_image(prompt)
                return {"status": "success", "file_path": path}
            raise e

asset_factory = AssetFactory()
