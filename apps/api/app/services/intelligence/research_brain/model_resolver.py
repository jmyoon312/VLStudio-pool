"""Resolve the user's configured AI provider/model from Settings.

The dashboard lets users pick an agent provider/model (OpenClaw), plus fallbacks
for hermes / script analysis / a global default. Research jobs must honor that
selection instead of hardcoding a model. Mirrors OracleScout._get_agent_model so
behavior is consistent across the app.
"""
from __future__ import annotations

# Used only when the user has configured nothing at all.
_LAST_RESORT_MODEL = "google/gemini-2.0-flash"


def resolve_agent_model(settings) -> str:
    """Return the model id (optionally provider-prefixed) the user configured.

    Priority: openclaw_model -> hermes_agent_model -> script_analysis_model ->
    default_model -> last-resort default. If a non-"auto" provider is selected and
    the model id has no provider prefix, prefix it (e.g. "groq/llama-3.3-70b").
    """
    model_name = (
        getattr(settings, "openclaw_model", None)
        or getattr(settings, "hermes_agent_model", None)
        or getattr(settings, "script_analysis_model", None)
        or getattr(settings, "default_model", None)
        or _LAST_RESORT_MODEL
    )
    model_name = str(model_name).strip()
    if not model_name:
        model_name = _LAST_RESORT_MODEL

    # Already provider-qualified (e.g. "openrouter/...", "google/...").
    if "/" in model_name:
        return model_name

    provider = getattr(settings, "openclaw_preferred_provider", "auto") or "auto"
    provider = str(provider).strip().lower()
    if provider and provider != "auto":
        return f"{provider}/{model_name}"
    return model_name
