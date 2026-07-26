"""Unit tests for loose JSON parsing of LLM responses."""
import os
import sys

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)

from app.services.intelligence.research_brain.json_utils import (  # noqa: E402
    parse_json_loose,
    parse_json_list,
)


def test_plain_json_array():
    assert parse_json_loose('[1, 2, 3]') == [1, 2, 3]


def test_json_in_markdown_fence():
    text = 'Here you go:\n```json\n[{"a": 1}]\n```\nDone.'
    assert parse_json_loose(text) == [{"a": 1}]


def test_generic_fence_without_lang():
    text = '```\n{"x": 5}\n```'
    assert parse_json_loose(text) == {"x": 5}


def test_trailing_commas_recovered():
    text = '[{"a": 1,}, {"b": 2,},]'
    assert parse_json_loose(text) == [{"a": 1}, {"b": 2}]


def test_json_embedded_in_prose():
    text = 'The result is [{"claim": "hi"}] according to my analysis.'
    assert parse_json_loose(text) == [{"claim": "hi"}]


def test_returns_none_for_garbage():
    assert parse_json_loose("no json at all here") is None


def test_none_input():
    assert parse_json_loose(None) is None


def test_parse_json_list_wraps_dict():
    assert parse_json_list('{"a": 1}') == [{"a": 1}]


def test_parse_json_list_empty_on_garbage():
    assert parse_json_list("nothing") == []


def test_non_string_passthrough():
    assert parse_json_loose([{"a": 1}]) == [{"a": 1}]
