import os
import random
import json
from pathlib import Path

# LLM backend selection (mirrors llm.py for direct callers)
_LLM_BACKEND = os.environ.get("LLM_BACKEND", "gemini").strip().lower()
_YOUTUBE1_API_KEY = os.environ.get("YOUTUBE1_API_KEY", "")
_YOUTUBE1_BASE_URL = os.environ.get("YOUTUBE1_BASE_URL", "http://localhost:20128/v1")
_YOUTUBE1_MODEL = os.environ.get("YOUTUBE1_MODEL", "youtube1")


def get_gemini_key() -> str:
    """Get a random Gemini API key from the environment or .env file. Supports comma-separated keys.
    When LLM_BACKEND=youtube1, returns an empty string to prevent direct Gemini usage;
    direct callers should use call_gemini() instead for proper routing."""
    if _LLM_BACKEND == "youtube1":
        return ""
    keys_str = os.environ.get("GEMINI_API_KEY", "")
    if not keys_str:
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    keys_str = line.split("=", 1)[1].strip()
                    break
    if not keys_str:
        return ""
    keys = [k.strip() for k in keys_str.split(",") if k.strip()]
    return random.choice(keys) if keys else ""


async def call_gemini(url: str, payload: dict, headers: dict = None,
                      timeout: float = 180.0) -> dict:
    """Route Gemini API call based on LLM_BACKEND.
    When youtube1, converts Gemini payload (including vision inline_data) to
    OpenAI multimodal format and sends to 9router."""
    if _LLM_BACKEND == "youtube1":
        import httpx
        import base64 as _b64

        gen_config = payload.get("generationConfig", {})
        max_tokens = gen_config.get("maxOutputTokens", 16384)
        temperature = gen_config.get("temperature", 0.3)

        system_parts = (payload.get("systemInstruction", {}) or {}).get("parts", [])
        system = " ".join(p.get("text", "") for p in system_parts) if system_parts else ""

        messages = []
        if system:
            messages.append({"role": "system", "content": system})

        contents = payload.get("contents", [])
        for c in contents:
            parts = (c.get("parts", []) if isinstance(c, dict) else [])
            text_parts = []
            image_parts = []
            for p in parts:
                if isinstance(p, dict):
                    if "text" in p:
                        text_parts.append(p["text"])
                    if "inline_data" in p:
                        mime = p["inline_data"].get("mime_type", "image/jpeg")
                        data = p["inline_data"].get("data", "")
                        image_parts.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{data}"}
                        })
                    if "file_data" in p:
                        file_uri = p["file_data"].get("file_uri", "")
                        mime = p["file_data"].get("mime_type", "video/mp4")
                        if file_uri.startswith("data:"):
                            image_parts.append({
                                "type": "image_url",
                                "image_url": {"url": file_uri}
                            })
                        elif file_uri:
                            text_parts.append(f"[첨부파일: {file_uri}]")

            if image_parts:
                content = []
                joined_text = " ".join(text_parts)
                if joined_text:
                    content.append({"type": "text", "text": joined_text})
                content.extend(image_parts)
                messages.append({"role": "user", "content": content})
            else:
                joined_text = " ".join(text_parts)
                messages.append({"role": "user", "content": joined_text or json.dumps(payload)})

        body = {
            "model": _YOUTUBE1_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if gen_config.get("responseMimeType") == "application/json":
            body["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                f"{_YOUTUBE1_BASE_URL}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {_YOUTUBE1_API_KEY}",
                         "Content-Type": "application/json"},
            )
            r.raise_for_status()
            data = r.json()
        choice = data.get("choices", [{}])[0]
        text = choice.get("message", {}).get("content", "")
        return {
            "candidates": [{"content": {"parts": [{"text": text}]}}],
            "usageMetadata": {"totalTokenCount": (data.get("usage", {}) or {}).get("total_tokens", 0)},
        }
    # Default: call Gemini API directly
    import httpx
    _headers = dict(headers or {})
    if "x-goog-api-key" not in _headers:
        key = get_gemini_key()
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set and LLM_BACKEND is not youtube1")
        _headers["x-goog-api-key"] = key
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, json=payload, headers=_headers)
        r.raise_for_status()
        return r.json()
