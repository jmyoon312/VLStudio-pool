import asyncio
import random
import logging
import os
from typing import Optional
from patchright.async_api import async_playwright, BrowserContext, Page
logger = logging.getLogger(__name__)

class SovereignBrowser:
    """
    Handles autonomous browser sessions with human-mimicry.
    Supports persistent contexts for authenticating services like Google/NotebookLM.
    """
    
    def __init__(self, 
                 user_data_dir: Optional[str] = None,
                 headless: bool = True):
        # [MODIFIED] Use a dynamic path instead of hardcoded home dir
        if not user_data_dir:
            from app.config import settings
            user_data_dir = os.path.join(settings.MEDIA_ROOT, "04_Profiles", "notebook_default")
            
        self.user_data_dir = user_data_dir
        self.headless = headless
        self.pw = None
        self.context = None

    async def __aenter__(self):
        self.pw = await async_playwright().start()
        # Ensure profile directory exists
        os.makedirs(self.user_data_dir, exist_ok=True)
        
        self.context = await self.pw.chromium.launch_persistent_context(
            user_data_dir=self.user_data_dir,
            headless=self.headless,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            args=["--disable-blink-features=AutomationControlled"]
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.context:
            await self.context.close()
        if self.pw:
            await self.pw.stop()

    async def human_type(self, page: Page, selector: str, text: str):
        """Types text slowly with random intervals between keystrokes."""
        await page.wait_for_selector(selector)
        await page.click(selector)
        for char in text:
            await page.keyboard.type(char)
            await asyncio.sleep(random.uniform(0.05, 0.2))

    async def human_click(self, page: Page, selector: str):
        """Clicks an element after a short human-like pause."""
        await page.wait_for_selector(selector)
        # Small mouse movement or pause before clicking
        await asyncio.sleep(random.uniform(0.5, 1.5))
        await page.click(selector)

    async def random_wait(self, min_sec: float = 1.0, max_sec: float = 3.0):
        """Wait for a random duration to mimic browsing behavior."""
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    async def get_page(self) -> Page:
        if not self.context:
            raise RuntimeError("Browser context not initialized. Use 'async with' block.")
        # If no pages exist, create one. Otherwise return the first one.
        if len(self.context.pages) == 0:
            return await self.context.new_page()
        return self.context.pages[0]
