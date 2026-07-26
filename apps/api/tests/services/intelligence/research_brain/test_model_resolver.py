"""Unit tests for resolve_agent_model — honoring the user's configured provider."""
import os
import sys
import types

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.model_resolver import resolve_agent_model  # noqa: E402


def S(**kwargs):
    """Build a settings-like object; absent attrs return None via getattr default."""
    obj = types.SimpleNamespace()
    for k in ("openclaw_model", "openclaw_preferred_provider", "hermes_agent_model",
              "script_analysis_model", "default_model"):
        setattr(obj, k, kwargs.get(k, None))
    return obj


def test_prefers_openclaw_model():
    s = S(openclaw_model="claude-opus-4-8", openclaw_preferred_provider="auto",
          script_analysis_model="opencode/deepseek-v4-flash-free")
    assert resolve_agent_model(s) == "claude-opus-4-8"


def test_prefixes_provider_when_not_auto_and_no_slash():
    s = S(openclaw_model="llama-3.3-70b-versatile", openclaw_preferred_provider="groq")
    assert resolve_agent_model(s) == "groq/llama-3.3-70b-versatile"


def test_does_not_double_prefix_when_model_has_slash():
    s = S(openclaw_model="openrouter/anthropic/claude", openclaw_preferred_provider="openrouter")
    assert resolve_agent_model(s) == "openrouter/anthropic/claude"


def test_auto_provider_returns_model_as_is():
    s = S(openclaw_model="gpt-4o", openclaw_preferred_provider="auto")
    assert resolve_agent_model(s) == "gpt-4o"


def test_falls_back_through_chain():
    s = S(openclaw_model=None, hermes_agent_model=None,
          script_analysis_model="opencode/deepseek-v4-flash-free")
    assert resolve_agent_model(s) == "opencode/deepseek-v4-flash-free"


def test_falls_back_to_default_model():
    s = S(script_analysis_model=None, default_model="google/gemini-2.0-flash")
    assert resolve_agent_model(s) == "google/gemini-2.0-flash"


def test_last_resort_when_nothing_configured():
    s = S()
    assert resolve_agent_model(s) == "google/gemini-2.0-flash"


def test_provider_prefix_with_default_model_no_slash():
    s = S(openclaw_model=None, script_analysis_model="my-model", openclaw_preferred_provider="cerebras")
    assert resolve_agent_model(s) == "cerebras/my-model"
