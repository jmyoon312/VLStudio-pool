from google import genai
from google.genai import types
import logging
import time
import os
import base64
from openai import OpenAI
from typing import List, Dict, Any, Optional
from . import schemas
from app.services.metrics import collector

import json
from datetime import datetime, timedelta
import asyncio
import aiohttp

logger = logging.getLogger(__name__)

# --- Legacy Global Cache (Phase-out in favor of DB) ---
_MODEL_CACHE = None
_CACHE_TTL = 86400  # 24 Hours

def clear_model_cache_global():
    """Global utility to clear model cache across all instances."""
    global _MODEL_CACHE
    _MODEL_CACHE = None
    logger.info("🧹 [Global] Model Cache Cleared.")

def parse_llm_error(e: Exception, provider: str) -> str:
    """
    Translates raw API exceptions into user-friendly localized messages.
    """
    error_msg = str(e).lower()
    
    if "401" in error_msg or "unauthorized" in error_msg:
        return f"[{provider}] API 키가 올바르지 않거나 만료되었습니다. 설정을 확인해 주세요."
    if "403" in error_msg or "forbidden" in error_msg or "permission denied" in error_msg:
        return f"[{provider}] API 액세스가 거부되었습니다(403). Google Cloud Console에서 'Generative Language API'가 활성화되어 있는지 확인해 주세요."
    if "402" in error_msg or "payment" in error_msg or "quota" in error_msg or "balance" in error_msg:
        return f"[{provider}] 결제 수단 등록이 필요하거나 크레딧이 부족합니다. 해당 서비스 포털(Billing)을 확인해 주세요."
    if "429" in error_msg or "rate limit" in error_msg:
        return f"[{provider}] 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 다른 제공자를 사용해 주세요."
    if "timeout" in error_msg:
        return f"[{provider}] 연결 시간이 초과되었습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요."
    
    return f"[{provider} 오류] {str(e)}"

class LLMClient:
    def __init__(self, settings: schemas.Settings):
        self.settings = settings
        
        # [CRITICAL] SOVEREIGN TRUTH: DB Settings must override .env entirely
        # Gemini Setup
        self.gemini_keys = []
        if settings.gemini_api_keys:
            for k in settings.gemini_api_keys:
                if k:
                    clean_key = k.strip().replace('\n', '').replace('\r', '')
                    if clean_key:
                        self.gemini_keys.append(clean_key)
        self.gemini_key_index = 0
        
        # OpenRouter Setup
        self.openrouter_keys = []
        if hasattr(settings, "openrouter_api_keys") and settings.openrouter_api_keys:
            for k in settings.openrouter_api_keys:
                if k:
                    clean_key = k.strip().replace("\n", "").replace("\r", "")
                    if clean_key: self.openrouter_keys.append(clean_key)
        elif hasattr(settings, "openrouter_api_key") and settings.openrouter_api_key:
            self.openrouter_keys.append(settings.openrouter_api_key.strip())
        self.openrouter_key_index = 0
        
        # Groq Setup
        self.groq_keys = []
        if settings.groq_api_keys:
            for k in settings.groq_api_keys:
                if k:
                    clean_key = k.strip().replace("\n", "").replace("\r", "")
                    if clean_key: self.groq_keys.append(clean_key)
        elif hasattr(settings, "groq_api_key") and settings.groq_api_key:
            self.groq_keys.append(settings.groq_api_key.strip())
        self.groq_key_index = 0
        
        # SambaNova Setup
        self.sambanova_keys = []
        if settings.sambanova_api_keys:
            for k in settings.sambanova_api_keys:
                if k:
                    clean_key = k.strip()
                    if clean_key: self.sambanova_keys.append(clean_key)
        self.sambanova_key_index = 0

        # Cerebras Setup
        self.cerebras_keys = []
        if settings.cerebras_api_keys:
            for k in settings.cerebras_api_keys:
                if k:
                    clean_key = k.strip()
                    if clean_key: self.cerebras_keys.append(clean_key)
        self.cerebras_key_index = 0

        # NVIDIA Setup (Added)
        self.nvidia_keys = []
        if hasattr(settings, "nvidia_api_keys") and settings.nvidia_api_keys:
            for k in settings.nvidia_api_keys:
                if k:
                    clean_key = k.strip()
                    if clean_key: self.nvidia_keys.append(clean_key)
        self.nvidia_key_index = 0
        # OpenCode Zen Setup
        self.opencode_keys = []
        if hasattr(settings, "opencode_api_keys") and settings.opencode_api_keys:
            for k in settings.opencode_api_keys:
                if k:
                    clean_key = k.strip()
                    if clean_key: self.opencode_keys.append(clean_key)
        self.opencode_key_index = 0

        # YouTube1 Setup (Custom OpenAI-compatible endpoint)
        self.youtube1_keys = []
        if hasattr(settings, "youtube1_api_keys") and settings.youtube1_api_keys:
            for k in settings.youtube1_api_keys:
                if k:
                    clean_key = k.strip()
                    if clean_key: self.youtube1_keys.append(clean_key)
        self.youtube1_key_index = 0
    
    def _get_ollama_v1_url(self) -> str:
        """
        [NEW] Centralized helper to get the verified Ollama V1 endpoint from DB.
        """
        raw_url = getattr(self.settings, "ollama_api_base_url", "http://host.docker.internal:11434/v1")
        clean_url = str(raw_url).strip().rstrip("/")
        if clean_url.endswith("/v1"):
            return clean_url
        return f"{clean_url}/v1"

    def _get_gemini_client(self):
        if not self.gemini_keys:
            raise ValueError("No Gemini API Keys available in DB Settings.")
        
        key = self.gemini_keys[self.gemini_key_index]
        self.gemini_key_index = (self.gemini_key_index + 1) % len(self.gemini_keys)
        return genai.Client(api_key=key)

    def generate(self, prompt: str, model_name: str = None, system_instruction: str = None) -> str:
        """Compatibility wrapper for code calling llm.generate(...)"""
        if not model_name:
            model_name = getattr(self.settings, "script_analysis_model", None) or getattr(self.settings, "openclaw_model", None) or getattr(self.settings, "default_llm_model", "gemini-1.5-flash")
        if not model_name:
            model_name = "gemini-1.5-flash"
        res = self.generate_content(prompt, model_name=model_name, system_instruction=system_instruction)
        if isinstance(res, dict):
            import json
            return json.dumps(res)
        return str(res)

    def generate_content(self, prompt: str, model_name: str, system_instruction: str = None, full_response: bool = False, images: list = None) -> str | dict:
        """
        Unified generation method with automatic fallback (OpenCode -> Groq -> Gemini) on Rate Limits.
        """
        try:
            return self._generate_content_internal(prompt, model_name, system_instruction, full_response, images)
        except Exception as e:
            error_msg = str(e).lower()
            # If it's a rate limit or exhaustion error, trigger fallback
            if "429" in error_msg or "rate limit" in error_msg or "freeusagelimiterror" in error_msg or "exhausted" in error_msg or "quota" in error_msg or "402" in error_msg:
                if model_name and (model_name.startswith("opencode/") or model_name.startswith("openrouter/")):
                    logger.warning(f"[WARN] [Fallback] {model_name.split('/')[0].title()} limit reached. Falling back to Groq...")
                    try:
                        return self._generate_content_internal(prompt, "groq/llama-3.3-70b-versatile", system_instruction, full_response, images)
                    except Exception as e2:
                        logger.warning("[WARN] [Fallback] Groq limit reached. Falling back to Gemini...")
                        try:
                            return self._generate_content_internal(prompt, "gemini/gemini-1.5-flash", system_instruction, full_response, images)
                        except Exception as e3:
                            logger.error(f"[FAIL] [Fallback] All fallback models exhausted. Final error: {e3}")
                            if full_response: return {"content": f"ERROR: {str(e3)}", "error": str(e3)}
                            return f"ERROR: {str(e3)}"
                            
                elif model_name and model_name.startswith("groq/"):
                    logger.warning("[WARN] [Fallback] Groq limit reached. Falling back to Gemini...")
                    try:
                        return self._generate_content_internal(prompt, "gemini/gemini-1.5-flash", system_instruction, full_response, images)
                    except Exception as e3:
                        logger.error(f"[FAIL] [Fallback] Gemini exhausted as well. Final error: {e3}")
                        if full_response: return {"content": f"ERROR: {str(e3)}", "error": str(e3)}
                        return f"ERROR: {str(e3)}"
            
            # For other errors or if fallback isn't applicable
            logger.error(f"Generate content failed: {e}")
            if full_response:
                return {"content": f"ERROR: {error_msg}", "error": error_msg}
            return f"ERROR: {error_msg}"

    def _generate_content_internal(self, prompt: str, model_name: str, system_instruction: str = None, full_response: bool = False, images: list = None) -> str | dict:
        """
        Original unified generation logic without fallback wrapper.
        [SOVEREIGN] Strictly honors the requested model_name without unrequested provider switching.
        """
        try:
            # [STABILIZATION] Resolve Effective Model Name with absolute DB priority
            if not model_name or model_name.lower() in ["free", "auto"]:
                provider = getattr(self.settings, "openclaw_preferred_provider", "auto")
                if provider != "auto" and "/" not in model_name:
                    model_name = f"{provider}/{model_name}"

            # OpenCode Zen Routing Logic
            if model_name.startswith("opencode/"):
                last_error = None
                for _ in range(len(self.opencode_keys) + 1):
                    current_key = self.opencode_keys[self.opencode_key_index] if self.opencode_keys else None
                    if not current_key: break

                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("opencode/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://opencode.ai/zen/v1",
                            api_key=current_key,
                            provider_name="OpenCode",
                            images=images,
                            request_timeout=120.0
                        )
                    except Exception as e:
                        last_error = e
                        if self.opencode_keys:
                            logger.warning(f"[WAIT] [OpenCode] Error on Key #{self.opencode_key_index}: {e}. Rotating...")
                            self.opencode_key_index = (self.opencode_key_index + 1) % len(self.opencode_keys)
                            import time
                            error_msg = str(e).lower()
                            if "429" in str(e) or "rate limit" in error_msg or "freeusagelimiterror" in error_msg:
                                time.sleep(5)
                            elif "timeout" in error_msg or "timed out" in error_msg:
                                time.sleep(3)
                            elif "401" in str(e) or "auth" in error_msg or "invalid" in error_msg:
                                time.sleep(0.5)
                            else:
                                time.sleep(2)
                            continue
                        else:
                            break
                if last_error and ("timeout" in str(last_error).lower()):
                    logger.warning("All OpenCode keys exhausted (timeouts). Trying fallback provider...")
                    raise last_error
                raise last_error or Exception("No OpenCode Zen API Keys available.")

            # OpenRouter Routing Logic
            if model_name.startswith("openrouter/"):
                # Strip 'openrouter/' prefix for all models
                real_model = model_name
                while real_model.startswith("openrouter/"):
                    real_model = real_model.replace("openrouter/", "", 1)
                
                # If specific 'Free' was selected, use the official 'openrouter/free' router ID
                if real_model.lower() == "free":
                    real_model = "openrouter/free"
                
                last_error = None
                
                for _ in range(len(self.openrouter_keys) + 1):
                    current_key = self.openrouter_keys[self.openrouter_key_index] if self.openrouter_keys else None
                    if not current_key: break
                    
                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=real_model,
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://openrouter.ai/api/v1",
                            api_key=current_key,
                            provider_name="OpenRouter",
                            images=images,
                            extra_headers={
                                "HTTP-Referer": "https://github.com/ViraLoop",
                                "X-Title": "ViraLoop"
                            }
                        )
                    except Exception as e:
                        last_error = e
                        # Key Rotation for paid/specific models
                        if self.openrouter_keys:
                            logger.warning(f"[WAIT] [OpenRouter] Error on Key #{self.openrouter_key_index}: {e}. Rotating...")
                            self.openrouter_key_index = (self.openrouter_key_index + 1) % len(self.openrouter_keys)
                            import time
                            time.sleep(1)
                            continue
                        else:
                            break
                raise last_error or Exception("No OpenRouter API Keys available.")

            elif model_name.startswith("sambanova/"):
                # SambaNova Logic
                last_error = None
                for _ in range(len(self.sambanova_keys) + 1):
                    current_key = self.sambanova_keys[self.sambanova_key_index] if self.sambanova_keys else None
                    if not current_key: break
                    
                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("sambanova/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://api.sambanova.ai/v1",
                            api_key=current_key,
                            provider_name="SambaNova",
                            images=images
                        )
                    except Exception as e:
                        last_error = e
                        logger.warning(f"[WAIT] [SambaNova] Error on Key #{self.sambanova_key_index}: {e}. Rotating...")
                        self.sambanova_key_index = (self.sambanova_key_index + 1) % len(self.sambanova_keys)
                        import time
                        time.sleep(1)
                        continue
                raise last_error or Exception("All SambaNova keys exhausted.")

            elif model_name.startswith("cerebras/"):
                # Cerebras Logic
                last_error = None
                for _ in range(len(self.cerebras_keys) + 1):
                    current_key = self.cerebras_keys[self.cerebras_key_index] if self.cerebras_keys else None
                    if not current_key: break
                    
                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("cerebras/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://api.cerebras.ai/v1",
                            api_key=current_key,
                            provider_name="Cerebras",
                            images=images
                        )
                    except Exception as e:
                        last_error = e
                        logger.warning(f"[WAIT] [Cerebras] Error on Key #{self.cerebras_key_index}: {e}. Rotating...")
                        self.cerebras_key_index = (self.cerebras_key_index + 1) % len(self.cerebras_keys)
                        import time
                        time.sleep(1)
                        continue
                raise last_error or Exception("All Cerebras keys exhausted.")

            elif model_name.startswith("ollama/"):
                # Ollama Logic (Targets Windows Host from WSL or Local)
                v1_url = self._get_ollama_v1_url()
                
                return self._generate_openai_compatible(
                    prompt=prompt,
                    model=model_name.replace("ollama/", ""),
                    system_instruction=system_instruction,
                    full_response=full_response,
                    base_url=v1_url,
                    api_key="ollama", # Placeholder
                    provider_name="Ollama",
                    images=images
                )

            elif model_name.startswith("groq/"):
                # Groq Logic
                last_error = None
                for _ in range(len(self.groq_keys) + 1):
                    current_key = self.groq_keys[self.groq_key_index] if self.groq_keys else None
                    if not current_key: break
                    
                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("groq/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://api.groq.com/openai/v1",
                            api_key=current_key,
                            provider_name="Groq",
                            images=images
                        )
                    except Exception as e:
                        last_error = e
                        logger.warning(f"[WAIT] [Groq] Error on Key #{self.groq_key_index}: {e}. Rotating...")
                        self.groq_key_index = (self.groq_key_index + 1) % len(self.groq_keys)
                        import time
                        time.sleep(1)
                        continue
                raise last_error or Exception("All Groq keys exhausted.")

            elif model_name.startswith("nvidia/"):
                # NVIDIA Logic (Added)
                last_error = None
                for _ in range(len(self.nvidia_keys) + 1):
                    current_key = self.nvidia_keys[self.nvidia_key_index] if self.nvidia_keys else None
                    if not current_key: break
                    
                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("nvidia/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="https://integrate.api.nvidia.com/v1",
                            api_key=current_key,
                            provider_name="NVIDIA",
                            images=images
                        )
                    except Exception as e:
                        last_error = e
                        logger.warning(f"[WAIT] [NVIDIA] Error on Key #{self.nvidia_key_index}: {e}. Rotating...")
                        self.nvidia_key_index = (self.nvidia_key_index + 1) % len(self.nvidia_keys)
                        import time
                        time.sleep(1)
                        continue
                raise last_error or Exception("All NVIDIA keys exhausted.")

            elif model_name.startswith("youtube1/"):
                # YouTube1 Custom Provider (local API endpoint)
                last_error = None
                for _ in range(len(self.youtube1_keys) + 1):
                    current_key = self.youtube1_keys[self.youtube1_key_index] if self.youtube1_keys else None
                    if not current_key: break

                    try:
                        return self._generate_openai_compatible(
                            prompt=prompt,
                            model=model_name.replace("youtube1/", ""),
                            system_instruction=system_instruction,
                            full_response=full_response,
                            base_url="http://localhost:20128/v1",
                            api_key=current_key,
                            provider_name="YouTube1",
                            images=images,
                            request_timeout=120.0
                        )
                    except Exception as e:
                        last_error = e
                        logger.warning(f"[WAIT] [YouTube1] Error on Key #{self.youtube1_key_index}: {e}. Rotating...")
                        self.youtube1_key_index = (self.youtube1_key_index + 1) % len(self.youtube1_keys)
                        import time
                        time.sleep(1)
                        continue
                raise last_error or Exception("All YouTube1 keys exhausted.")

            elif model_name.startswith("google/") or model_name.startswith("gemini/"):
                # Google/Gemini routing
                real_model = model_name.split("/", 1)[1]
                return self._generate_gemini(
                    prompt=prompt,
                    model=real_model,
                    system_instruction=system_instruction,
                    full_response=full_response,
                    images=images
                )

            elif model_name.startswith("openai/"):
                key = getattr(self.settings, "openai_api_key", None) or os.getenv("OPENAI_API_KEY")
                if not key:
                    raise ValueError("OpenAI API key is missing. Please set openai_api_key in Settings or OPENAI_API_KEY environment variable.")
                real_model = model_name.replace("openai/", "")
                return self._generate_openai_compatible(
                    prompt=prompt,
                    model=real_model,
                    system_instruction=system_instruction,
                    full_response=full_response,
                    base_url="https://api.openai.com/v1",
                    api_key=key,
                    provider_name="OpenAI",
                    images=images
                )

            elif model_name.startswith("anthropic/"):
                import anthropic
                key = os.getenv("ANTHROPIC_API_KEY")
                if not key:
                    raise ValueError("Anthropic API key is missing. Please set ANTHROPIC_API_KEY environment variable.")
                client = anthropic.Anthropic(api_key=key)
                real_model = model_name.replace("anthropic/", "")
                
                messages = [{"role": "user", "content": prompt}]
                logger.info(f"[FALLBACK] [Anthropic] Sending to [{real_model}]...")
                response = client.messages.create(
                    model=real_model,
                    max_tokens=4096,
                    system=system_instruction or "",
                    messages=messages,
                    temperature=0.7
                )
                content = response.content[0].text
                if full_response:
                    return {
                        "content": content,
                        "model": model_name
                    }
                return content

            # [SOVEREIGN] Resolve fallback to global settings default if no provider prefix found
            fallback_model = getattr(self.settings, "default_model", "opencode/deepseek-v4-flash-free")
            real_model = model_name
            
            logger.warning(f"[WARN] [LLM] No provider prefix for '{model_name}'. Falling back to settings default: {fallback_model}")
            return self._generate_content_internal(prompt, fallback_model, system_instruction, full_response, images)
        except Exception as e:
            # Let the outer wrapper handle the exception and fallbacks
            raise e

    def _generate_gemini(self, prompt: str, model: str, system_instruction: str, full_response: bool, images: list = None):
        requested_model = model if model else self.settings.default_model
        # Use ONLY the requested model to honor user choice
        models_to_try = [requested_model]

        last_error = None

        for current_model in models_to_try:
            # Retry loop for API Keys
            for attempt in range(len(self.gemini_keys) + 1):
                try:
                    start_ts = time.time()
                    client = self._get_gemini_client()
                    if attempt == 0: logger.info(f"[FALLBACK] [Gemini] Sending to [{current_model}] (Images: {len(images) if images else 0})...")

                    config = types.GenerateContentConfig(
                        temperature=0.7,
                        system_instruction=system_instruction
                    )

                    # Prepare contents
                    contents = [prompt]
                    if images:
                        for img in images:
                            if isinstance(img, bytes):
                                contents.append(types.Part.from_bytes(data=img, mime_type="image/jpeg"))
                            elif isinstance(img, dict) and "data" in img and "mime_type" in img:
                                contents.append(types.Part.from_bytes(data=img["data"], mime_type=img["mime_type"]))
                            else:
                                contents.append(img)

                    response = client.models.generate_content(
                        model=current_model,
                        contents=contents,
                        config=config
                    )
                    
                    if response and hasattr(response, 'text') and response.text:
                        latency = time.time() - start_ts
                        collector.record_event("llm", "generate", "success", {"provider": "gemini", "model": current_model, "latency": latency})
                        if full_response:
                            return {
                                "content": response.text,
                                "model": f"google/{current_model}"
                            }
                        else:
                            return response.text
                    else:
                        logger.warning(f"[WARN] [Gemini] Empty response from {current_model}. Attempting rotation...")
                        continue
                    
                except Exception as e:
                    error_msg = str(e)
                    last_error = e
                    
                    if "404" in error_msg or "not found" in error_msg.lower() or "400" in error_msg:
                        logger.warning(f"[WARN] [Gemini] Model {current_model} unavailable. Switching...")
                        break 
                    
                    if "403" in error_msg or "permission" in error_msg.lower():
                        collector.record_event("llm", "auth_error", "error", {"provider": "gemini", "model": current_model, "error": error_msg})
                        logger.error(f"[FAIL] [Gemini] ACCESS FORBIDDEN (403). Please enable 'Generative Language API' in your Google Cloud Console for project 1024666224541.")
                        break

                    if "429" in error_msg or "quota" in error_msg.lower():
                        collector.record_event("llm", "rate_limit", "warning", {"provider": "gemini", "model": current_model, "error": error_msg})
                        logger.warning(f"[WAIT] [Gemini] Quota limit. Rotating key... (Sleeping 5s)")
                        time.sleep(5)
                        continue
                    
                    logger.error(f"[FAIL] [Gemini] Error with {current_model}: {error_msg}")
                    break
        
        msg = f"Gemini failed after {len(self.gemini_keys)} attempts. Last error: {last_error}"
        raise Exception(msg)
        
    def embed_text(self, text: str, model: str = "text-embedding-004") -> List[float]:
        """
        Generates a vector embedding for the given text using Gemini.
        """
        try:
            client = self._get_gemini_client()
            response = client.models.embed_content(
                model=model,
                contents=[text]
            )
            return response.embeddings[0].values
        except Exception as e:
            logger.error(f"[FAIL] Embedding failed: {e}")
            return [0.0] * 768 

    def _generate_openai_compatible(self, prompt: str, model: str, system_instruction: str, full_response: bool, base_url: str, api_key: str, provider_name: str, images: list = None, extra_headers: dict = None, request_timeout: float = 30.0):
        if not api_key:
            raise ValueError(f"{provider_name} API Key is missing. Please check Settings.")

        client = OpenAI(
            base_url=base_url, 
            api_key=api_key,
            default_headers=extra_headers,
            max_retries=0
        )
        
        # Some models (Gemma, Llama-2, etc.) don't support the 'system' role or 'developer instructions'
        # We merge the system prompt into the first user message for compatibility.
        use_system_role = True
        model_lower = model.lower()
        if "gemma" in model_lower or "llama-2" in model_lower:
            use_system_role = False
            logger.info(f"ℹ️ [{provider_name}] Model {model} does not support system role. Merging instruction into prompt.")
        
        messages = []
        if system_instruction and use_system_role:
            messages.append({"role": "system", "content": system_instruction})
        
        # Construct final prompt (incorporating system instruction if role is not supported)
        final_prompt = prompt
        if system_instruction and not use_system_role:
            final_prompt = f"### SYSTEM INSTRUCTION ###\n{system_instruction}\n\n### USER PROMPT ###\n{prompt}"

        # Construct payload based on provider and model type
        if images:
            # Standard OpenAI Vision payload
            user_content = [{"type": "text", "text": final_prompt}]
            
            import base64
            for img in images:
                img_data = img
                mime_type = "image/jpeg"
                
                if isinstance(img, dict) and "data" in img:
                    img_data = img["data"]
                    mime_type = img.get("mime_type", "image/jpeg")
                
                if isinstance(img_data, bytes):
                    b64_image = base64.b64encode(img_data).decode('utf-8')
                    user_content.append({
                        "type": "image_url", 
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64_image}"
                        }
                    })
            messages.append({"role": "user", "content": user_content})
            
        else:
            # Standard Text payload (Simple String)
            messages.append({"role": "user", "content": final_prompt})

        logger.info(f"[FALLBACK] [{provider_name}] Sending to [{model}] (Images: {len(images) if images else 0})...")
        start_ts = time.time()

        try:
            # Explicit timeout to prevent hanging
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                timeout=request_timeout
            )
            
            content = response.choices[0].message.content
            
            if full_response:
                latency = time.time() - start_ts
                collector.record_event("llm", "generate", "success", {"provider": provider_name, "model": model, "latency": latency})
                return {
                    "content": content,
                    "model": f"{provider_name.lower()}/{model}"
                }
            return content
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"[FAIL] [{provider_name}] Error: {e}")
            raise e

    # --- Image Generation ---
    def generate_image(self, prompt: str, provider: str = "openai", model: str = "dall-e-3", size: str = "1024x1024") -> str:
        """
        Generates an image using OpenAI DALL-E 3 or Google Gemini Imagen 3.
        Returns the image URL or Local File Path.
        """
        
        # 1. Google Gemini (Imagen 3) Strategy
        if provider.lower() in ["google", "gemini"]:
             # Use Imagen 3 model by default if not specified or generic 'dall-e-3' passed
             target_model = "imagen-3.0-generate-001" 
             if model and "imagen" in model:
                 target_model = model
             
             return self._generate_image_gemini(prompt, target_model)

        # 2. OpenAI / OpenRouter Strategy (Existing)
        api_key = self.openrouter_key if provider == "openrouter" else self.settings.openai_api_key
        base_url = "https://openrouter.ai/api/v1" if provider == "openrouter" else None
        
        # If using OpenAI direct (default for DALL-E 3)
        if provider == "openai" and not api_key:
             # Fallback to OpenRouter if OpenAI key missing but OpenRouter available
             if self.openrouter_key:
                 provider = "openrouter"
                 api_key = self.openrouter_key
                 base_url = "https://openrouter.ai/api/v1"
                 # OpenRouter might not support dall-e-3 directly via this path, usually it's different models
                 # But let's assume user might have configured it or we use a fallback model
                 if model == "dall-e-3": model = "stabilityai/stable-diffusion-xl-base-1.0" # Fallback model
             else:
                # [Failover to Gemini if OpenAI is missing]
                if self.gemini_keys:
                    logger.info("[WARN] OpenAI Key missing. Auto-failover to Gemini Imagen 3.")
                    return self._generate_image_gemini(prompt, "imagen-3.0-generate-001")
                raise ValueError("OpenAI API Key is missing for Image Generation.")

        client = OpenAI(api_key=api_key, base_url=base_url)
        
        logger.info(f"🎨 Generating Image [{provider}/{model}]...")
        
        try:
            response = client.images.generate(
                model=model,
                prompt=prompt,
                size=size,
                quality="standard",
                n=1,
            )
            
            image_url = response.data[0].url
            return image_url
            
        except Exception as e:
            logger.error(f"[FAIL] Image Generation Failed: {e}")
            raise e

    def _generate_image_gemini(self, prompt: str, model: str) -> str:
        """
        Generates image using Google GenAI SDK (Imagen 3).
        Rotates keys on failure/quota.
        Saves to local temp file and returns absolute path.
        """
        import os
        import uuid
        import base64
        
        # [FIX] Use settings for cross-platform temp directory
        from app.database import SessionLocal
        from app import crud
        db = SessionLocal()
        settings = crud.get_settings(db)
        db.close()
        
        from app.config import settings as settings_conf
        temp_dir = settings.root_download_path if settings and settings.root_download_path else settings_conf.MEDIA_ROOT
        temp_dir = os.path.join(temp_dir, "temp")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir, exist_ok=True)
            
        last_error = None
        
        # Try up to (Number of Keys * 1) times - strictly rotate 
        attempts = len(self.gemini_keys)
        if attempts == 0:
             raise ValueError("No Gemini API Keys available for Image Generation.")
             
        for i in range(attempts + 1): # +1 to try the first key again if loop wraps or just ensuring coverage
             if i >= attempts: break 
             
             try:
                 client = self._get_gemini_client()
                 logger.info(f"🎨 [Gemini] Generating Image with Imagen 3 (Key #{self.gemini_key_index})...")
                 
                 start_ts = time.time()
                 
                 # GenAI SDK for Images
                 response = client.models.generate_images(
                     model=model,
                     prompt=prompt,
                     config=types.GenerateImagesConfig(
                         number_of_images=1,
                         aspect_ratio="1:1",
                     )
                 )
                 
                 if response.generated_images:
                     image_bytes = response.generated_images[0].image.image_bytes
                     
                     filename = f"gemini_gen_{uuid.uuid4()}.png"
                     filepath = os.path.join(temp_dir, filename)
                     
                     with open(filepath, "wb") as f:
                         f.write(image_bytes)
                         
                     logger.info(f"[OK] [Gemini] Image Saved: {filepath}")
                     return filepath
                 else:
                     raise ValueError("No images returned from Gemini.")

             except Exception as e:
                 error_msg = str(e).lower()
                 last_error = e
                 logger.warning(f"[WARN] [Gemini] Image Gen Error (Key #{self.gemini_key_index}): {e}")
                 
                 if "429" in error_msg or "quota" in error_msg or "403" in error_msg:
                     logger.warning(f"[WAIT] [Gemini] Key Quota Exceeded. Rotating to next key...")
                     continue
                 else:
                     if "safety" in error_msg or "blocked" in error_msg:
                         logger.error(f"[FAIL] [Gemini] Image Blocked by Safety Filters.")
                         raise e
                     continue

        raise last_error or Exception("All Gemini keys failed for Image Generation.")


    # --- Caching Mechanism ---
    def clear_model_cache(self):
        """Force clears the model cache."""
        global _MODEL_CACHE
        _MODEL_CACHE = None
        logger.info("🧹 Model Cache Cleared.")

    async def fetch_available_models(self, db: Optional[Any] = None, force: bool = False) -> dict:
        """
        Fetches models with Persistent DB Caching Strategy.
        """
        global _MODEL_CACHE
        
        if db and not force:
            try:
                from . import crud
                settings = crud.get_settings(db)
                if settings.model_cache and settings.model_cache_updated_at:
                    age = datetime.now() - settings.model_cache_updated_at
                    if age < timedelta(hours=24):
                        logger.info(f"[TURBO] Returning DB Cached Models (Age: {age})")
                        return settings.model_cache
            except Exception as e:
                logger.error(f"Failed to read model cache from DB: {e}")

        if not force and _MODEL_CACHE:
            age = time.time() - _MODEL_CACHE["timestamp"]
            if age < 3600:
                return _MODEL_CACHE["data"]
                
        logger.info("[REFRESH] Fetching Fresh Models from Providers (Parallel)...")
        data = await self._get_available_models_fresh_async()
        
        if db:
            try:
                from . import crud, schemas
                crud.update_settings(db, schemas.SettingsUpdate(
                    model_cache=data,
                    model_cache_updated_at=datetime.now()
                ))
                logger.info("[OK] Model cache updated in DB.")
            except Exception as e:
                logger.error(f"Failed to save model cache to DB: {e}")

        _MODEL_CACHE = {
            "timestamp": time.time(),
            "data": data
        }
        return data

    async def _get_available_models_fresh_async(self) -> dict:
        tasks = []
        tasks.append(self._fetch_google_models_async())
        tasks.append(self._fetch_groq_models_async())
        tasks.append(self._fetch_openrouter_models_async())
        tasks.append(self._fetch_sambanova_models_async())
        tasks.append(self._fetch_cerebras_models_async())
        tasks.append(self._fetch_ollama_models_async())
        tasks.append(self._fetch_nvidia_models_async())
        tasks.append(self._fetch_openai_models_async())
        tasks.append(self._fetch_opencode_models_async())
        tasks.append(self._fetch_anthropic_models_async())
        tasks.append(self._fetch_youtube1_models_async())

        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        models = {
            "google": results[0] if not isinstance(results[0], Exception) else [],
            "groq": results[1] if not isinstance(results[1], Exception) else [],
            "openrouter": results[2] if not isinstance(results[2], Exception) else [],
            "sambanova": results[3] if not isinstance(results[3], Exception) else [],
            "cerebras": results[4] if not isinstance(results[4], Exception) else [],
            "ollama": results[5] if not isinstance(results[5], Exception) else [],
            "nvidia": results[6] if not isinstance(results[6], Exception) else [],
            "openai": results[7] if not isinstance(results[7], Exception) else [],
            "opencode": results[8] if not isinstance(results[8], Exception) else [],
            "anthropic": results[9] if not isinstance(results[9], Exception) else [],
            "youtube1": results[10] if not isinstance(results[10], Exception) else []
        }
        
        # 6. NVIDIA Models (Dynamic fetch is now in results)
        pass

        # Log empty providers for debugging
        for p, m in models.items():
            if not m:
                logger.warning(f"[WARN] Provider [{p}] returned 0 models. Check API Keys.")
            else:
                logger.info(f"[OK] Provider [{p}] loaded {len(m)} models.")
        
        for p in models:
            if models[p]:
                models[p].sort(key=lambda x: x["label"])

        return models

    async def _fetch_openai_compatible_async(self, api_key, base_url, provider_name, fallback_models=[]):
        if not api_key: return fallback_models
        try:
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {api_key}"}
                async with session.get(f"{base_url}/models", headers=headers, timeout=10.0) as resp:
                    if resp.status != 200:
                        logger.error(f"Failed to fetch {provider_name} models: Status {resp.status}")
                        return fallback_models
                    
                    data = await resp.json()
                    fetched = []
                    
                    model_list = data.get("data", data) if isinstance(data, dict) else data
                    if not isinstance(model_list, list): return fallback_models

                    # Common mapping for popular models
                    mapping = {
                        "llama-3.3-70b-versatile": "Llama 3.3 70B",
                        "llama-3.1-8b-instant": "Llama 3.1 8B (Fast)",
                        "llama3-70b-8192": "Llama 3 70B",
                        "llama3-8b-8192": "Llama 3 8B",
                        "mixtral-8x7b-32768": "Mixtral 8x7B",
                        "gemma2-9b-it": "Gemma 2 9B",
                        "deepseek-v3": "DeepSeek V3",
                        "deepseek-r1": "DeepSeek R1 (Reasoning)",
                    }

                    for m in model_list:
                        mid = m.get("id") if isinstance(m, dict) else m
                        if not mid: continue
                        
                        lower_mid = mid.lower()
                        
                        # Provider-specific filtering
                        if provider_name == "groq" and not any(x in lower_mid for x in ["llama", "mixtral", "gemma", "whisper"]):
                             continue
                        if provider_name == "cerebras" and "llama" not in lower_mid:
                             continue
                        if provider_name == "sambanova" and not any(x in lower_mid for x in ["llama", "qwen"]):
                             continue
                        
                        clean_label = str(mid).replace("[FALLBACK]", "").replace("[TURBO]", "").replace("💎", "").replace("💲", "").strip()
                        
                        # Remove provider prefixes (e.g., 'meta/')
                        if "/" in clean_label:
                            clean_label = clean_label.split("/")[-1]
                        
                        # Apply mapping or format nicely
                        if clean_label.lower() in mapping:
                            clean_label = mapping[clean_label.lower()]
                        else:
                            clean_label = clean_label.replace("-", " ").replace("_", " ").title()
                        
                        # Append source info only if it's not redundant
                        if "free" in mid.lower() and "(Free)" not in clean_label: 
                            clean_label += " (Free)"
                        
                        fetched.append({"value": f"{provider_name}/{mid}", "label": clean_label})
                    
                    return fetched
        except Exception as e:
            logger.error(f"Async fetch failed for {provider_name}: {e}")
            return fallback_models

    async def _fetch_google_models_async(self) -> list:
        fallback = [
            {"value": "google/gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
            {"value": "google/gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
            {"value": "google/gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
            {"value": "google/gemini-1.5-flash", "label": "Gemini 1.5 Flash"},
            {"value": "google/gemini-1.5-pro", "label": "Gemini 1.5 Pro"},
        ]
        if not self.gemini_keys: 
            logger.warning("[FAIL] No Gemini keys found in LLMClient. Returning fallback models.")
            return fallback
        try:
            logger.info(f"📡 Fetching Google models using {len(self.gemini_keys)} keys...")
            client = self._get_gemini_client()
            goog_models = client.models.list(config={"page_size": 100})
            fetched = []
            for m in goog_models:
                mid = m.name.replace("models/", "")
                if "gemini" not in mid: continue
                if "vision" in mid: continue 
                fetched.append({"value": mid, "label": mid})
            logger.info(f"[OK] Successfully fetched {len(fetched)} Google models.")
            if not fetched:
                return fallback
            return fetched
        except Exception as e:
            logger.error(f"Failed to fetch Google models: {str(e)}")
            return fallback

    async def _fetch_groq_models_async(self) -> list:
        key = self.groq_keys[0] if self.groq_keys else None
        fallback = [
            {"value": "groq/llama-3.3-70b-versatile", "label": "Llama 3.3 70B (Groq)"},
            {"value": "groq/llama-3.1-8b-instant", "label": "Llama 3.1 8B (Fast) (Groq)"},
            {"value": "groq/mixtral-8x7b-32768", "label": "Mixtral 8x7B (Groq)"},
            {"value": "groq/gemma2-9b-it", "label": "Gemma 2 9B (Groq)"},
            {"value": "groq/deepseek-r1-distill-llama-70b", "label": "DeepSeek R1 Distill Llama 70B (Groq)"},
        ]
        return await self._fetch_openai_compatible_async(key, "https://api.groq.com/openai/v1", "groq", fallback_models=fallback)

    async def _fetch_openrouter_models_async(self) -> list:
        key = self.openrouter_keys[0] if self.openrouter_keys else None
        fallback = [
            {"value": "openrouter/google/gemini-2.0-flash-exp:free", "label": "Gemini 2.0 Flash Exp (Free)"},
            {"value": "openrouter/google/gemini-2.0-flash-lite-preview-02-05:free", "label": "Gemini 2.0 Flash Lite Preview (Free)"},
            {"value": "openrouter/deepseek/deepseek-r1:free", "label": "DeepSeek R1 (Free)"},
            {"value": "openrouter/deepseek/deepseek-chat:free", "label": "DeepSeek V3 (Free)"},
            {"value": "openrouter/meta-llama/llama-3.3-70b-instruct:free", "label": "Llama 3.3 70B (Free)"},
            {"value": "openrouter/qwen/qwen-2.5-72b-instruct:free", "label": "Qwen 2.5 72B (Free)"},
            {"value": "openrouter/openrouter/free", "label": "OpenRouter Free Auto-Router"},
        ]
        return await self._fetch_openai_compatible_async(key, "https://openrouter.ai/api/v1", "openrouter", fallback_models=fallback)

    async def _fetch_sambanova_models_async(self) -> list:
        key = self.sambanova_keys[0] if self.sambanova_keys else None
        fallback = [
            {"value": "sambanova/Meta-Llama-3.1-70B-Instruct", "label": "Llama 3.1 70B (SambaNova)"},
            {"value": "sambanova/Meta-Llama-3.3-70B-Instruct", "label": "Llama 3.3 70B (SambaNova)"},
            {"value": "sambanova/Qwen2.5-72B-Instruct", "label": "Qwen 2.5 72B (SambaNova)"},
            {"value": "sambanova/Qwen2.5-Coder-32B-Instruct", "label": "Qwen 2.5 Coder 32B (SambaNova)"},
        ]
        return await self._fetch_openai_compatible_async(key, "https://api.sambanova.ai/v1", "sambanova", fallback_models=fallback)

    async def _fetch_cerebras_models_async(self) -> list:
        key = self.cerebras_keys[0] if self.cerebras_keys else None
        fallback = [
            {"value": "cerebras/llama3.1-8b", "label": "Llama 3.1 8B (Cerebras)"},
            {"value": "cerebras/llama3.1-70b", "label": "Llama 3.1 70B (Cerebras)"},
        ]
        return await self._fetch_openai_compatible_async(key, "https://api.cerebras.ai/v1", "cerebras", fallback_models=fallback)

    async def _fetch_ollama_models_async(self) -> list:
        v1_url = self._get_ollama_v1_url()
        fallback = [
            {"value": "ollama/llama3", "label": "Llama 3 (Local)"},
            {"value": "ollama/mistral", "label": "Mistral (Local)"},
            {"value": "ollama/gemma", "label": "Gemma (Local)"},
            {"value": "ollama/qwen", "label": "Qwen (Local)"},
        ]
        return await self._fetch_openai_compatible_async("ollama", v1_url, "ollama", fallback_models=fallback)

    async def _fetch_nvidia_models_async(self) -> list:
        key = self.nvidia_keys[0] if self.nvidia_keys else None
        fallback = [
            {"value": "nvidia/meta/llama-3.3-70b-instruct", "label": "Llama 3.3 70B (NVIDIA)"},
            {"value": "nvidia/deepseek-ai/deepseek-r1", "label": "DeepSeek R1 (NVIDIA)"},
            {"value": "nvidia/nvidia/llama-3.1-nemotron-70b-instruct", "label": "Nemotron 70B (NVIDIA)"},
        ]
        return await self._fetch_openai_compatible_async(key, "https://integrate.api.nvidia.com/v1", "nvidia", fallback_models=fallback)

    async def _fetch_opencode_models_async(self) -> list:
        key = self.opencode_keys[0] if self.opencode_keys else None
        fallback = [
            {"value": "opencode/deepseek-v4-flash-free", "label": "DeepSeek V4 Flash (OpenCode Free)"},
            {"value": "opencode/nemotron-3-super-free", "label": "Nemotron 3 Super (OpenCode Free)"},
            {"value": "opencode/nemotron-3-ultra-free", "label": "Nemotron 3 Ultra (OpenCode Free)"},
            {"value": "opencode/qwen3.6-plus-free", "label": "Qwen 3.6 Plus (OpenCode Free)"},
            {"value": "opencode/minimax-m3-free", "label": "MiniMax M3 (OpenCode Free)"},
            {"value": "opencode/mimo-v2.5-free", "label": "Mimo 2.5 (OpenCode Free)"},
        ]
        if not key:
            return []
        return await self._fetch_openai_compatible_async(key, "https://opencode.ai/zen/v1", "opencode", fallback_models=fallback)

    async def _fetch_youtube1_models_async(self) -> list:
        key = self.youtube1_keys[0] if self.youtube1_keys else None
        fallback = [
            {"value": "youtube1/youtube1", "label": "YouTube1 (Local API)"},
        ]
        if not key:
            return []
        return await self._fetch_openai_compatible_async(key, "http://localhost:20128/v1", "youtube1", fallback_models=fallback)

    async def _fetch_openai_models_async(self) -> list:
        key = getattr(self.settings, "openai_api_key", None) or os.getenv("OPENAI_API_KEY")
        fallback = [
            {"value": "openai/gpt-4o", "label": "GPT-4o"},
            {"value": "openai/gpt-4o-mini", "label": "GPT-4o Mini"},
            {"value": "openai/o1-mini", "label": "o1-mini"},
            {"value": "openai/o3-mini", "label": "o3-mini"},
        ]
        if not key:
            return fallback
        return await self._fetch_openai_compatible_async(key, "https://api.openai.com/v1", "openai", fallback_models=fallback)

    async def _fetch_anthropic_models_async(self) -> list:
        return [
            {"value": "anthropic/claude-3-5-sonnet-20240620", "label": "Claude 3.5 Sonnet (v1)"},
            {"value": "anthropic/claude-3-5-sonnet-latest", "label": "Claude 3.5 Sonnet (Latest)"},
            {"value": "anthropic/claude-3-5-haiku-latest", "label": "Claude 3.5 Haiku"},
            {"value": "anthropic/claude-3-opus-latest", "label": "Claude 3 Opus"},
        ]

    def test_provider_connectivity(self, provider: str, base_url: str = None, api_key: str = None) -> dict:
        """
        Generic connectivity test for any provider.
        """
        try:
            # 1. Google/Gemini Special Case
            if provider == "google":
                target_key = api_key or (self.gemini_keys[0] if self.gemini_keys else None)
                if not target_key: return {"success": False, "message": "Google API 키가 설정되지 않았습니다."}
                
                temp_client = genai.Client(api_key=target_key)
                temp_client.models.list(config={"page_size": 1})
                return {"success": True, "message": "Google API 연결 성공!"}

            # 2. OpenAI Compatible Case (Groq, OpenRouter, SambaNova, Cerebras, NVIDIA, Ollama)
            # Map providers to their default base URLs if not provided
            default_urls = {
                "groq": "https://api.groq.com/openai/v1",
                "openrouter": "https://openrouter.ai/api/v1",
                "sambanova": "https://api.sambanova.ai/v1",
                "cerebras": "https://api.cerebras.ai/v1",
                "nvidia": "https://integrate.api.nvidia.com/v1",
                "opencode": "https://opencode.ai/zen/v1",
                "ollama": self._get_ollama_v1_url()
            }
            
            target_url = base_url or default_urls.get(provider)
            if not target_url: return {"success": False, "message": f"Provider {provider}의 URL을 알 수 없습니다."}
            
            # Map providers to their keys from settings if not provided
            if not api_key:
                key_map = {
                    "groq": self.groq_keys,
                    "openrouter": self.openrouter_keys,
                    "sambanova": self.sambanova_keys,
                    "cerebras": self.cerebras_keys,
                    "nvidia": self.nvidia_keys,
                    "opencode": self.opencode_keys,
                    "ollama": ["ollama"]
                }
                keys = key_map.get(provider, [])
                api_key = keys[0] if keys else None

            if not api_key: return {"success": False, "message": f"{provider} API 키가 설정되지 않았습니다."}

            temp_client = OpenAI(api_key=api_key, base_url=target_url)
            temp_client.models.list()
            return {"success": True, "message": f"{provider.capitalize()} 연결 성공!"}

        except Exception as e:
            return {"success": False, "message": parse_llm_error(e, provider)}
