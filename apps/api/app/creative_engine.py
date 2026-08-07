from .llm_manager import LLMClient
import logging
from google.genai import types
import json
import re

logger = logging.getLogger(__name__)

class CreativeEngine:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    def analyze_style_image(self, image_data: bytes, provider: str = None, model: str = None) -> dict:
        """
        Analyzes an image to extract style prompts using Gemini Vision or compatible providers.
        """
        # Resolve dynamic defaults from settings
        target_provider = provider or getattr(self.llm_client.settings, "paperclip_provider", "google")
        target_model = model or getattr(self.llm_client.settings, "paperclip_model", self.llm_client.settings.default_model)
        try:
            prompt = """
            Analyze the artistic style of this image. 
            **IGNORE specific subjects** (people, objects, characters). 
            Focus ONLY on the visual technique and aesthetics.

            Extract the following details:
            1. Artistic Medium (e.g., Oil Painting, 3D Render, Polaroid, Anime)
            2. Lighting & Atmosphere (e.g., Volumetric lighting, Golden hour, Neon noir)
            3. Color Palette (e.g., Teal and Orange, Pastel, High Contrast, Monochrome)
            4. Camera/Lens Properties (e.g., Wide angle, Bokeh, Film grain, 35mm)

            Output ONLY a JSON object with these keys:
            {
                "style_prompt": "A comma-separated string of the extracted style keywords suitable for Stable Diffusion/Midjourney. Do NOT include subject descriptions.",
                "negative_prompt": "Common negative prompts suitable for this style (e.g., low quality, blurry, distorted)"
            }
            """
            
            # Construct model name based on provider
            full_model_name = target_model
            if target_provider == "openrouter" and not full_model_name.startswith("openrouter/"):
                full_model_name = f"openrouter/{full_model_name}"
            elif target_provider == "groq" and not full_model_name.startswith("groq/"):
                full_model_name = f"groq/{full_model_name}"
            
            # Pass raw bytes (LLMManager handles formatting)
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=full_model_name,
                images=[image_data],
                full_response=False
            )
            
            text = response
            if isinstance(response, dict):
                text = response.get("content", "")
            
            if text.startswith("Error:"):
                raise RuntimeError(text)
                
            # Extract JSON block
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                json_str = match.group(0)
                return json.loads(json_str)
            else:
                logger.warning("Could not parse JSON from style analysis, returning raw text.")
                return {"style_prompt": text, "negative_prompt": ""}

        except Exception as e:
            logger.error(f"Style Analysis Failed: {e}")
            raise e

    def segment_script(self, text: str, mode: str = "shorts", provider: str = None, model: str = None, style_prompt: str = "", split_method: str = "ai_smart", pacing_config: dict = None) -> list:
        """
        Splits a script into scenes and generates visual prompts based on the selected method.
        """
        # Resolve dynamic defaults from settings
        target_provider = provider or getattr(self.llm_client.settings, "paperclip_provider", "google")
        target_model = model or getattr(self.llm_client.settings, "paperclip_model", self.llm_client.settings.default_model)
        
        # 0. Custom Rule Logic (New)
        segments = []
        if split_method == 'custom_rule' and pacing_config:
            segments = self._split_by_rule(text, pacing_config)
        
        # 0.5 Rule-Based Splitting (Legacy Fallback)
        # 0.5 Rule-Based Splitting (Legacy Fallback)
        if segments:
            return segments

        # Helper to clean text
        cleaned_text = text.replace("\r\n", "\n").strip()

        
        if split_method == 'sentence':
             # Improved Regex for Korean & English Sentence Splitting
             # 1. Matches common endings: . ? ! 
             # 2. Matches Korean endings with optional punctuation: 다. 요. 죠. 까? (ending with newline or space)
             # 3. Does NOT split on simple newlines unless they follow punctuation.
             
             # Step 1: Replace single newlines with spaces to avoid line-based splitting, 
             # BUT keep double newlines as paragraph breaks (optional, but for "Sentence" mode we might want purely sentences).
             # Let's try to preserve paragraph breaks as sentence breaks too.
             
             # Regex explanation:
             # (?<=[.?!])                 => Lookbehind for punctuation
             # \s+                        => Followed by whitespace
             # OR
             # (?<=[다요죠까])\s*[\.\?!]\s+ => Korean ending char + optional punctuation + whitespace
             
             # Simpler approach: Split by specific markers, then rejoin if needed.
             
             # Protect decimal numbers (e.g. 3.5) -> skipped for now as simple split is requested
             
             # Strong split pattern: Punctuation followed by space/newline
             # Also handle "다", "요" at end of line as implicit sentence structure in scripts
             
             pattern = r'(?<=[.?!])\s+|(?<=[다요죠까])[\.\?!]?\s+(?=[A-Z가-힣])|\n{2,}'
             raw_segments = re.split(pattern, cleaned_text)
             segments = [s.strip() for s in raw_segments if s.strip()]
             
        elif split_method == 'paragraph':
             # Split by double newline
             raw_segments = re.split(r'\n\s*\n', cleaned_text)
             segments = [s.strip() for s in raw_segments if s.strip()]
             
        elif split_method == 'semantic':
             # Split by sentence first
             pattern = r'(?<=[.?!])\s+|(?<=[다요죠까])[\.\?!]?\s+|\n+'
             raw_segments = re.split(pattern, cleaned_text)
             
             # Merge chunks to form meaningful units (e.g., 20-60 words or 50-150 chars)
             buffer = ""
             target_length = 50 if mode == 'shorts' else 100 # Shorts = faster cuts, Long = longer cuts
             
             for seg in raw_segments:
                 if not seg.strip(): continue
                 if len(buffer) + len(seg) < target_length:
                     buffer += " " + seg
                 else:
                     if buffer: segments.append(buffer.strip())
                     buffer = seg
             if buffer: segments.append(buffer.strip())
        
        # If we have pre-calculated segments, we skip the main LLM Splitter and just generate prompts for each.
        if segments:
            logger.info(f"Rule-based split ({split_method}) created {len(segments)} segments. Generating prompts for each...")
            results = []
            for i, seg in enumerate(segments):
                try:
                    # Generate visual prompt for this specific segment
                    prompt_dict = self.generate_visual_prompt(seg, style_prompt, target_provider, target_model)
                    if isinstance(prompt_dict, str):
                        vp = prompt_dict.replace("Visual Prompt:", "").strip()
                        vid_p = "Camera slowly pans, subtle movement"
                    else:
                        vp = prompt_dict.get("visual_prompt", "").replace("Visual Prompt:", "").strip()
                        vid_p = prompt_dict.get("video_prompt", "").strip()
                    
                    aspect_str = '9:16' if mode == 'shorts' else '16:9'
                    results.append({
                        "scene_id": i + 1,
                        "script": seg,
                        "visual_prompt": f"{aspect_str}, {vp}" if vp else f"{aspect_str}, Cinematic scene, {style_prompt}",
                        "video_prompt": vid_p or "Camera slowly pans, subtle movement"
                    })
                except Exception as e:
                    logger.error(f"Failed to gen prompt for segment {i}: {e}")
                    results.append({
                        "scene_id": i + 1,
                        "script": seg,
                        "visual_prompt": f"{'9:16' if mode == 'shorts' else '16:9'}, Cinematic scene, {style_prompt}",
                        "video_prompt": "Camera slowly pans, subtle movement"
                    })
            return results

        # 1. AI-Based Splitting (Fallthrough for 'ai_smart' and 'visual_change')
        pacing_instruction = ""
        aspect_ratio = "9:16" if mode == 'shorts' else "16:9"
        
        if split_method == 'visual_change':
            pacing_instruction = (
                "SPLIT STRATEGY: VISUAL CHANGE FOCUSED.\n"
                "Create a new scene ONLY when the visual imagery described in the script changes significantly.\n"
                "Ignor sentence structure. Focus on 'What the viewer sees'.\n"
                "If two sentences describe the same static action, COMBINE them."
            )
        elif mode == 'shorts':
            pacing_instruction = (
                "MODE: YOUTUBE SHORTS (Fast Paced).\n"
                "SPLIT RULE: Group **1 to 3 sentences** per scene based on semantic meaning.\n"
                "Do NOT split every single sentence if they are short.\n"
                "Do NOT make scenes too long (>3 sentences).\n"
                "Ensure each scene has a clear 'Shorts-style' hook or visual."
            )
        else: # long-form
            pacing_instruction = (
                "MODE: LONG-FORM VIDEO (Narrative).\n"
                "SPLIT RULE: Group **1 to 3 Paragraphs** (or 3-6 long sentences) into one scene.\n"
                "Avoid choppy cuts. Maintain a smooth, slow narrative flow.\n"
                "Only cut when the topic or location changes."
            )

        # 2. Style Instruction (Refactored for Injection at END)
        style_context = ""
        if style_prompt:
            style_context = f'GLOBAL STYLE: "{style_prompt}"'

        prompt = f"""
        You are an expert AI Video Director.
        Your goal is to split the script into scenes and write a **Visual Prompt** for each scene.
        
        METHOD: {split_method.upper()} (Strictly follow split logic)
        {style_context}
        {pacing_instruction}
        Target Aspect Ratio: {aspect_ratio}

        INSTRUCTIONS FOR PROMPTS:
        0. **Cultural & Era Context Extraction**:
           - First, thoroughly analyze the script to deduce the exact geographic, cultural, and historical era (e.g., Joseon Dynasty Korea, Modern New York, Sci-Fi Future, North Korea).
           - **CRITICAL ANTI-BIAS RULE**: The deduced cultural context MUST override any contradictory elements in the Global Style. For example, if the script implies "Joseon Dynasty" (e.g. '선비', '한복') but the Global Style is "Japanese anime", you MUST use the Ghibli/anime art style (brush strokes, colors) BUT the characters MUST wear Korean Hanbok and the architecture MUST be Korean. Do NOT generate Japanese clothes or settings if the script implies Korea.
        1. **visual_prompt (Image Prompt)**: 
           - Focus on WHO is doing WHAT, Context, Background, Lighting. 
           - Structure: `[Aspect Ratio], [Camera Angle], [Cultural & Era Context], [Subject + Action], [Background/Environment], [Lighting]`
           - Inject Global Style at the end.
        2. **video_prompt (Motion Prompt)**:
           - Focus STRICTLY on camera movement and subject motion based on the starting image.
           - DO NOT include art styles (e.g. no "Korean animation style").
           - Keep it concise (e.g. "Camera slowly zooms in, tiger opens its mouth and roars").

        EXAMPLE:
        Script: "전쟁이 시작되었습니다."
        Visual Prompt: "{aspect_ratio}, Low angle shot, thousands of medieval soldiers charging across a muddy field, swords raised, chaotic atmosphere, storm clouds above, {style_prompt if style_prompt else 'Cinematic, dramatic lighting'}"
        Video Prompt: "Camera pans rapidly from left to right, soldiers charging forward, muddy splashes on the ground, intense chaotic movement."

        Script:
        {text}

        Output ONLY a JSON list of objects:
        [
            {{
                "scene_id": 1,
                "script": "...",
                "visual_prompt": "{aspect_ratio}, ...",
                "video_prompt": "..."
            }}
        ]
        """
        
        # 3. Construct model name based on provider
        full_model_name = target_model
        if target_provider == "openrouter" and not full_model_name.startswith("openrouter/"):
            full_model_name = f"openrouter/{full_model_name}"
        elif target_provider == "groq" and not full_model_name.startswith("groq/"):
            full_model_name = f"groq/{full_model_name}"

        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=full_model_name,
                full_response=False
            )
            
            text_resp = response
            if isinstance(response, dict):
                text_resp = response.get("content", "")
            
            if text_resp.startswith("Error:"):
                raise RuntimeError(text_resp)
            
            # Clean markdown code blocks
            text_resp = re.sub(r'^```json\s*', '', text_resp, flags=re.MULTILINE)
            text_resp = re.sub(r'^```\s*', '', text_resp, flags=re.MULTILINE)
            text_resp = text_resp.strip()

            # Extract JSON list
            match = re.search(r'\[.*\]', text_resp, re.DOTALL)
            if match:
                json_str = match.group(0)
                return json.loads(json_str)
            else:
                # Fallback: try to parse the whole text if regex failed but it looks like json
                try:
                    return json.loads(text_resp)
                except:
                    logger.error(f"Failed to parse JSON. Raw response: {text_resp}")
                    raise ValueError(f"Could not parse JSON list from response: {text_resp[:100]}...")

        except Exception as e:
            logger.error(f"Script Segmentation Failed: {e}")
            
            # Auto-Failover to NVIDIA if Google failed and not already using NVIDIA
            if provider == "google" and "nvidia" not in full_model_name:
                logger.info("[REFRESH] Auto-switching to NVIDIA DeepSeek V4 Flash due to failure...")
                try:
                    return self.segment_script(text, mode, provider="nvidia", model="deepseek-ai/deepseek-v4-flash", style_prompt=style_prompt)
                except Exception as e2:
                    logger.error(f"[FAIL] NVIDIA Failover also failed: {e2}")
                    
                    # FINAL FALLBACK: Mock Data for Testing (if enabled or all else fails)
                    logger.warning("[WARN] All LLMs failed. Returning MOCK data for testing purposes.")
                    return [
                        {
                            "scene_id": 1,
                            "script": text[:50] + "...",
                            "visual_prompt": f"{aspect_ratio}, Cinematic, A futuristic city with neon lights, rain falling, {style_prompt}",
                            "video_prompt": "Camera slowly pans left, neon lights flickering."
                        },
                        {
                            "scene_id": 2,
                            "script": "Mock Scene 2 content.",
                            "visual_prompt": f"{aspect_ratio}, Close up, A robot hand holding a flower, {style_prompt}",
                            "video_prompt": "Robot hand gently closes its fingers around the stem."
                        }
                    ]
            raise e

    def generate_visual_prompt(self, script: str, style_context: str = "", provider: str = None, model: str = None) -> dict:
        """
        Generates a visual prompt for a single scene using the specified provider/model.
        """
        target_provider = provider or getattr(self.llm_client.settings, "paperclip_provider", "google")
        target_model = model or getattr(self.llm_client.settings, "paperclip_model", self.llm_client.settings.default_model)
        
        system_prompt = f"""You are a Visual Director. Create a vivid image description and a motion description for this script line. Style: '{style_context}'. Start with camera angle/subject.
        
        CRITICAL RULES:
        1. Analyze the script to deduce the cultural, geographical, and historical era (e.g., Joseon Dynasty Korea, Modern New York, North Korea).
        2. ANTI-BIAS RULE: The cultural context from the script MUST override contradictory elements in the style. If the script is about Korea (e.g. '선비', '호랑이'), and the style is "Japanese Anime", you must apply the anime art style but the clothing/architecture MUST remain strictly Korean (e.g. Hanbok, Choga-jib).
        
        Output MUST be a valid JSON object:
        {{
            "visual_prompt": "[Aspect Ratio], [Camera Angle], [Cultural & Era Context], [Subject + Action], [Background/Environment], [Lighting], [Style]",
            "video_prompt": "Motion prompt focusing STRICTLY on camera movement and subject motion."
        }}
        """
        
        # Construct model name based on provider
        full_model_name = target_model
        if target_provider == "openrouter" and not full_model_name.startswith("openrouter/"):
            full_model_name = f"openrouter/{full_model_name}"
        elif target_provider == "groq" and not full_model_name.startswith("groq/"):
            full_model_name = f"groq/{full_model_name}"

        try:
            response = self.llm_client.generate_content(
                prompt=script, 
                model_name=full_model_name,
                system_instruction=system_prompt,
                full_response=False
            )
            text_resp = response if isinstance(response, str) else response.get("content", "")
            match = re.search(r'\{.*\}', text_resp, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return {"visual_prompt": text_resp, "video_prompt": "Camera slowly pans, subtle movement"}
        except Exception as e:
            logger.error(f"Visual Prompt Generation Failed: {e}")
            return {"visual_prompt": f"Cinematic shot of {script}, high quality", "video_prompt": "Camera slowly pans"}


    def _split_by_rule(self, text: str, config: dict) -> list:
        """
        Splits text based on rigid rules: 'sentence_count' or 'time_duration'.
        """
        unit = config.get('unit', 'sentence') # 'sentence', 'time'
        value = int(config.get('value', 1))
        
        # 1. Base Sentence Split (Regex)
        cleaned_text = text.replace("\r\n", "\n").strip()
        # Strong split pattern: Punctuation followed by space or newline
        pattern = r'(?<=[.?!])\s+|(?<=[다요죠까])[\.\?!]?\s+(?=[A-Z가-힣])|\n{2,}'
        raw_sentences = re.split(pattern, cleaned_text)
        sentences = [s.strip() for s in raw_sentences if s.strip()]
        
        if not sentences: return [text]

        grouped_segments = []
        
        if unit == 'sentence':
            # Group every N sentences
            chunk = []
            for s in sentences:
                chunk.append(s)
                if len(chunk) >= value:
                    grouped_segments.append(" ".join(chunk))
                    chunk = []
            if chunk: grouped_segments.append(" ".join(chunk))
            
        elif unit == 'time':
            # Estimate Duration and Group
            # Rule of thumb: 15 chars (Korean) or 30 chars (English) ≈ 1 second?
            # Let's say 5 chars = 1 second (very rough, safe for pacing)
            # Better: 50ms per character -> 20 chars / sec.
            CHAR_PER_SEC = 15 # Conservative reading speed
            
            target_chars = value * CHAR_PER_SEC
            
            chunk = []
            current_len = 0
            
            for s in sentences:
                s_len = len(s)
                if current_len + s_len > target_chars and chunk:
                    # Current chunk is full, push it
                    grouped_segments.append(" ".join(chunk))
                    chunk = [s]
                    current_len = s_len
                else:
                    chunk.append(s)
                    current_len += s_len
            
            if chunk: grouped_segments.append(" ".join(chunk))
            
        else:
            return sentences # Fallback
            
        return grouped_segments

