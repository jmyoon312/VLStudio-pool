from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Settings
import random
import os
import time

router = APIRouter()

def get_all_keys(keys_json, default_env_var=None):
    """
    Returns all valid keys from JSON list and env var.
    """
    import json
    all_keys = []
    
    if keys_json:
        if isinstance(keys_json, str):
            try:
                keys_json = json.loads(keys_json)
            except:
                keys_json = []
                
        if isinstance(keys_json, list):
            all_keys.extend([k for k in keys_json if k and isinstance(k, str) and k.strip()])
                 
    if default_env_var:
        env_val = os.getenv(default_env_var)
        if env_val and env_val not in all_keys:
            all_keys.append(env_val)
            
    return list(dict.fromkeys(all_keys))  # Deduplicate

def resolve_all_keys(settings_list, settings_single, env_var, fallback_list=None):
    """
    Combines DB List, DB Single, Env Var, and optionally a fallback list into unique keys.
    """
    keys = get_all_keys(settings_list)
    
    if settings_single and settings_single.strip() and settings_single not in keys:
        keys.append(settings_single)
        
    if env_var:
        env_val = os.getenv(env_var)
        if env_val and env_val not in keys:
            keys.append(env_val)

    if fallback_list and isinstance(fallback_list, list):
        for k in fallback_list:
            if k and k not in keys:
                keys.append(k)
            
    return list(dict.fromkeys(keys))

def get_current_settings_fallback():
    """Reads current_settings.json for direct key fallback if DB is out of sync."""
    import json
    try:
        settings_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "current_settings.json")
        if os.path.exists(settings_path):
            with open(settings_path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[BRIDGE] Fallback check failed: {e}")
    return {}

@router.get("/ai-config")
async def get_bridge_ai_config(db: Session = Depends(get_db)):
    """
    Consolidated AI Config for ClawDBot.
    Fetches keys from DB Settings (w/ rotation) or Env.
    """
    settings = db.query(Settings).first()
    if not settings:
        print("[BRIDGE] Error: No Settings found in DB!")
        # Fallback if DB not initialized
        return {
            "_version": "v_fix_json_parse (Fallback)",
            "providers": {
                "openai": {"apiKey": os.getenv("OPENAI_API_KEY"), "model": "gpt-4o"},
                "groq": {"apiKey": os.getenv("GROQ_API_KEY"), "model": "llama3-70b-8192"},
                "gemini": {"apiKey": os.getenv("GOOGLE_API_KEY"), "model": "gemini-1.5-pro"}
            },
            "search": {
                "engine": "tavily",  # Default fallback
                "apiKey": os.getenv("TAVILY_API_KEY")
            }
        }

    # Load Fallback Settings from JSON (Sync-as-you-go)
    fallback = get_current_settings_fallback()

    # Extract All Available Keys for Agent-side Rotation & Fallback
    groq_keys = resolve_all_keys(settings.groq_api_keys, settings.groq_api_key, "GROQ_API_KEY", fallback.get("groq_api_keys"))
    gemini_keys = resolve_all_keys(settings.gemini_api_keys, None, "GOOGLE_API_KEY", fallback.get("gemini_api_keys")) 
    tavily_keys = resolve_all_keys(settings.tavily_api_keys, None, "TAVILY_API_KEY")
    sambanova_keys = resolve_all_keys(settings.sambanova_api_keys, None, "SAMBANOVA_API_KEY", fallback.get("sambanova_api_keys"))
    cerebras_keys = resolve_all_keys(settings.cerebras_api_keys, None, "CEREBRAS_API_KEY", fallback.get("cerebras_api_keys"))
    openrouter_keys = resolve_all_keys(None, settings.openrouter_api_key, "OPENROUTER_API_KEY")
    openai_keys = resolve_all_keys(None, settings.openai_api_key, "OPENAI_API_KEY")

    print(f"[BRIDGE] Serving Full AI Config. Providers: {[p for p, k in [('groq', groq_keys), ('gemini', gemini_keys), ('cerebras', cerebras_keys)] if k]}")

    return {
        "_version": f"v5_MULTI_MODEL_{int(time.time())}",
        "providers": {
            "openai": {
                "apiKeys": openai_keys,
                "model": settings.default_model or "gpt-4o",
                "fallbackModels": ["gpt-4o-mini"]
            },
            "groq": {
                "apiKeys": groq_keys,
                "model": "llama-3.3-70b-versatile",
                "fallbackModels": ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
            },
            "gemini": {
                "apiKeys": gemini_keys,
                "model": "gemini-1.5-flash",
                "fallbackModels": ["gemini-1.5-pro", "gemini-2.0-flash-exp"]
            },
            "sambanova": {
                "apiKeys": sambanova_keys,
                "model": "Meta-Llama-3.1-405B-Instruct",
                "fallbackModels": ["Meta-Llama-3.1-70B-Instruct", "Meta-Llama-3.1-8B-Instruct"]
            },
            "cerebras": {
                "apiKeys": cerebras_keys,
                "model": "llama-3.1-70b",
                "fallbackModels": ["llama-3.1-8b"]
            },
            "openrouter": {
                "apiKeys": openrouter_keys,
                "model": "google/gemini-2.0-flash-001",
                "fallbackModels": ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-405b"]
            }
        },
        "search": {
            "engine": settings.web_search_engine or "tavily",
            "searxng_url": settings.searxng_url,
            "apiKeys": tavily_keys 
        },
        "preferences": {
            "openclaw_provider": getattr(settings, "openclaw_preferred_provider", "auto"),
            "openclaw_model": getattr(settings, "openclaw_model", None)
        }
    }

@router.get("/voice-config")
async def get_bridge_voice_config(db: Session = Depends(get_db)):
    """
    Returns simplified Voice Config for Agent.
    """
    settings = db.query(Settings).first()
    if not settings:
        return {"engine": "internal", "url": None}

    return {
        "engine": "auto", # Agent can request 'auto' to let Backend decide
        "providers": {
            "kokoro": {
                "url": settings.kokoro_tts_url,
                "enabled": True
            },
            "qwen": {
                "url": settings.qwen_tts_url,
                "enabled": bool(settings.qwen_tts_url)
            },
            "elevenlabs": {
                "apiKeys": get_all_keys(settings.elevenlabs_api_keys, "ELEVENLABS_API_KEY"),
                "enabled": True
            }
        }
    }
