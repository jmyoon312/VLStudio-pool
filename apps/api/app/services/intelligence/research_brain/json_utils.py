"""Robust JSON extraction from LLM responses.

LLMs wrap JSON in prose, markdown fences, or emit trailing commas. These helpers
pull the first valid JSON array/object out of a noisy string.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional


def _strip_fences(text: str) -> str:
    if "```json" in text:
        text = text.split("```json", 1)[1]
        text = text.split("```", 1)[0]
    elif "```" in text:
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
    return text


def _remove_trailing_commas(text: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", text)


def parse_json_loose(text: str) -> Optional[Any]:
    """Best-effort parse of a JSON value embedded in an LLM response.

    Returns the parsed object/list, or None if nothing parseable is found.
    """
    if text is None:
        return None
    if not isinstance(text, str):
        # Already-structured responses pass straight through.
        return text

    candidate = _strip_fences(text).strip()

    # Direct attempt first.
    for attempt in (candidate, _remove_trailing_commas(candidate)):
        try:
            return json.loads(attempt)
        except (json.JSONDecodeError, ValueError):
            pass

    # Fall back to the widest array or object span in the text.
    for pattern in (r"\[.*\]", r"\{.*\}"):
        m = re.search(pattern, candidate, re.DOTALL)
        if m:
            span = _remove_trailing_commas(m.group(0))
            try:
                return json.loads(span)
            except (json.JSONDecodeError, ValueError):
                continue
    return None


def parse_json_list(text: str) -> list:
    """Parse and coerce an LLM response into a list of dicts."""
    parsed = parse_json_loose(text)
    if parsed is None:
        return []
    if isinstance(parsed, dict):
        return [parsed]
    if isinstance(parsed, list):
        return parsed
    return []
