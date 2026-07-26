import logging
import os
import requests
import json
import time
from typing import Dict, Any, Optional
from app import models
from app.config import settings as app_settings

logger = logging.getLogger(__name__)

class AIVideoService:
    """
    Service for advanced AI video generation:
    - Lip Sync (fal.ai / LatentSync)
    - Image-to-Video (Replicate / CogVideoX)
    """

    def __init__(self, settings: models.Settings):
        self.settings = settings
        # API Keys (Pick the first one from the list)
        self.fal_key = settings.fal_api_keys[0] if settings.fal_api_keys else None
        self.replicate_key = settings.replicate_api_keys[0] if settings.replicate_api_keys else None

    def generate_lipsync(
        self, 
        face_image_url: str, 
        audio_url: str, 
        engine: str = "fal_lipsync"
    ) -> Dict[str, Any]:
        """
        Generates a lip-synced video using fal.ai (LatentSync/Wav2Lip).
        """
        if not self.fal_key:
            return {"status": "error", "message": "FAL_API_KEY not configured"}

        logger.info(f"👄 Starting LipSync ({engine}) | Face: {face_image_url} | Audio: {audio_url}")

        # Endpoint for fal.ai LatentSync
        url = "https://fal.run/fal-ai/sync-lipsync" # Example LatentSync endpoint
        headers = {
            "Authorization": f"Key {self.fal_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "video_url": face_image_url, # image works too
            "audio_url": audio_url
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            
            # fal.ai returns a URL in 'video' or 'url' field usually
            video_url = data.get("video", {}).get("url") or data.get("url")
            
            return {
                "status": "success",
                "video_url": video_url,
                "engine": engine
            }
        except Exception as e:
            logger.error(f"LipSync Failed: {e}")
            return {"status": "error", "message": str(e)}

    def generate_i2v(
        self, 
        image_url: str, 
        prompt: str, 
        engine: str = "cogvideox"
    ) -> Dict[str, Any]:
        """
        Generates video from image (Image-to-Video) using Replicate (CogVideoX).
        """
        if not self.replicate_key:
            return {"status": "error", "message": "REPLICATE_API_TOKEN not configured"}

        logger.info(f"🎬 Starting I2V ({engine}) | Image: {image_url} | Prompt: {prompt}")

        # Replicate CogVideoX-5b-i2v model
        # Full model string: "thudm/cogvideox-5b-i2v:eb20621f37cc22669e46950e181be3ba35f4a6212e3e9d4a3e9d4a3e9d4a3e9d"
        # For simplicity, we use the model name if we use a library, 
        # but here we use direct REST for maximum independence.
        
        url = "https://api.replicate.com/v1/predictions"
        headers = {
            "Authorization": f"Token {self.replicate_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "version": "eb20621f37cc22669e46950e181be3ba35f4a6212e3e9d4a3e9d4a3e9d4a3e9d4a3e9d", # CogVideoX-5b-i2v
            "input": {
                "image": image_url,
                "prompt": prompt,
                "num_frames": 49
            }
        }

        try:
            # 1. Start Prediction
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            resp.raise_for_status()
            prediction = resp.json()
            prediction_id = prediction["id"]
            
            # 2. Poll for Result (Simple Polling)
            status_url = f"{url}/{prediction_id}"
            max_retries = 30
            for i in range(max_retries):
                poll_resp = requests.get(status_url, headers=headers, timeout=10)
                poll_data = poll_resp.json()
                
                status = poll_data.get("status")
                if status == "succeeded":
                    return {
                        "status": "success",
                        "video_url": poll_data["output"][0], # Replicate usually returns list of URLs
                        "engine": engine
                    }
                elif status == "failed":
                    return {"status": "error", "message": "Replicate prediction failed"}
                
                logger.info(f"⌛ I2V Polling ({i+1}/{max_retries}): {status}")
                time.sleep(3)
                
            return {"status": "error", "message": "I2V Timeout"}

        except Exception as e:
            logger.error(f"I2V Failed: {e}")
            return {"status": "error", "message": str(e)}

ai_video_service = None # Dependency injected at runtime usually
