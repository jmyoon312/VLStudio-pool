from google import genai
from google.genai import types
import logging
import time

logger = logging.getLogger(__name__)

class GeminiManager:
    # SMART CASCADE STRATEGY (3.0 -> 2.5 -> 2.0)
    FALLBACK_MODELS = [
        "gemini-2.0-pro-exp-02-05", # Updated to actual latest
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash"
    ]

    def __init__(self, api_keys: list[str]):
        # Strict Sanitization: Strip spaces, newlines, carriage returns
        self.api_keys = []
        if api_keys:
            for k in api_keys:
                if k:
                    clean_key = k.strip().replace('\n', '').replace('\r', '')
                    if clean_key:
                        self.api_keys.append(clean_key)
        
        self.current_key_index = 0
        
        if not self.api_keys:
            logger.warning("[WARN] No Gemini API keys configured.")
        else:
            logger.info(f"[OK] Loaded {len(self.api_keys)} keys (Sanitized).")

    def _get_client(self):
        if not self.api_keys:
            raise ValueError("No API Keys available. Please check Settings.")
        # Round-Robin Key Rotation
        key = self.api_keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        return genai.Client(api_key=key)

    def generate_content(self, prompt: str, model_name: str = None, system_instruction: str = None, full_response: bool = False) -> str | dict:
        """
        Generates content using `google-genai` V1 Client.
        Handles Model Fallback and Key Rotation automatically.
        
        Args:
            full_response: If True, returns dict {'content': str, 'model': str}. 
                           If False, returns str (content only).
        """
        # 1. Prioritize User Request, then Fallbacks
        requested_model = model_name if model_name else self.FALLBACK_MODELS[0]
        models_to_try = [requested_model]
        for fb in self.FALLBACK_MODELS:
            if fb != requested_model and fb not in models_to_try:
                models_to_try.append(fb)

        last_error = None

        # 2. Try Models sequentially
        for model in models_to_try:
            # Retry loop for API Keys (Quota issues)
            for attempt in range(len(self.api_keys) + 1):
                try:
                    client = self._get_client()
                    if attempt == 0: logger.info(f"[FALLBACK] Sending to [{model}]...")

                    config = types.GenerateContentConfig(
                        temperature=0.7,
                        system_instruction=system_instruction
                    )

                    # NEW V1 API CALL
                    response = client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config
                    )
                    
                    if response.text:
                        # Success!
                        if full_response:
                            return {
                                "content": response.text,
                                "model": model
                            }
                        else:
                            return response.text
                    
                except Exception as e:
                    error_msg = str(e)
                    last_error = e
                    
                    # 404/400 (Invalid Model) -> Switch Model
                    if "404" in error_msg or "not found" in error_msg.lower() or "400" in error_msg:
                        logger.warning(f"[WARN] Model {model} unavailable. Switching...")
                        break 
                    
                    # 429 (Quota) -> Rotate Key & Retry
                    if "429" in error_msg or "quota" in error_msg.lower():
                        logger.warning(f"[WAIT] Quota limit. Rotating key...")
                        time.sleep(1)
                        continue
                    
                    logger.error(f"[FAIL] Error with {model}: {error_msg}")
                    break

        error_msg = f"Error: Generation failed. Last error: {str(last_error)}"
        if full_response:
            return {"content": error_msg, "model": "error"}
        return error_msg

    def list_models(self):
        """
        Fetches available models dynamically from Google API.
        """
        try:
            client = self._get_client()
            # client.models.list() returns an iterator of Model objects
            # page_size=100 generally safe
            models = client.models.list(config={"page_size": 100})
            
            fetched = []
            for m in models:
                # m is likely a Model object with .name (e.g. "models/gemini-1.5-flash")
                # We need to parse it.
                mid = m.name.replace("models/", "")
                
                # Filter for generative models (gemini)
                if "gemini" not in mid:
                    continue
                    
                label = mid
                if "gemini-2.0-flash" in mid: label = "Gemini 2.0 Flash (New)"
                elif "gemini-2.0-pro" in mid: label = "Gemini 2.0 Pro (Exp)"
                elif "gemini-1.5-pro" in mid: label = "Gemini 1.5 Pro"
                elif "gemini-1.5-flash" in mid: label = "Gemini 1.5 Flash"
                
                fetched.append({"value": mid, "label": label})
                
            return fetched
        except Exception as e:
            logger.error(f"Failed to list Google models: {e}")
            return []
