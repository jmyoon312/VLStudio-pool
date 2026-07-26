import logging
import json
import re
from typing import Dict, Any, Optional
from app.schemas import Settings
from app.llm_manager import LLMClient
from app.database import SessionLocal
from app import crud

logger = logging.getLogger(__name__)

class AIWorkflowGenerator:
    def __init__(self):
        self.llm = None
        self._load_llm()

    def _load_llm(self):
        """
        Loads the LLM Client using settings from the database.
        """
        db = SessionLocal()
        try:
            # 1. Get Settings Model (SQLAlchemy)
            db_settings = crud.get_settings(db)
            
            # 2. Convert to Pydantic Schema (so LLMClient accepts it)
            # using from_attributes=True config in schemas.Settings
            settings_schema = Settings.model_validate(db_settings)
            
            # 3. Initialize LLM Client
            self.llm = LLMClient(settings_schema)
            logger.info("✅ AI Workflow Generator: LLM Client Initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize LLM Client for Workflow Generator: {e}")
            self.llm = None
        finally:
            db.close()

    def generate_workflow(self, prompt: str, provider: str = "google", model: str = None) -> Dict[str, Any]:
        """
        Generates an n8n workflow JSON based on natural language prompt.
        """
        # Reload LLM if missing (maybe settings were updated)
        if not self.llm:
            self._load_llm()
            
        if not self.llm:
            raise Exception("LLM Client not initialized. Please check API Keys in Settings.")

        system_prompt = """
        You are an expert n8n Workflow Developer.
        Your task is to convert the user's Natural Language request into a VALID n8n Workflow JSON.
        
        Rules:
        1. Return ONLY the JSON object. No markdown, no explanations.
        2. The JSON must have "nodes" (list) and "connections" (object).
        3. Always include a "Start" trigger node (or "n8n-nodes-base.start") at position [250, 300] if no other trigger is implied.
        4. Use standard n8n nodes details:
           - "n8n-nodes-base.httpRequest" for API calls.
           - "n8n-nodes-base.emailSend" for emails.
           - "n8n-nodes-base.cron" for scheduling.
           - "n8n-nodes-base.telegram" for Telegram.
           - "n8n-nodes-base.googleSheets" for sheets.
        5. Position nodes logically (x += 200 for each step).
        6. Connect all nodes sequentially in the "connections" object.
        
        IMPORTANT: Return RAW JSON only. Do not wrap in ```json ... ``` code blocks.
        """

        # Construct Schema-compliant Model Name
        # LLMClient expects "openrouter/...", "groq/...", or "gemini-..."
        target_model = model
        if provider == "groq" and not model.startswith("groq/"):
             target_model = f"groq/{model}"
        elif provider == "openrouter" and not model.startswith("openrouter/"):
             target_model = f"openrouter/{model}"
        elif provider == "sambanova" and not model.startswith("sambanova/"):
             target_model = f"sambanova/{model}"
        elif provider == "cerebras" and not model.startswith("cerebras/"):
             target_model = f"cerebras/{model}"
        elif provider == "google":
             # Gemini doesn't use prefix in this implementation usually, but check llm_manager
             # It expects just "gemini-1.5-pro" etc.
             if not model: target_model = "gemini-1.5-pro"
        
        if not target_model:
            target_model = "gemini-1.5-pro" # Ultimate Fallback

        try:
            logger.info(f"🤖 Generating Workflow with {target_model}...")
            response_text = self.llm.generate_content(
                prompt=f"Request: {prompt}",
                model_name=target_model,
                system_instruction=system_prompt
            )
            
            if not response_text:
                raise Exception("LLM returned empty response.")

            # [FIX] Robust JSON Extraction
            # 1. Try to find JSON block explicitly
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                clean_json = json_match.group(1)
            else:
                # 2. Try to find just the first { and last }
                json_match_loose = re.search(r'(\{.*\})', response_text, re.DOTALL)
                if json_match_loose:
                    clean_json = json_match_loose.group(1)
                else:
                    # 3. Assume raw text is JSON
                    clean_json = response_text

            # Clean potential trailing commas or markdown artifacts if needed (simple cleanup)
            clean_json = clean_json.strip()
            
            return json.loads(clean_json)
                
        except json.JSONDecodeError as je:
             logger.error(f"JSON Parse Error: {je}. Raw: {response_text[:100]}...")
             raise Exception(f"AI returned invalid JSON: {je}")
        except Exception as e:
            logger.error(f"Workflow Generation Failed: {e}")
            raise Exception(f"Failed to generate workflow with AI: {e}")

ai_generator = AIWorkflowGenerator()
