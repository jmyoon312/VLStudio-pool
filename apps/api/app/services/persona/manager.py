import logging
import json
import os
from sqlalchemy.orm import Session
from ... import models

logger = logging.getLogger(__name__)

class PersonaManager:
    """
    Manages identity presets for autonomous channels.
    Ensures consistent branding, voice, and visual style for each persona.
    v6.0: Loads from a centralized Persona Registry.
    """
    def __init__(self, db: Session):
        self.db = db
        # Adjusted path to find the sibling file in the same directory
        self.library_path = os.path.join(os.path.dirname(__file__), "persona_library.json")
        self._load_library()

    def _load_library(self):
        try:
            if os.path.exists(self.library_path):
                with open(self.library_path, "r", encoding="utf-8") as f:
                    self.library = json.load(f)
            else:
                # Fallback path check (sometimes it might be in current dir)
                logger.warning(f"[WARN] Persona library not found at {self.library_path}. Using empty fallback.")
                self.library = {"niches": []}
        except Exception as e:
            logger.error(f"[FAIL] Failed to load persona library: {e}")
            self.library = {"niches": []}

    def get_persona_config(self, channel_id: int) -> dict:
        """
        Retrieves the full production configuration for a specific channel persona.
        Matches niche names from the database to the Persona Library.
        """
        channel = self.db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
        if not channel:
            return self._get_default_config()

        # [NEW] Dynamic Niche Matching
        target_niche = (channel.title or "").lower()
        matched_niche = None
        
        # Simple heuristic matching
        for niche in self.library.get("niches", []):
            if niche["id"] in target_niche or any(hook.lower() in target_niche for hook in niche.get("hooks", [])):
                matched_niche = niche
                break
        
        if not matched_niche:
            # Fallback to senior if no match for the user's focus
            matched_niche = next((n for n in self.library.get("niches", []) if n["id"] == "senior_care"), None)

        if not matched_niche:
            return self._get_default_config()

        return {
            "channel_name": channel.title,
            "persona_name": matched_niche.get("display_name"),
            "tone_of_voice": matched_niche.get("vibe", "informative"),
            "tts_config": {
                "engine": "edge",
                "voice_id": "ko-KR-SunHiNeural" if "senior" in target_niche else "ko-KR-InJoonNeural",
                "rate": 0,
                "pitch": 0
            },
            "visual_style": {
                "template": matched_niche.get("remotion_template", "blur_bg"),
                "typography": matched_niche.get("typography"),
                "pacing": matched_niche.get("pacing", "Moderate"),
                "motion_speed": 1.5 if matched_niche.get("pacing") == "Fast" else 1.2
            },
            "stealth_required": True if (channel.warmup_stage or 0) < 30 else False,
            "trust_score": channel.trust_score or 0,
            "autonomy_status": channel.autonomy_status or "MANUAL"
        }

    def _get_default_config(self):
        return {
            "tone_of_voice": "general",
            "tts_config": {"engine": "edge", "voice_id": "ko-KR-SunHiNeural"},
            "visual_style": {"template": "portrait_9_16"}
        }
