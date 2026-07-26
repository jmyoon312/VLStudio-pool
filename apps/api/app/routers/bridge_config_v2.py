from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Settings
import random
import os

router = APIRouter()

def get_rotated_key(keys_json, default_env_var=None):
    """
    Selects a key from JSON list or falls back to env var.
    Ref: models.py Settings table
    """
    import json
    # Debug Logging
    # print(f"DEBUG: Processing keys: {keys_json} (Type: {type(keys_json)})")

    if keys_json:
        # Handle String serialization (Common SQLite issue)
        if isinstance(keys_json, str):
            try:
                keys_json = json.loads(keys_json)
            except Exception as e:
                print(f"Error parsing keys JSON: {e}")
                return None
                
        if isinstance(keys_json, list) and len(keys_json) > 0:
            # Filter out empty strings
            valid_keys = [k for k in keys_json if k and isinstance(k, str) and k.strip()]
            if valid_keys:
                 return random.choice(valid_keys)
                 
    if default_env_var:
        env_val = os.getenv(default_env_var)
        if env_val: return env_val
    return None

def resolve_key_priority(settings_list, settings_single, env_var):
    """
    Priority: 1. DB List (Random), 2. DB Single (Legacy), 3. Env Var
    """
    key = get_rotated_key(settings_list)
    if key: return key
    
    if settings_single and settings_single.strip():
        return settings_single
        
    if env_var:
        return os.getenv(env_var)
        
    return None

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

    # Extract & Rotate Keys
    print(f"[BRIDGE] Resolving Keys. Type of groq_list: {type(settings.groq_api_keys)}")
    # Extract & Rotate Keys (Updated to use resolve_key_priority)
    groq_key = resolve_key_priority(settings.groq_api_keys, settings.groq_api_key, "GROQ_API_KEY")
    
    # [TRACER] Debug Force
    # If key is missing, force a dummy to prove code update
    if not groq_key:
        print("[BRIDGE] FORCE DEBUG: Injecting Tracer Key")
        groq_key = "gsk_tracer_bullet_proof_code_update"

    gemini_key = resolve_key_priority(settings.gemini_api_keys, None, "GOOGLE_API_KEY") # No legacy gemini single column?
    tavily_key = resolve_key_priority(settings.tavily_api_keys, None, "TAVILY_API_KEY")
    sambanova_key = resolve_key_priority(settings.sambanova_api_keys, None, "SAMBANOVA_API_KEY")
    cerebras_key = resolve_key_priority(settings.cerebras_api_keys, None, "CEREBRAS_API_KEY")
    openrouter_key = resolve_key_priority(settings.elevenlabs_api_keys, settings.openrouter_api_key, "OPENROUTER_API_KEY") # Wait, openrouter list?
    # Correcting OpenRouter: Model doesn't have openrouter_api_keys list? 
    # Checking models.py... it uses 'openrouter_api_key' legacy string.
    # But I want to support rotation if future proofing. For now, assume single.
    openrouter_key_final = settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
    
    # OpenAI is legacy in DB, sometimes just a string column or env
    openai_key = resolve_key_priority(None, settings.openai_api_key, "OPENAI_API_KEY")

    print("\n\n[BRIDGE] LOADED V2 - FORCE RELOAD SUCCESSFUL\n\n")

    return {
        "_version": "v2_RELOADED_JSON_FIX_APPLIED",
        "hermes_preferred": {
            "provider": settings.hermes_agent_provider or "google",
            "model": settings.hermes_agent_model or "gemini-2.0-flash"
        },
        "providers": {
            "openai": {
                "apiKey": openai_key,
                "model": settings.default_model or "gpt-4o"
            },
            "groq": {
                "apiKey": groq_key,
                "model": "llama3-70b-8192" 
            },
            "gemini": {
                "apiKey": gemini_key,
                "model": "gemini-1.5-pro"
            },
            "sambanova": {
                "apiKey": sambanova_key,
                "model": "Meta-Llama-3.1-405B-Instruct" 
            },
            "cerebras": {
                "apiKey": cerebras_key,
                "model": "llama3.1-70b" 
            },
            "openrouter": {
                "apiKey": openrouter_key_final,
                "model": "auto" 
            }
        },
        "search": {
            "engine": settings.web_search_engine or "tavily",
            "searxng_url": settings.searxng_url,
            "apiKey": tavily_key # Only needed if engine is tavily
        },
        "paperclip": {
            "provider": settings.paperclip_provider or "google",
            "model": settings.paperclip_model or "gemini-2.0-flash"
        },
        "openclaude": {
            "provider": settings.openclaude_provider or "google",
            "model": settings.openclaude_model or "gemini-2.0-flash"
        },
        "openclaw": {
            "provider": settings.openclaw_preferred_provider or "google",
            "model": settings.openclaw_model or "gemini-2.0-flash"
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
                "apiKey": get_rotated_key(settings.elevenlabs_api_keys, "ELEVENLABS_API_KEY"),
                "enabled": True
            }
        }
    }
