import logging
import json
import asyncio
from app.llm_manager import LLMClient
from app import schemas
from app.schemas.packet import QualityAuditPacket

logger = logging.getLogger(__name__)

class LocalizationEngine:
    def __init__(self, settings: schemas.Settings):
        self.llm_client = LLMClient(settings)

    async def translate_script(self, script: str, target_langs: list[str]) -> dict:
        """
        Translates the script and generates localized metadata (title, tags) 
        for each target language, preserving the original persona/tone.
        Uses a Drafter-Critic micro-loop for quality assurance.
        """
        if not target_langs:
            return {}

        attempts = 0
        max_attempts = 3
        feedback = []
        result = {}

        while attempts < max_attempts:
            attempts += 1
            
            # 1. DRAFTER: Generate Translation
            feedback_str = f"\n\nPREVIOUS ERROR FEEDBACK:\n" + "\n".join(feedback) if feedback else ""
            prompt = f"""
            You are a professional Localization Specialist for a viral video channel.
            Your task is to translate the following video script into {', '.join(target_langs)}.
            {feedback_str}

            CRITICAL INSTRUCTIONS:
            1. **Preserve Persona**: Maintain the original tone (e.g., sarcastic, excited, professional).
            2. **Optimize for Virality**: The translation should feel natural and engaging for the target culture, not literal.
            3. **Generate Metadata**: For each language, generate a catchy **Title** and 5-10 **Tags** optimized for that market's YouTube/TikTok.
            
            Input Script:
            "{script}"
            
            Output JSON Format (Strictly adhere to this):
            {{
                "LANGUAGE_CODE": {{
                    "script": "Translated script text...",
                    "title": "Viral Title",
                    "tags": ["tag1", "tag2"...]
                }},
                ...
            }}
            """

            try:
                response_text = self.llm_client.generate_content(
                    prompt=prompt,
                    model_name="openai/gpt-4o", # Upgraded to 4o for better reasoning
                    system_instruction="You are an expert polyglot viral marketer."
                )

                if isinstance(response_text, dict):
                    response_text = response_text.get("content", "")

                # Clean markdown
                if response_text.startswith("```json"):
                    response_text = response_text.replace("```json", "").replace("```", "")
                elif "```" in response_text:
                    import re
                    match = re.search(r'```json\n?(.*?)\n?```', response_text, re.DOTALL)
                    if match:
                        response_text = match.group(1)

                result = json.loads(response_text)

                # 2. CRITIC: Self-Audit
                audit = self._audit_translation(result, target_langs)
                
                if audit.status == "APPROVED":
                    logger.info(f"✅ Localization successful on attempt {attempts}")
                    return result
                else:
                    feedback = audit.feedback
                    logger.warning(f"⚠️ Localization rejected (Attempt {attempts}/{max_attempts}): {feedback}")
                    continue

            except Exception as e:
                logger.error(f"Localization attempt {attempts} failed: {e}")
                if attempts == max_attempts:
                    raise RuntimeError(f"Localization Engine permanently failed: {str(e)}")
                await asyncio.sleep(1)

        return result

    def _audit_translation(self, result: dict, target_langs: list[str]) -> QualityAuditPacket:
        """
        Critics the translation result for structural and semantic integrity.
        """
        feedback = []
        
        # Check if all requested languages are present
        present_langs = [l.upper() for l in result.keys()]
        for lang in target_langs:
            if lang.upper() not in present_langs:
                feedback.append(f"Missing language: {lang}")

        # Check for empty content
        for lang, data in result.items():
            if not data.get("script") or len(data.get("script", "")) < 20:
                feedback.append(f"[{lang}] Script content is suspiciously short or empty.")
            if not data.get("title"):
                feedback.append(f"[{lang}] Missing viral title.")
            if not data.get("tags") or len(data.get("tags", [])) < 3:
                feedback.append(f"[{lang}] Insufficient tags (need at least 3).")

        return QualityAuditPacket(
            status="APPROVED" if not feedback else "REJECTED",
            feedback=feedback
        )
