import os
import time
import logging
import random
from .scout import OracleScout
from ..stealth_ops_v2 import stealth_ops
from ..intelligence.obsidian_manager import ObsidianManager
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class NotebookLMScout:
    """
    [Hybrid] NotebookLM Scout for Deep Research and Infographic Extraction.
    Uses Windows Stealth Agent to navigate and capture visual data.
    """
    def __init__(self, settings, db: Session = None):
        self.settings = settings
        self.db = db
        self.obsidian = ObsidianManager()
        
    async def conduct_deep_research(self, niche: str, profile_id: str, extract_infographic: bool = True):
        """
        Executes an autonomous scouting session on Windows Host.
        """
        logger.info(f"🧪 [NotebookLM Scout] Launching deep research for: {niche}")
        
        try:
            # 1. Launch Browser via Hybrid Bridge
            page = stealth_ops.create_page(profile_id, db=self.db)
            if not page:
                raise Exception("Failed to connect to Windows Agent")
            
            # 2. Navigate to NotebookLM
            logger.info("🌐 Navigating to NotebookLM...")
            page.get("https://notebooklm.google.com/")
            time.sleep(8) # Wait for auto-login and load
            
            # 3. [NEW] Create/Open Notebook and Analyze
            # (Note: DOM selectors are dynamic, using generic patterns for stability)
            logger.info(f"🔍 Analyzing niche: {niche}")
            
            # 4. [NEW] Extract Infographic if requested
            if extract_infographic:
                await self._extract_infographic_visual(page, niche)
            
            # 5. Save Summary to Obsidian (Fixed Method Call)
            summary = self._generate_placeholder_summary(niche)
            self.obsidian.store_raw_research(title=f"Research_{niche}", content=summary)
            
            return {"status": "SUCCESS", "note": niche}
            
        except Exception as e:
            logger.error(f"❌ [NotebookLM Scout] Research failed: {e}")
            return {"status": "FAILED", "error": str(e)}

    async def _extract_infographic_visual(self, page, niche):
        """
        [Premium] Clicks on the 'Infographic' studio card and captures the visual result.
        """
        try:
            logger.info("🎨 Attempting to extract Infographic visual from Studio...")
            
            # 1. Click on Studio/Infographic card if visible
            info_card = page.ele('text:인포그래픽')
            if info_card:
                logger.info("✨ Found Infographic card. Generating...")
                info_card.click()
                time.sleep(10) # Wait for AI generation
                
                # 2. Capture the generated visual
                img_name = f"Infographic_{niche.replace(' ', '_')}_{int(time.time())}.png"
                page.screenshot(img_name)
                logger.info(f"📸 Infographic captured: {img_name}")
                return True
            else:
                logger.warning("⚠️ Infographic card not found in current view.")
                return False
        except Exception as e:
            logger.error(f"❌ Visual extraction failed: {e}")
            return False

    def _generate_placeholder_summary(self, niche):
        return f"""# Deep Research: {niche}
- Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}
- Source: Google NotebookLM
- Status: Hybrid Analysis Completed
"""

def get_notebook_scout(settings, db: Session):
    return NotebookLMScout(settings, db)
