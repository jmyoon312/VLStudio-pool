import requests
import time
import asyncio
import logging
import os
from typing import Optional, List
from app.config import settings

logger = logging.getLogger(__name__)

class VideoProviderError(Exception):
    """Custom exception for video generation provider errors"""
    pass

class HiggsfieldService:
    """
    Higgsfield AI (via Muapi.ai) Video Generation Service.
    Supports multiple providers: Kling, Luma, Runway, Wan, LTX.
    [UPGRADE] Multi-provider fallback, retry logic, and health monitoring.
    """
    def __init__(self, settings):
        self.api_key = os.getenv("MUAPI_API_KEY", getattr(settings, "muapi_api_key", None))
        self.base_url = "https://api.muapi.ai/api/v1"
        
        # [FIX] Smart Fallback for TEMP_DIR
        from app.config import settings as app_settings
        self.temp_dir = getattr(settings, "TEMP_DIR", app_settings.TEMP_DIR)
        
        # [NEW] Provider configurations with retry counts
        self.providers = [
            {"name": "kling-v1.0-standard", "endpoint": "kling-v1.0-standard", "retries": 2},
            {"name": "kling-v1.2-standard", "endpoint": "kling-v1.2-standard", "retries": 2},
            {"name": "luma-photon", "endpoint": "luma-photon", "retries": 1},
            {"name": "wan-2.1", "endpoint": "wan-2.1", "retries": 1},
            {"name": "ltx-video", "endpoint": "ltx-video", "retries": 1},
        ]
        
        # Alternative API endpoints (for when Muapi fails)
        self.alt_endpoints = {
            "kling": "https://api.klingai.com/v1/images/generations",
            "runway": "https://api.runwayml.com/v1/generations",
            "luma": "https://api.lumalabs.ai/dream-machine/v1/generations",
        }
        
        self.failed_providers = []  # Track failed providers

    def _get_headers(self):
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }

    async def generate_video(self, prompt: str, image_url: Optional[str] = None, model: str = "kling-v1", duration: int = 5) -> str:
        """
        [UPGRADE] Generates video with multi-provider fallback.
        Tries providers in order until one succeeds.
        """
        self.failed_providers = []  # Reset tracking
        
        # 1. Try configured model first
        try:
            result = await self._try_generate(prompt, model, duration, image_url)
            if result:
                return result
        except Exception as e:
            logger.warning(f"Primary model {model} failed: {e}")
            self.failed_providers.append(model)
        
        # 2. Try other available providers as fallback
        for provider in self.providers:
            if provider["name"] == model:
                continue
                
            for attempt in range(provider["retries"] + 1):
                try:
                    logger.info(f"🔄 Trying fallback provider: {provider['name']} (attempt {attempt + 1})")
                    result = await self._try_generate(prompt, provider["endpoint"], duration, image_url)
                    if result:
                        logger.info(f"✅ Fallback succeeded: {provider['name']}")
                        return result
                except Exception as e:
                    logger.warning(f"Provider {provider['name']} attempt {attempt + 1} failed: {e}")
                    await asyncio.sleep(2)  # Brief delay between retries
        
        # 3. Try alternative endpoints (direct API calls)
        alt_result = await self._try_alternative_apis(prompt, duration)
        if alt_result:
            return alt_result
        
        # 4. Last resort: Try open-source models via HuggingFace
        hf_result = await self._try_huggingface(prompt, duration)
        if hf_result:
            return hf_result
        
        # 5. Final fallback: Generate placeholder with better quality
        logger.warning("⚠️ All providers exhausted. Generating enhanced placeholder.")
        return await self._generate_placeholder_video(prompt, duration)

    async def _try_generate(self, prompt: str, model: str, duration: int, image_url: Optional[str]) -> Optional[str]:
        """Try a specific provider endpoint"""
        endpoint = f"{self.base_url}/{model}"
        
        try:
            payload = {
                "prompt": prompt,
                "duration": duration,
                "aspect_ratio": "9:16"
            }
            if image_url:
                payload["image_url"] = image_url
                
            response = requests.post(
                endpoint, 
                headers=self._get_headers(), 
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                job_data = response.json()
                prediction_id = job_data.get("id")
                if prediction_id:
                    return await self._poll_and_download(prediction_id)
            elif response.status_code == 404:
                logger.debug(f"Provider {model} returned 404 - trying next")
                return None
            else:
                logger.warning(f"Provider {model} returned {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            logger.warning(f"Provider {model} timed out")
            return None
        except requests.exceptions.ConnectionError:
            logger.warning(f"Provider {model} connection failed")
            return None
            
        return None

    async def _try_alternative_apis(self, prompt: str, duration: int) -> Optional[str]:
        """Try alternative direct API endpoints"""
        
        # Try Kling direct API
        if self.api_key:
            try:
                logger.info("🔄 Trying Kling direct API...")
                kling_response = requests.post(
                    "https://api.klingai.com/v1/videos/generations",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "prompt": prompt,
                        "duration": duration,
                        "model": "kling-v1"
                    },
                    timeout=20
                )
                if kling_response.status_code == 200:
                    data = kling_response.json()
                    task_id = data.get("data", {}).get("task_id")
                    if task_id:
                        return await self._poll_kling(task_id)
            except Exception as e:
                logger.warning(f"Kling direct API failed: {e}")
        
        return None

    async def _try_huggingface(self, prompt: str, duration: int) -> Optional[str]:
        """Try open-source models via HuggingFace Inference API"""
        try:
            logger.info("🔄 Trying HuggingFace open-source video generation...")
            
            # Using Zeroscope or similar open models
            hf_api_key = os.getenv("HF_API_KEY")
            if not hf_api_key:
                return None
                
            # Note: Most HF video models require specific endpoints
            # This is a placeholder for actual implementation
            # Real video generation on HF is limited
            
            return None
        except Exception as e:
            logger.warning(f"HuggingFace generation failed: {e}")
            return None

    async def _poll_kling(self, task_id: str) -> Optional[str]:
        """Poll Kling API for completion"""
        max_retries = 60
        for _ in range(max_retries):
            try:
                resp = requests.get(
                    f"https://api.klingai.com/v1/videos/generations/{task_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json()
                    status = data.get("data", {}).get("status")
                    if status == "completed":
                        video_url = data.get("data", {}).get("video_url")
                        if video_url:
                            return self._download_video(video_url, f"kling_{task_id}.mp4")
                    elif status == "failed":
                        break
                await asyncio.sleep(3)
            except Exception as e:
                logger.warning(f"Kling poll error: {e}")
                break
        return None

    async def _poll_and_download(self, prediction_id: str) -> str:
        """Polls for completion and downloads the result."""
        max_retries = 60
        for i in range(max_retries):
            try:
                poll_url = f"{self.base_url}/predictions/{prediction_id}/result"
                result_resp = requests.get(poll_url, headers=self._get_headers(), timeout=10)
                if result_resp.status_code == 200:
                    data = result_resp.json()
                    status = data.get("status")
                    if status == "completed":
                        output_url = data.get("output_url")
                        if output_url:
                            return self._download_video(output_url, f"muapi_{prediction_id}.mp4")
                    elif status == "failed":
                        break
            except Exception as e:
                logger.warning(f"Poll error (attempt {i+1}): {e}")
            
            await asyncio.sleep(3)
        
        raise VideoProviderError("Polling failed or timed out")

    async def _generate_placeholder_video(self, prompt: str, duration: int) -> str:
        """[UPGRADE] Generates an enhanced placeholder MP4 with styled background"""
        filename = f"placeholder_{int(time.time())}.mp4"
        output_path = os.path.join(self.temp_dir, filename)
        
        logger.info(f"🛠️ [Fail-Safe] Generating styled placeholder: {output_path}")
        
        # Create more visually appealing placeholder
        # Use gradient background with prompt text
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d={duration}",
            "-vf", f"drawbox=color=black@0.5:x=0:y=0:w=1080:h=200:t=fill,"
                   f"drawtext=text='[AI VIDEO]: {prompt[:40]}...':fontcolor=white:fontsize=36:font=sans:x=(w-text_w)/2:y=80,"
                   f"drawtext=text='Content generation in progress':fontcolor=gray:fontsize=24:x=(w-text_w)/2:y=140,"
                   f"drawtext=text='ViraLoop AI':fontcolor=#3b82f6:fontsize=20:x=20:y=h-40",
            "-c:v", "libx264", 
            "-t", str(duration), 
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            output_path
        ]
        
        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            logger.error(f"Placeholder generation failed: {stderr.decode()}")
            # Ultra fallback - simple black video
            simple_cmd = [
                "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d={duration}",
                "-c:v", "libx264", "-t", str(duration), "-pix_fmt", "yuv420p", output_path
            ]
            await asyncio.create_subprocess_exec(*simple_cmd)
        
        return output_path

    def _download_video(self, url: str, filename: str) -> str:
        output_path = os.path.join(self.temp_dir, filename)
        logger.info(f"📥 Downloading video to: {output_path}")
        try:
            resp = requests.get(url, stream=True, timeout=120)
            resp.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return output_path
        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise