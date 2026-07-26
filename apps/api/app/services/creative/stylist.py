import logging
import re
import json

logger = logging.getLogger(__name__)

class Stylist:
    def __init__(self, llm_client):
        self.llm_client = llm_client

    def analyze_style(self, image_data: bytes, provider: str = "google", model: str = "gemini-2.0-flash-exp") -> dict:
        """
        Analyzes an image to extract artistic style prompts for consistent image generation.
        """
        try:
            prompt = """
            Analyze the artistic style of this image. Focus ONLY on visual technique and aesthetics.
            Extract: Artistic Medium, Lighting, Color Palette, Camera Properties.
            Output ONLY JSON: { "style_prompt": "...", "negative_prompt": "..." }
            """
            
            full_model_name = self._resolve_model(provider, model)
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=full_model_name,
                images=[image_data],
                full_response=False
            )
            
            text = response.get("content", "") if isinstance(response, dict) else response
            if text.startswith("Error:"): raise RuntimeError(text)
                
            match = re.search(r'\{.*\}', text, re.DOTALL)
            return json.loads(match.group(0)) if match else {"style_prompt": text, "negative_prompt": ""}

        except Exception as e:
            logger.error(f"Style Analysis Failed: {e}")
            raise e

    def _resolve_model(self, provider, model):
        if provider == "openrouter": return f"openrouter/{model}"
        if provider == "groq": return f"groq/{model}"
        if provider == "google": return f"google/{model}"
        return model
