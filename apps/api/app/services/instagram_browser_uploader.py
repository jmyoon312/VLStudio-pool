import logging
import time
import random
from typing import Dict, Any

logger = logging.getLogger(__name__)

class InstagramBrowserUploader:
    """
    Playwright-based Instagram Reels Uploader
    Automates Instagram Web Upload for Reels (https://www.instagram.com)
    """

    def upload_reel(
        self,
        page: Any,
        video_path: str,
        caption: str
    ) -> Dict[str, Any]:
        
        logger.info(f"[FALLBACK] Starting Instagram Browser Automation for: {video_path}")
        
        try:
            # 1. Navigate to Instagram
            page.goto("https://www.instagram.com")
            logger.info("[WAIT] Waiting for Instagram Dashboard...")
            
            # 2. Click Create (+) button
            time.sleep(random.uniform(3.0, 5.0))
            create_btn = page.locator('svg[aria-label="New post"], svg[aria-label="새 게시물 만들기"]').locator('..').locator('..').first
            if not create_btn.is_visible():
                create_btn = page.locator('span:has-text("Create"), span:has-text("만들기")').first
            create_btn.click()
            
            time.sleep(1)
            # If a submenu appears (Post, Reel, Story), choose Post/Reel
            post_submenu = page.locator('span:has-text("Post"), span:has-text("게시물")').first
            if post_submenu.is_visible():
                post_submenu.click()
                
            time.sleep(2)
            
            # 3. Upload File
            logger.info("📂 Uploading video file...")
            file_input = page.locator('input[type="file"], input[accept*="video"]').first
            file_input.wait_for(state="attached", timeout=10000)
            file_input.set_input_files(video_path)
            
            # 4. Progress through Instagram's upload modal (Crop -> Cover -> Caption)
            # Crop stage (usually default is fine, just click Next)
            time.sleep(random.uniform(4.0, 6.0))
            logger.info("➡️ Proceeding through Crop/Edit steps...")
            
            # Loop for Next buttons until Share button appears
            for _ in range(3):
                next_btn = page.locator('button:has-text("Next"), div[role="button"]:has-text("다음")').first
                if next_btn.is_visible():
                    next_btn.click()
                    time.sleep(random.uniform(2.0, 4.0))
                else:
                    break
            
            # 5. Fill Caption
            logger.info("✍️ Filling Caption...")
            caption_input = page.locator('div[aria-label="Write a caption..."], div[aria-label="문구를 입력하세요..."]').first
            if caption_input.is_visible():
                # Human typing simulation for the first ~100 characters
                first_part = caption[:100]
                rest_part = caption[100:]
                
                if first_part:
                    caption_input.type(first_part, delay=random.randint(30, 80))
                if rest_part:
                    time.sleep(1)
                    caption_input.type(rest_part, delay=0)
            
            # 6. Share
            logger.info("[FALLBACK] Clicking Share...")
            share_btn = page.locator('button:has-text("Share"), div[role="button"]:has-text("공유하기")').first
            share_btn.click()
            
            # Wait for "Your post has been shared." message
            success_msg = page.locator('text="Your reel has been shared.", text="릴스가 공유되었습니다."').first
            success_msg.wait_for(state="visible", timeout=120000)
            
            logger.info("[OK] Instagram Upload Complete")
            return {"status": "success", "url": "https://www.instagram.com/profile"}
            
        except Exception as e:
            logger.error(f"[FAIL] Instagram Automation Error: {e}")
            return {"status": "error", "message": f"Browser Error: {str(e)}"}

instagram_browser_uploader = InstagramBrowserUploader()
