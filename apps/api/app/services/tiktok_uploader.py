import logging
import time
import random
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class TikTokUploader:
    """
    Playwright-based TikTok Uploader
    Automates TikTok Web Upload via TikTok Creator Center (https://www.tiktok.com/creator-center/upload)
    """

    def upload_video(
        self,
        page: Any,
        video_path: str,
        caption: str,
        hashtags: List[str],
        privacy: str = "PUBLIC" # PUBLIC, FRIENDS, PRIVATE
    ) -> Dict[str, Any]:
        
        logger.info(f"[FALLBACK] Starting TikTok Browser Automation for: {video_path}")
        
        try:
            # 1. Navigate to Upload Page
            page.goto("https://www.tiktok.com/creator-center/upload")
            logger.info("[WAIT] Waiting for TikTok Upload Dashboard...")
            
            # Wait for file input or dashboard layout
            time.sleep(random.uniform(4.0, 6.0))
            
            # Switch to iframe if TikTok uses it (TikTok often uses iframe for upload module)
            upload_frame = page
            if page.locator("iframe").count() > 0:
                upload_frame = page.frames[1] if len(page.frames) > 1 else page
            
            # 2. Upload File
            logger.info("📂 Uploading video file...")
            file_input = upload_frame.locator('input[type="file"], input[accept*="video"]').first
            file_input.wait_for(state="attached", timeout=60000)
            file_input.set_input_files(video_path)
            
            # Wait for upload progression (TikTok editor usually appears after file is ingested)
            time.sleep(random.uniform(5.0, 8.0))
            
            # 3. Fill Caption & Hashtags
            logger.info("✍️ Filling Caption and Hashtags...")
            caption_input = upload_frame.locator('.public-DraftEditor-content, div[contenteditable="true"]').first
            caption_input.wait_for(state="visible", timeout=120000) # Give enough time for processing
            
            # Clear default
            caption_input.click()
            time.sleep(0.5)
            # TikTok's editor is tricky with fill, using JS to clear or selecting all
            caption_input.press("Control+A")
            caption_input.press("Backspace")
            
            full_caption = caption
            if hashtags:
                tags_str = " ".join([f"#{t.replace('#', '')}" for t in hashtags])
                full_caption += f"\n\n{tags_str}"
            
            # Type first part to mimic human
            first_part = full_caption[:100]
            rest_part = full_caption[100:]
            
            if first_part:
                caption_input.type(first_part, delay=random.randint(30, 80))
            if rest_part:
                time.sleep(1)
                caption_input.type(rest_part, delay=0)
            
            # Wait a bit for hashtag suggestions to settle
            time.sleep(2)
            
            # 4. Set Privacy
            logger.info(f"👁️ Setting Privacy: {privacy}")
            # TikTok has a dropdown for privacy
            privacy_dropdown = upload_frame.locator('div:has-text("Who can watch this video"), div.radio-group').last
            if privacy_dropdown.is_visible():
                privacy_dropdown.click()
                time.sleep(1)
                
                target_text = "Everyone" if privacy == "PUBLIC" else ("Friends" if privacy == "FRIENDS" else "Only you")
                option = upload_frame.locator(f'text="{target_text}"').first
                if option.is_visible():
                    option.click()
            
            # 5. Post
            logger.info("[FALLBACK] Clicking Post...")
            # Locate Post button (often a primary button)
            post_btn = upload_frame.locator('button:has-text("Post"), button:has-text("게시")').first
            post_btn.click()
            
            # Wait for success dialog or redirection
            time.sleep(10) # Simple wait, in robust script we'd wait for a specific selector
            
            logger.info("[OK] TikTok Upload Complete")
            return {"status": "success", "url": "https://www.tiktok.com/profile"} # Exact URL might be hard to fetch
            
        except Exception as e:
            logger.error(f"[FAIL] TikTok Automation Error: {e}")
            return {"status": "error", "message": f"Browser Error: {str(e)}"}
        finally:
            # We don't close the context here as it's managed by BrowserSessionManager
            pass

tiktok_uploader = TikTokUploader()
