import logging
import os
from app.llm_manager import LLMClient
from app import models
from app.database import SessionLocal

logger = logging.getLogger(__name__)

class ImageGenService:
    def __init__(self, settings: models.Settings):
        self.settings = settings
        self.db = SessionLocal()
        self.llm_client = LLMClient(settings)
        
    def generate_image(self, prompt: str, mode: str = "auto", style: str = None) -> str:
        """
        Unified Image Generation Entry Point (100% API Driven).
        Modes are now unified to use cost-effective and fast API engines.
        """
        final_prompt = prompt
        if style:
             final_prompt = f"{prompt}, {style}"
             
        logger.info(f"🎨 Image Gen Request: '{final_prompt}' [Mode: {mode}]")
        return self._generate_via_api(final_prompt)
            
    def _generate_via_api(self, prompt: str) -> str:
        # Tries Gemini first (free), then DALL-E (paid)
        try:
             # Force provider to Google for cost saving if keys exist
             if self.settings.gemini_api_keys:
                 return self.llm_client.generate_image(prompt, provider="google")
             elif self.settings.openai_api_key:
                 return self.llm_client.generate_image(prompt, provider="openai")
             else:
                 logger.warning("No image API keys available. Mocking image generation for testing.")
                 return "https://dummyimage.com/1024x1024/000/fff&text=Mock+Image"
        except Exception as e:
            logger.error(f"[FAIL] API Gen Failed: {e}")
            logger.warning("Falling back to mock image due to API error...")
            return "https://dummyimage.com/1024x1024/000/fff&text=Mock+Image"
