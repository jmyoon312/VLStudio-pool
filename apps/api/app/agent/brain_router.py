import logging
import os
from typing import Dict, Any, Optional
from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger("brain_router")

class PluggableBrainRouter:
    """
    Routes reasoning requests to different LLM providers (OpenClaude, GPT-4o, Local Hermes)
    acting as the 'Pluggable Brain' for ViraLoop Studio.
    Dynamically loads credentials and configurations from DB Settings.
    """
    def __init__(self):
        self.active_brain_id = "openclaude"
        self._brains_cache = {}

    def clear_cache(self):
        """Clears the cached LangChain model instances."""
        self._brains_cache.clear()
        logger.info("🧹 [BrainRouter] Cached brain instances cleared.")

    def switch_brain(self, brain_id: str) -> bool:
        """Switches the active cognitive core."""
        self.active_brain_id = brain_id
        logger.info(f"🧠 System Brain Switched to: {brain_id.upper()}")
        # Pre-initialize and cache the brain to verify it can load
        llm = self._init_brain(brain_id)
        if llm:
            self._brains_cache[brain_id] = llm
            return True
        return False

    def get_active_llm(self) -> BaseChatModel:
        """Returns the currently active LangChain BaseChatModel."""
        if self.active_brain_id in self._brains_cache:
            return self._brains_cache[self.active_brain_id]

        llm = self._init_brain(self.active_brain_id)
        if llm:
            self._brains_cache[self.active_brain_id] = llm
            return llm

        # Fallback to load any working cached brain if the active one fails
        for b_id, b_llm in self._brains_cache.items():
            if b_llm:
                logger.warning(f"[WARN] Active brain {self.active_brain_id} failed. Falling back to cached brain {b_id}.")
                return b_llm

        raise ValueError(f"Failed to initialize brain '{self.active_brain_id}' and no cached fallbacks are available. Please configure API keys in Settings.")

    def _init_brain(self, brain_id: str) -> Optional[BaseChatModel]:
        # Fetch DB Settings dynamically to pick up UI changes
        try:
            from app import database, crud
            db = database.SessionLocal()
            try:
                settings = crud.get_settings(db)
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Could not read settings from database: {e}. Falling back to default environment config.")
            settings = None

        if not settings:
            # Fallback to env-based initialization
            logger.info("Initializing env-based fallback for brain router")
            if brain_id == "openclaude":
                return self._create_langchain_model("anthropic", "claude-3-5-sonnet-20240620", None)
            elif brain_id == "gpt4o":
                return self._create_langchain_model("openai", "gpt-4o", None)
            elif brain_id == "hermes":
                return self._create_langchain_model("ollama", "hermes-v3", None)
            elif brain_id == "openhands":
                return self._create_langchain_model("anthropic", "claude-3-5-sonnet-20240620", None)
            return None

        # Resolve provider and model based on active brain ID
        if brain_id == "openclaude":
            provider = settings.openclaude_provider or "google"
            model_name = settings.openclaude_model or "gemini-2.0-flash"
        elif brain_id == "gpt4o":
            provider = "openai"
            model_name = "gpt-4o"
        elif brain_id == "hermes":
            provider = settings.hermes_agent_provider or "nvidia"
            model_name = settings.hermes_agent_model or "hermes-v3"
        elif brain_id == "openhands":
            # For OpenHands, typically default to openclaude settings or sonnet
            provider = settings.openclaude_provider or "anthropic"
            model_name = settings.openclaude_model or "claude-3-5-sonnet-20240620"
        else:
            provider = settings.openclaude_provider or "google"
            model_name = settings.openclaude_model or "gemini-2.0-flash"

        return self._create_langchain_model(provider, model_name, settings)

    def _create_langchain_model(self, provider: str, model_name: str, settings, api_key: str = None) -> Optional[BaseChatModel]:
        from langchain_openai import ChatOpenAI
        from langchain_anthropic import ChatAnthropic

        provider = provider.lower()
        logger.info(f"🧠 Initializing LangChain model: {provider}/{model_name}")

        try:
            if provider == "google" or provider == "gemini":
                from langchain_google_genai import ChatGoogleGenerativeAI
                if not api_key:
                    if settings and settings.gemini_api_keys:
                        api_key = settings.gemini_api_keys[0]
                if not api_key:
                    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatGoogleGenerativeAI(
                    model=clean_model,
                    google_api_key=api_key,
                    temperature=0.7
                )

            elif provider == "groq":
                if not api_key:
                    if settings:
                        if settings.groq_api_keys:
                            api_key = settings.groq_api_keys[0]
                        elif hasattr(settings, "groq_api_key") and settings.groq_api_key:
                            api_key = settings.groq_api_key
                if not api_key:
                    api_key = os.getenv("GROQ_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key=api_key,
                    openai_api_base="https://api.groq.com/openai/v1",
                    temperature=0.7
                )

            elif provider == "openrouter":
                api_key = None
                if settings:
                    if settings.openrouter_api_keys:
                        api_key = settings.openrouter_api_keys[0]
                    elif hasattr(settings, "openrouter_api_key") and settings.openrouter_api_key:
                        api_key = settings.openrouter_api_key
                if not api_key:
                    api_key = os.getenv("OPENROUTER_API_KEY")
                
                clean_model = model_name
                if clean_model.startswith("openrouter/"):
                    clean_model = clean_model.replace("openrouter/", "", 1)
                
                return ChatOpenAI(
                    model=clean_model if clean_model.lower() != "free" else "google/gemini-2.0-flash-lite-preview-02-05:free",
                    openai_api_key=api_key,
                    openai_api_base="https://openrouter.ai/api/v1",
                    default_headers={
                        "HTTP-Referer": "https://github.com/ViraLoop",
                        "X-Title": "ViraLoop"
                    },
                    temperature=0.7
                )

            elif provider == "sambanova":
                api_key = None
                if settings and settings.sambanova_api_keys:
                    api_key = settings.sambanova_api_keys[0]
                if not api_key:
                    api_key = os.getenv("SAMBANOVA_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key=api_key,
                    openai_api_base="https://api.sambanova.ai/v1",
                    temperature=0.7
                )

            elif provider == "cerebras":
                api_key = None
                if settings and settings.cerebras_api_keys:
                    api_key = settings.cerebras_api_keys[0]
                if not api_key:
                    api_key = os.getenv("CEREBRAS_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key=api_key,
                    openai_api_base="https://api.cerebras.ai/v1",
                    temperature=0.7
                )

            elif provider == "nvidia":
                api_key = None
                if settings and hasattr(settings, "nvidia_api_keys") and settings.nvidia_api_keys:
                    api_key = settings.nvidia_api_keys[0]
                if not api_key:
                    api_key = os.getenv("NVIDIA_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key=api_key,
                    openai_api_base="https://integrate.api.nvidia.com/v1",
                    temperature=0.7
                )

            elif provider == "ollama":
                raw_url = getattr(settings, "ollama_api_base_url", "http://127.0.0.1:11434/v1") if settings else "http://127.0.0.1:11434/v1"
                clean_url = str(raw_url).strip().rstrip("/")
                v1_url = clean_url if clean_url.endswith("/v1") else f"{clean_url}/v1"
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key="ollama",
                    openai_api_base=v1_url,
                    temperature=0.7
                )

            elif provider == "openai":
                api_key = getattr(settings, "openai_api_key", None) if settings else None
                if not api_key:
                    api_key = os.getenv("OPENAI_API_KEY")
                
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatOpenAI(
                    model=clean_model,
                    openai_api_key=api_key,
                    temperature=0.7
                )

            elif provider == "anthropic":
                api_key = os.getenv("ANTHROPIC_API_KEY")
                clean_model = model_name.split("/", 1)[1] if "/" in model_name else model_name
                return ChatAnthropic(
                    model_name=clean_model,
                    api_key=api_key,
                    temperature=0.7
                )

            else:
                logger.warning(f"[WARN] Unsupported LangChain provider: {provider}. Falling back to default OpenAI format.")
                # Fallback to direct ChatOpenAI
                return ChatOpenAI(model=model_name, temperature=0.7)

        except Exception as e:
            logger.error(f"[FAIL] Failed to initialize LangChain model for provider '{provider}': {e}")
            return None

# Singleton instance
brain_router = PluggableBrainRouter()
