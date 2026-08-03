import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

PRESET_FILE = os.path.join(os.path.dirname(__file__), "tts_presets.json")

class TTSPresetManager:
    """
    Manages a persistent registry of TTS voice presets mapping to personas.
    Ensures that if 'Speaker A' is a '70s Grandma', they use the exact same voice ID consistently.
    Auto-registers new personas if they don't exist.
    Supports advanced config: { "voice_id": str, "speed": float, "pitch": int, "rvc_model": str | None }
    """
    def __init__(self):
        self.presets = self._load_presets()
        self.session_cache = {} # Caches speaker mappings for a single video session

    def _load_presets(self) -> Dict[str, Any]:
        loaded_data = None
        if os.path.exists(PRESET_FILE):
            try:
                with open(PRESET_FILE, "r", encoding="utf-8") as f:
                    loaded_data = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load TTS presets: {e}")
        
        # Default fallback registry with refined granularity (Supertone Local defaults)
        defaults = {
            "narrator": {"voice_id": "supertone-local/M2", "speed": 1.0, "pitch": 0, "rvc_model": None},
            
            "male_child": {"voice_id": "supertone-local/M3", "speed": 1.1, "pitch": 1, "rvc_model": None},
            "male_20s": {"voice_id": "supertone-local/M1", "speed": 1.0, "pitch": 0, "rvc_model": None},
            "male_40s_50s": {"voice_id": "supertone-local/M2", "speed": 0.9, "pitch": -1, "rvc_model": None}, 
            "male_70s": {"voice_id": "supertone-local/M4", "speed": 0.8, "pitch": 0, "rvc_model": None},
            
            "female_child": {"voice_id": "supertone-local/F3", "speed": 1.1, "pitch": 1, "rvc_model": None},
            "female_20s": {"voice_id": "supertone-local/F1", "speed": 1.0, "pitch": 0, "rvc_model": None},
            "female_40s_50s": {"voice_id": "supertone-local/F2", "speed": 0.9, "pitch": -1, "rvc_model": None},
            "female_70s": {"voice_id": "supertone-local/F4", "speed": 0.8, "pitch": 0, "rvc_model": None}
        }
        
        if loaded_data:
            # Migrate old string format to dict format
            for k, v in loaded_data.items():
                if isinstance(v, str):
                    defaults[k] = {"voice_id": v, "speed": 1.0, "pitch": 0, "rvc_model": None}
                elif isinstance(v, dict):
                    # Ensure rvc_model exists
                    if "rvc_model" not in v:
                        v["rvc_model"] = None
                    defaults[k] = v
                    
        return defaults

    def update_presets(self, category: str, voice_id: str, speed: float, pitch: int, rvc_model: str = None):
        self.presets[category] = {
            "voice_id": voice_id,
            "speed": speed,
            "pitch": pitch,
            "rvc_model": rvc_model
        }
        self._save_presets()

    def _save_presets(self):
        try:
            with open(PRESET_FILE, "w", encoding="utf-8") as f:
                json.dump(self.presets, f, indent=4, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save TTS presets: {e}")

    def get_voice_for_speaker(self, speaker: str, persona_meta: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        """
        Retrieves or assigns a consistent voice config for a speaker within a session.
        Returns a dict containing voice_id, speed, and pitch.
        """
        cache_key = f"{session_id}_{speaker}"
        
        # 1. Check if we already assigned a voice to this speaker in this video session
        if cache_key in self.session_cache:
            return self.session_cache[cache_key]

        # 2. Determine Persona Category based on AI metadata
        if "나레이션" in speaker or "해설" in speaker:
            category = "narrator"
        else:
            gender = persona_meta.get("gender", "unknown").lower()
            age = persona_meta.get("age", 25)
            
            prefix = "male" if gender == "male" else "female"
            
            if age <= 15:
                category = f"{prefix}_child"
            elif age <= 35:
                category = f"{prefix}_20s"
            elif age <= 60:
                category = f"{prefix}_40s_50s"
            else:
                category = f"{prefix}_70s"

        # 3. Fetch from Persistent Registry or Auto-Register
        if category in self.presets:
            voice_config = self.presets[category]
        else:
            # Fallback and Auto-register new category
            logger.info(f"Auto-registering new TTS preset category: {category}")
            voice_config = {"voice_id": "supertone-local/M1", "speed": 1.0, "pitch": 0, "rvc_model": None}
            self.presets[category] = voice_config
            self._save_presets()

        # 4. Cache for consistency in this session
        self.session_cache[cache_key] = voice_config
        
        return voice_config
