import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class TextProcessorService:
    """
    Multilingual Text Normalizer for high-fidelity TTS output.
    Cleans up linguistic interference and localizes formatting.
    """

    def __init__(self):
        # Specific patterns for different languages
        self.patterns = {
            "ko": [
                (r'\d+', self._number_to_ko), # Simple number conversion placeholder
                (r'[^\w\s가-힣?.!,]', ''),     # Remove non-Korean symbols
            ],
            "en": [
                (r'\$([\d,]+)', r'\1 dollars'), # Format currency
                (r'(\d+)%', r'\1 percent'),
            ],
            "ja": [
                (r'[^\w\sぁ-んァ-ン一-龥?.!,]', ''), # Japanese specific cleanup
            ]
        }

    def _number_to_ko(self, match):
        # Basic placeholder for number conversion
        return match.group(0)

    def normalize(self, text: str, lang: str = "en") -> str:
        """
        Normalizes text based on target language.
        """
        if not text:
            return ""

        processed_text = text
        
        # 1. Basic Cleaning (Universal)
        processed_text = processed_text.replace('\n', ' ').strip()
        processed_text = re.sub(r'\s+', ' ', processed_text)

        # 2. Language-Specific Normalization
        lang_patterns = self.patterns.get(lang, [])
        for pattern, replacement in lang_patterns:
            if callable(replacement):
                processed_text = re.sub(pattern, replacement, processed_text)
            else:
                processed_text = re.sub(pattern, replacement, processed_text)

        logger.debug(f"Normalized text ({lang}): {processed_text}")
        return processed_text

text_processor = TextProcessorService()
