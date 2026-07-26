import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class TextProcessor:
    """
    Sovereign Intelligence: Specialized TTS Text Normalizer.
    Handles multilingual linguistic interference and cleans scripts for high-fidelity synthesis.
    Supports KR, EN, JP as primary Day-1 targets.
    """
    
    def __init__(self):
        # Common patterns to remove from AI-generated scripts
        self.garbage_patterns = [
            r'\[.*?\]',        # [Background music], [Scene: ...]
            r'\(.*?\)',        # (Laughs), (Smiling)
            r'\*.*?\*',        # *Action markers*
            r'Narrator:',       # Speaker tags
            r'Voiceover:',
            r'Host:',
            r'AI:',
            r'^#.*$',           # Markdown headers
        ]
        
        # English expansions
        self.en_replacements = {
            "&": " and ",
            "%": " percent ",
            "$": " dollars ",
            "DR.": "Doctor",
            "MR.": "Mister",
            "MRS.": "Missus",
            "MS.": "Miss",
            "ST.": "Saint",
        }

    def clean_script(self, text: str) -> str:
        """Removes AI markers and scene descriptions."""
        cleaned = text
        for pattern in self.garbage_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.MULTILINE)
        
        # Remove extra whitespace and newlines
        cleaned = re.sub(r'\n+', ' ', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()

    def normalize_for_tts(self, text: str, lang: str = "ko") -> str:
        """
        Main entry point for TTS normalization.
        Tailors the text based on the target language.
        """
        text = self.clean_script(text)
        
        if not text:
            return ""

        lang = lang.lower()
        if lang in ["ko", "kr"]:
            return self._normalize_korean(text)
        elif lang in ["en", "us", "uk"]:
            return self._normalize_english(text)
        elif lang in ["ja", "jp"]:
            return self._normalize_japanese(text)
        
        return text

    def _normalize_korean(self, text: str) -> str:
        """Korean specific cleaning (handling numbers/symbols for natural delivery)."""
        # Remove special characters that cause TTS glitches but keep punctuation
        text = re.sub(r'[^\w\s\.,!\?\(\)\'\"]', '', text)
        return text

    def _normalize_english(self, text: str) -> str:
        """English specific expansion and cleanup."""
        for key, val in self.en_replacements.items():
            text = re.sub(re.escape(key), val, text, flags=re.IGNORECASE)
        return text

    def _normalize_japanese(self, text: str) -> str:
        """Japanese specific cleaning."""
        # Japanese TTS often handles Kanji/Hiragana well, but needs cleanup of unconventional markers
        text = re.sub(r'[・\s]+', ' ', text)
        return text

# Global instance
processor = TextProcessor()
