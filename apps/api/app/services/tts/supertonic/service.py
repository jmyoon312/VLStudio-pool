import os
import json
import numpy as np
from typing import Optional, Tuple
from supertonic import TTS, Style

class SupertonicService:
    _instance = None
    _initialized = False

    def __init__(self, model_dir: str):
        # --- ROBUST PATH RESOLUTION START ---
        # 1. Convert to absolute path first
        abs_path = os.path.abspath(model_dir)
        print(f"[Supertonic] Resolving path: {abs_path}")

        # 2. Fix Double Backend (Common CWD issue)
        if "backend" + os.sep + "backend" in abs_path:
            print(f"[Supertonic] Detected double 'backend' in path. Attempting to fix...")
            fixed_path = abs_path.replace("backend" + os.sep + "backend", "backend")
            if os.path.exists(fixed_path):
                 print(f"[Supertonic] Fix success -> {fixed_path}")
                 abs_path = fixed_path
        
        # 3. Fallback: Check Parent Directory relative
        if not os.path.exists(abs_path):
             parent_relative = os.path.abspath(os.path.join("..", model_dir))
             if os.path.exists(parent_relative):
                  print(f"[Supertonic] Found via parent path -> {parent_relative}")
                  abs_path = parent_relative
             else:
                  apps_api_relative = os.path.abspath(os.path.join("apps", "api", model_dir))
                  if os.path.exists(apps_api_relative):
                       print(f"[Supertonic] Found via apps/api path -> {apps_api_relative}")
                       abs_path = apps_api_relative

        self.model_dir = abs_path
        print(f"[Supertonic] Final Model Dir: {self.model_dir}")
        # --- ROBUST PATH RESOLUTION END ---

        self.tts = None
        self.sample_rate = 44100

    @classmethod
    def get_instance(cls, model_dir: Optional[str] = None):
        if cls._instance is None:
            if model_dir is None:
                raise ValueError("Model directory must be provided for first initialization")
            cls._instance = cls(model_dir)
        return cls._instance

    def load_models(self):
        if self._initialized:
            return

        print(f"[Supertonic] Loading models from: {self.model_dir}")
        
        if not os.path.exists(self.model_dir):
            print(f"[Supertonic] ERROR: Model directory not found at {self.model_dir}")
            print(f"[Supertonic] CWD: {os.getcwd()}")
            raise FileNotFoundError(f"Model directory not found at {self.model_dir}")
        
        # Initialize official TTS engine
        self.tts = TTS(model_dir=self.model_dir, auto_download=False)
        self.sample_rate = self.tts.sample_rate
        self._initialized = True
        print("Supertonic models loaded successfully via official package.")

    def generate(
        self,
        text: str,
        lang: str = "ko",
        voice_id: str = "default",
        mix_voice_id: str = None,
        mix_ratio: float = 0.5,
        speed: float = 1.0,
        noise_scale: float = 1.0
    ) -> Tuple[np.ndarray, int]:
        """
        Generate audio from text.
        Returns: (audio_array, sample_rate)
        """
        if not self._initialized:
            self.load_models()

        # Resolve primary voice name
        voice_name = self._resolve_voice_id(voice_id)
        
        # Load style corresponding to voice_id
        style = self.tts.get_voice_style(voice_name)

        # Voice Mixing Logic
        if mix_voice_id and mix_ratio > 0:
            try:
                mix_voice_name = self._resolve_voice_id(mix_voice_id)
                style_mix = self.tts.get_voice_style(mix_voice_name)
                
                print(f"[Supertonic] Mixing Voice: {voice_name} ({(1-mix_ratio)*100}%) + {mix_voice_name} ({mix_ratio*100}%)")
                new_ttl = (1 - mix_ratio) * style.ttl + mix_ratio * style_mix.ttl
                new_dp = (1 - mix_ratio) * style.dp + mix_ratio * style_mix.dp
                style = Style(new_ttl, new_dp)
            except Exception as e:
                print(f"[Supertonic] Mix failed: {e}")
        
        # Synthesize audio using official TTS
        wav, dur = self.tts(
            text=text,
            voice_style=style,
            total_steps=5,
            speed=speed,
            lang=lang
        )

        return wav.squeeze(), self.sample_rate

    def _resolve_voice_id(self, voice_id: str) -> str:
        if not voice_id or voice_id == "default" or voice_id.lower() == "supertonic generic":
            return "M1"
        
        name = voice_id
        if name.endswith(".json"):
            name = name[:-5]

        # Check against available style names
        available = self.tts.voice_style_names
        if name in available:
            return name
            
        for av in available:
            if av.lower() == name.lower():
                return av
                
        return "M1"
