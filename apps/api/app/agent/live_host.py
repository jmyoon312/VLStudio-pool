import os
import logging
import asyncio
import random
from ..llm_manager import LLMClient
from ..tts_engine import TTSEngine
from .. import schemas

logger = logging.getLogger(__name__)

class LiveHost:
    def __init__(self, settings: schemas.Settings):
        self.settings = settings
        self.llm_client = LLMClient(settings)
        self.tts_engine = TTSEngine(settings)
        self.persona = "You are a charismatic VTuber. Respond to chat messages briefly, wittily, and with high energy."

    async def process_comment(self, user: str, text: str) -> dict:
        """
        Processes a chat comment:
        1. Generate AI response.
        2. Generate TTS audio.
        3. Return response data.
        """
        logger.info(f"💬 Processing comment from {user}: {text}")
        
        # 1. Generate Response
        prompt = f"""
        {self.persona}
        
        User '{user}' says: "{text}"
        
        Respond in 1-2 sentences. Be engaging.
        """
        
        try:
            response_text = self.llm_client.generate_content(prompt, model_name=self.settings.default_model).strip()
        except Exception as e:
            logger.error(f"LLM Error: {e}")
            response_text = f"Thanks {user} for the message!"

        # 2. Generate Audio
        try:
            # Use a fast TTS model/voice
            audio_path = await self.tts_engine.generate_audio(
                text=response_text,
                engine="edge",
                voice_id="en-US-AvaNeural" # Example voice
            )
            
            # Convert path to URL wirelessly using the smart utility
            from ..utils import get_web_url
            audio_url = get_web_url("http://api:8000", audio_path)
            
        except Exception as e:
            logger.error(f"TTS Error: {e}")
            audio_url = None

        return {
            "user": user,
            "original_text": text,
            "response_text": response_text,
            "audio_url": audio_url
        }

    async def poll_chat_mock(self):
        """
        Simulates incoming chat messages for testing.
        """
        mock_comments = [
            ("Fan123", "Hello! Love the stream!"),
            ("GamerX", "Play Minecraft next!"),
            ("Troll99", "Is this AI?"),
            ("Mod_Sarah", "Don't forget to drink water."),
            ("Newbie", "How do I use this?")
        ]
        
        user, text = random.choice(mock_comments)
        return await self.process_comment(user, text)
