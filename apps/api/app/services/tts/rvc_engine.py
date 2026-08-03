import os
import glob
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class RVCEngine:
    def __init__(self, models_dir: str = "backend/models/rvc"):
        self.models_dir = models_dir
        # Ensure the directory exists
        os.makedirs(self.models_dir, exist_ok=True)
        # Create some dummy models if empty for testing purposes
        if not glob.glob(os.path.join(self.models_dir, "*.pth")):
            dummy_models = [
                "grandmother_kr.pth",
                "grandpa_kr.pth",
                "boy_child_kr.pth",
                "girl_child_kr.pth",
                "young_woman_kr.pth",
                "young_man_kr.pth",
                "middle_aged_man_kr.pth",
                "middle_aged_woman_kr.pth",
                "news_anchor_male.pth",
                "news_anchor_female.pth",
                "tough_guy_kr.pth",
                "sweet_voice_female.pth"
            ]
            for m in dummy_models:
                with open(os.path.join(self.models_dir, m), "w") as f:
                    f.write("dummy")

    def get_available_models(self) -> List[str]:
        """
        Scans the RVC models directory for .pth files.
        """
        pattern = os.path.join(self.models_dir, "*.pth")
        models = glob.glob(pattern)
        return [os.path.basename(m) for m in models]

    async def convert_audio(self, input_wav: str, rvc_model_name: str, pitch_shift: int = 0) -> str:
        """
        Takes an input wav file (e.g., from Supertone) and converts it using the specified RVC model.
        Returns the path to the converted audio.
        """
        if not rvc_model_name:
            return input_wav
            
        model_path = os.path.join(self.models_dir, rvc_model_name)
        if not os.path.exists(model_path):
            logger.warning(f"RVC model {rvc_model_name} not found. Skipping conversion.")
            return input_wav

        logger.info(f"Applying RVC Voice Conversion using model: {rvc_model_name} on {input_wav}")
        
        # In a real environment, this would call the RVC inference CLI or API.
        # Example command:
        # subprocess.run(["python", "infer_cli.py", "--f0up_key", str(pitch_shift), "--input_path", input_wav, "--index_path", "...", "--opt_path", output_wav, "--model_name", rvc_model_name])
        
        base, ext = os.path.splitext(input_wav)
        output_wav = f"{base}_rvc_{rvc_model_name}{ext}"
        
        # MOCK IMPLEMENTATION: Use FFmpeg to simulate voice changing (pitch shifting)
        import subprocess
        
        filter_str = "aecho=0.8:0.9:500:0.3" # Default effect
        model_lower = rvc_model_name.lower()
        if "child" in model_lower or "girl" in model_lower or "woman" in model_lower:
            # Pitch up
            filter_str = "asetrate=44100*1.3,aresample=44100,atempo=1/1.3"
        elif "grand" in model_lower or "man" in model_lower or "tough" in model_lower:
            # Pitch down
            filter_str = "asetrate=44100*0.7,aresample=44100,atempo=1/0.7"
            
        try:
            ffmpeg_cmd = ["ffmpeg", "-y", "-i", input_wav, "-filter:a", filter_str, output_wav]
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            logger.error(f"Mock RVC FFmpeg failed: {e}")
            import shutil
            if input_wav != output_wav:
                shutil.copy2(input_wav, output_wav)
        
        logger.info(f"RVC Conversion complete: {output_wav}")
        return output_wav
