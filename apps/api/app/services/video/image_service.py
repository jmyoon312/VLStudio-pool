import os
import time
import requests
import logging
import shutil
from ...llm_manager import LLMClient
from ...config import settings as app_settings

logger = logging.getLogger(__name__)

class ImageService:
    def __init__(self, settings):
        self.settings = settings
        self.llm_client = LLMClient(settings)
        self.temp_dir = app_settings.TEMP_DIR
        os.makedirs(self.temp_dir, exist_ok=True)

    def generate_scene_image(self, scene_id: int, prompt: str, provider: str = "openai", model: str = "dall-e-3") -> str:
        """
        Generates an image for a scene and saves it locally.
        """
        try:
            result_path_or_url = self.llm_client.generate_image(prompt, provider, model)
            
            # Case 1: Result is already a local path
            if os.path.exists(result_path_or_url) and not result_path_or_url.startswith("http"):
                 logger.info(f"🎨 [Image Gen] Received local file: {result_path_or_url}")
                 filename = f"scene_{scene_id}_{int(time.time())}.png"
                 filepath = os.path.join(self.temp_dir, filename)
                 shutil.copy2(result_path_or_url, filepath)
                 return filepath

            # Case 2: Result is a URL
            image_url = result_path_or_url
            response = requests.get(image_url)
            response.raise_for_status()
            
            filename = f"scene_{scene_id}_{int(time.time())}.png"
            filepath = os.path.join(self.temp_dir, filename)
            
            with open(filepath, "wb") as f:
                f.write(response.content)
                
            return filepath
        except Exception as e:
            logger.error(f"❌ Scene Image Gen Failed: {e}")
            return self._generate_dummy_image(scene_id, prompt)

    def _generate_dummy_image(self, scene_id: int, prompt: str) -> str:
        """Fallback dummy image generation"""
        try:
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (1024, 1792), color = (73, 109, 137))
            d = ImageDraw.Draw(img)
            d.text((10,10), f"Scene {scene_id}\n{prompt[:50]}...", fill=(255,255,0))
            
            filename = f"scene_{scene_id}_{int(time.time())}_dummy.png"
            filepath = os.path.join(self.temp_dir, filename)
            img.save(filepath)
            return filepath
        except Exception as ex:
            logger.error(f"❌ Dummy Image Gen Failed: {ex}")
            raise ex
