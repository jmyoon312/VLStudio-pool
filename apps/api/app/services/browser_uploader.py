import logging
import time
import os
import random
from sqlalchemy.orm import Session

# [Core Infrastructure]
from app import models
from app.services.browser_session_manager import BrowserSessionManager
from app.services.adb_service import adb_service

logger = logging.getLogger(__name__)

class BrowserUploader:
    """
    Advanced Browser Automation for YouTube Uploads (Patchright Version).
    Leverages BrowserSessionManager for 'Secure Connection' and 'IP Rotation'.
    """
    
    def __init__(self):
        self.session_manager = BrowserSessionManager()

    def upload_video(self, db: Session, item_id: int, force_ip_rotation: bool = False):
        """
        Orchestrates the Upload Flow:
        1. Secure Browser Launch (via SessionManager)
        2. Navigate to Studio
        3. Upload & Metadata Fill
        4. Publish
        """
        item = db.query(models.WorkQueueItem).filter(models.WorkQueueItem.id == item_id).first()
        if not item:
            logger.error(f"WorkQueueItem {item_id} not found")
            return

        logger.info(f"🚀 Starting Browser Automation for: {item.title}")
        
        # Resolve Channel ID
        yt_config = item.platform_configs.get('youtube', {})
        channel_id = yt_config.get('channel_id')
        if not channel_id:
            msg = "Channel ID missing in configs"
            logger.error(msg)
            item.status = "FAILED"
            item.failure_reason = msg
            db.commit()
            return

        # [DEATH_VALLEY Blocker] Uploads are strictly forbidden in this recovery mode
        youtube_channel = db.query(models.YouTubeChannel).filter(models.YouTubeChannel.channel_id == channel_id).first()
        if youtube_channel and youtube_channel.cultivation_strategy == "DEATH_VALLEY":
            msg = "Uploads are blocked during Death Valley recovery. The channel is in pure viewer mode."
            logger.error(msg)
            item.status = "FAILED"
            item.failure_reason = msg
            db.commit()
            return

        # 1. Launch Secure Browser (IP Rotation handled inside)
        try:
            # [Smart Rotation] Use flag passed from worker
            rotate_decision = force_ip_rotation
            headless_mode = yt_config.get('headless_mode', False)
            logger.info(f"🛡️ IP Rotation Policy: {'ROTATE' if rotate_decision else 'STICKY'} (Force={force_ip_rotation}) | Headless={headless_mode}")

            page = self.session_manager._launch_orchestrator(
                channel_id=channel_id, db=db,
                rotate_ip=rotate_decision,
                target_url="https://studio.youtube.com/",
                headless=headless_mode
            )
            if not page:
                raise Exception("Failed to launch secure browser session")

            target_page = page

            # Browser is now open at Studio dashboard (or target URL)
            self._execute_upload_flow(target_page, item, db)
            
            logger.info(f"✅ Upload Task Complete. Final status: {item.status}")
            db.commit()
            
        except Exception as e:
            logger.error(f"❌ Browser Automation Failed: {e}")
            item.status = "FAILED"
            item.failure_reason = f"Browser Error: {str(e)}"
            db.commit()

    def _execute_upload_flow(self, page, item: models.WorkQueueItem, db: Session):
        """
        Robust Upload Flow (Fast Path + Localized Selectors)
        """
        # [Adjusted Timing] Safe Zone (3-5s) to bypass Identity Verification
        wait_time = random.uniform(3.0, 5.0)
        logger.info(f"⏳ Waiting for Studio Dashboard ({wait_time:.1f}s human pause)...")
        time.sleep(wait_time) 
        
        # [Simplified Launch] Direct wait for Dashboard or Create Button
        try:
            # Wait for either the Create button OR the dashboard URL
            create_btn = page.locator('#create-icon').first
            if not create_btn.is_visible():
                create_btn = page.locator('text="만들기"').first
            if not create_btn.is_visible():
                create_btn = page.locator('text="Create"').first
                
            create_btn.wait_for(state='visible', timeout=60000)
            logger.info("✅ Studio Dashboard Loaded (Secure Session)")
        except Exception as e:
            if "signin" in page.url or "accounts.google" in page.url:
                raise Exception("Login Page Detected. Session isolation failed or cookie expired.")
            raise Exception(f"Dashboard failed to load: {e}")

        # 1. Click Create -> Upload
        try:
            logger.info("🖱️ Click: Create Button")
            create_btn.click(force=True)
            time.sleep(1)
            
            upload_menu = page.locator('#text-item-0').first
            if not upload_menu.is_visible():
                upload_menu = page.locator('text="동영상 업로드"').first
            if not upload_menu.is_visible():
                upload_menu = page.locator('text="Upload videos"').first
                
            if upload_menu.is_visible():
                upload_menu.click(force=True)
            else:
                raise Exception("Could not find 'Upload videos' menu item")
                
            # 2. Upload File
            logger.info(f"📂 Uploading: {item.video_file_path}")
            # Wait for any potential overlay
            time.sleep(2)
            
            file_input = page.locator('input[type="file"]').first
            file_input.wait_for(state="attached", timeout=10000)
            file_input.set_input_files(item.video_file_path)
            
        except Exception as e:
            raise Exception(f"File upload interaction failed: {e}")
        
        # 3. Meticulous Metadata Entry (Fast Path)
        try:
            # --- Title ---
            logger.info("✍️ Writing Title...")
            page.locator('ytcp-uploads-dialog').first.wait_for(state='attached', timeout=60000)
            time.sleep(1)
            
            title_input = page.locator('#textbox').first
            try:
                title_input.wait_for(state='attached', timeout=10000)
            except:
                title_input = page.locator('#title-textarea #textbox').first
                try:
                    title_input.wait_for(state='attached', timeout=5000)
                except:
                    title_input = page.locator('div[aria-label*="제목"] #textbox').first
                    title_input.wait_for(state='attached', timeout=5000)
            
            if title_input.count() > 0:
                title_input.fill("", force=True)
                time.sleep(0.5)
                # Type title slowly to simulate human
                title_input.type(item.title, delay=random.randint(50, 100))
            else:
                raise Exception("Title input not found")

            # --- Description ---
            logger.info("✍️ Writing Description...")
            desc_input = page.locator('#description-textarea #textbox').first
            try:
                desc_input.wait_for(state='attached', timeout=10000)
            except:
                desc_input = page.locator('div[aria-label*="설명"] textbox, div[aria-label*="description"] textbox').first
                desc_input.wait_for(state='attached', timeout=5000)
            
            if desc_input.count() > 0:
                description = item.description or ""
                if item.hashtags:
                     tags_str = " ".join(item.hashtags) if isinstance(item.hashtags, list) else str(item.hashtags)
                     description += f"\n\n{tags_str} " # [FIX] 끝에 공백을 추가하여 해시태그 자동완성 창이 스스로 닫히도록 유도
                
                desc_input.fill("", force=True)
                time.sleep(0.5)
                
                # Human typing simulation for the first ~100 characters
                first_part = description[:100]
                rest_part = description[100:]
                
                if first_part:
                    desc_input.type(first_part, delay=random.randint(30, 80))
                if rest_part:
                    time.sleep(random.uniform(0.5, 1.5))
                    desc_input.type(rest_part, delay=0) # Fast paste for the rest
                    
                # 입력 후 포커스를 잃게 만들어 자동완성 드롭다운을 확실하게 닫음 (바탕이나 제목 클릭)
                try:
                    page.locator('text="세부정보"').first.click(force=True)
                except:
                    pass
                page.keyboard.press('Escape')
                time.sleep(0.5)
            else:
                logger.warning("⚠️ Description input not found")

            # --- Audience (Not Made for Kids) ---
            logger.info("👶 Setting Audience...")
            not_kids_btn = page.locator('text="아니요, 아동용이 아닙니다"').first
            if not not_kids_btn.is_visible():
                not_kids_btn = page.locator('text="No, it\'s not made for kids"').first
                
            if not_kids_btn.is_visible():
                not_kids_btn.scroll_into_view_if_needed() # 스크롤을 내려서 팝업 잔상을 피함
                time.sleep(0.5)
                # Playwright의 click()이 <none>이나 드롭다운에 의해 계속 막히는 현상을 원천 차단하기 위해 JS DOM Click 사용
                not_kids_btn.evaluate("node => node.click()") 
            else:
                logger.warning("⚠️ 'Not Made for Kids' button not found. Maybe already set?")

            # --- Tags (Show More) ---
            if item.tags:
                try:
                    logger.info("🏷️ Processing Tags...")
                    # 따옴표를 제거하여 부분 일치(substring match)를 사용함으로써 텍스트 주변의 공백/줄바꿈 무시
                    show_more = page.locator('text=자세히 보기').first
                    if not show_more.is_visible():
                        show_more = page.locator('text=Show more').first
                    
                    if show_more.is_visible():
                        show_more.scroll_into_view_if_needed()
                        show_more.evaluate("node => node.click()") # JS DOM Click
                        time.sleep(1.5)
                    
                    tag_input = page.locator('#tags-container #text-input').first
                    tag_input.wait_for(state='attached', timeout=10000)
                    tag_input.scroll_into_view_if_needed()
                    if tag_input.is_visible():
                        tags_list = item.tags if isinstance(item.tags, list) else []
                        tags_str = ",".join(tags_list)
                        tag_input.type(tags_str, delay=50)
                        tag_input.press("Enter")
                    else:
                        logger.warning("⚠️ Tag input field not revealed.")
                except Exception as e:
                    logger.warning(f"Feature: Tags failed (Non-critical): {e}")

        except Exception as e:
            logger.error(f"❌ Metadata Entry Error: {e}")
            raise Exception(f"Metadata phase failed: {e}")

        # [2026 Update] Handle potential A/B Testing / Collaborator popups before next
        try:
            logger.info("🛡️ Checking for 2026 UI Feature Popups (A/B testing, Collaborators)...")
            close_popup = page.locator('button[aria-label="Close"], button[aria-label="닫기"]').filter(has_text="Close").first
            if close_popup.is_visible(timeout=2000):
                close_popup.click()
                logger.info("✅ Closed a disruptive popup.")
        except Exception:
            pass

        # 4. Progression & Publish
        logger.info("➡️ Finishing Upload Flow...")
        try:
            # Step 1: Details -> Video Elements
            if next_btn.is_visible():
                if not next_btn.is_enabled():
                    logger.info("Next button disabled, waiting for processing to complete...")
                    page.wait_for_selector('#next-button:not([disabled])', timeout=30000)
                next_btn.click()
                logger.info("✅ Details -> Video Elements")
            time.sleep(2)
            
            # Step 2: Video Elements -> Checks
            next_btn = page.locator('#next-button').first
            if next_btn.is_visible():
                if not next_btn.is_enabled():
                    time.sleep(2)
                    page.wait_for_selector('#next-button:not([disabled])', timeout=30000)
                next_btn.click()
                logger.info("✅ Video Elements -> Checks")
            time.sleep(2)
            
            # Step 3: Checks -> Visibility
            try:
                checks_done = False
                if page.locator('text="검사가 완료되었습니다"').first.is_visible() or \
                   page.locator('text="Checks complete"').first.is_visible():
                    checks_done = True
                
                if checks_done:
                    logger.info("✅ Checks Complete. No issues found.")
                else:
                    logger.warning("⚠️ Checks still processing or text not found. Proceeding anyway.")
            except:
                pass
            
            next_btn = page.locator('#next-button').first
            if next_btn.is_visible():
                if not next_btn.is_enabled():
                    time.sleep(2)
                    page.wait_for_selector('#next-button:not([disabled])', timeout=30000)
                next_btn.click()
                logger.info("✅ Checks -> Visibility")
            time.sleep(2)
            
            # [VISIBILITY LOGIC]
            logger.info("👁️ Setting Visibility (Forced Private for Verification)...")
            
            yt_config = item.platform_configs.get('youtube', {})
            original_privacy = yt_config.get('privacy', 'private').lower()
            
            # [NEW] Backup original target privacy for the Verification Worker
            yt_config['final_privacy'] = original_privacy
            item.platform_configs['youtube'] = yt_config
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(item, "platform_configs")

            # Always click Private for initial upload (Safe Sovereign Shield policy)
            try:
                page.locator('tp-yt-paper-radio-button[name="PRIVATE"]').first.click(force=True, timeout=10000)
            except:
                try:
                    page.locator('#privacy-radios-private').first.click(force=True, timeout=5000)
                except:
                    page.locator('text="비공개"').first.click(force=True, timeout=5000)
            logger.info(f"🔒 Selected PRIVATE (Original was {original_privacy} - deferred to Verification Worker)")
            
            # Final Click
            logger.info("🚀 Clicking Save/Publish...")
            page.locator('#done-button').first.click(timeout=5000)
            
            # Wait for confirmation dialog (Video Link available)
            try:
                page.locator('ytcp-video-share-dialog').first.wait_for(state='visible', timeout=15000)
                
                # Grab URL
                uploaded_url = None
                try:
                    link_node = page.locator('a.style-scope.ytcp-video-share-dialog').first
                    if link_node.is_visible():
                        uploaded_url = link_node.get_attribute("href")
                        logger.info(f"🎉 Upload Success! URL: {uploaded_url}")
                        item.uploaded_urls = {'youtube': uploaded_url}
                except:
                    logger.info("URL logic extraction skipped.")
            except Exception as e:
                logger.warning(f"⚠️ Share dialog did not appear (Timeout). Assuming upload succeeded. Error: {e}")

        except Exception as e:
            raise Exception(f"Publishing phase failed: {e}")

        # [Status Update - Sovereign Publisher v4]
        # Always route to VERIFYING for the 10-minute aging and copyright check
        item.status = "VERIFYING"
        item.upload_completed_at = __import__('datetime').datetime.now() # [NEW] Record private upload time
        logger.info("⏳ Upload Task Complete. Routing to VERIFYING queue for aging/copyright checks.")

    def verify_and_publish_video(self, db: Session, item_id: int):
        """
        Phase 2: Check constraints and switch a 'VERIFYING' video from Private to its final privacy.
        """
        import time
        from app import models
        item = db.query(models.WorkQueueItem).filter(models.WorkQueueItem.id == item_id).first()
        if not item: return

        # 1. Launch Browser (using optimized orchestrator)
        yt_config = item.platform_configs.get('youtube', {})
        channel_id = yt_config.get('channel_id')
        final_privacy = yt_config.get('final_privacy', 'public').upper()
        
        # [Optimization] Reusing context via _launch_orchestrator for verification
        page = self.session_manager._launch_orchestrator(channel_id, db, rotate_ip=False, target_url="https://studio.youtube.com/")
        
        try:
            # Click Content Icon
            page.locator('#menu-paper-icon-item-1').first.click(timeout=10000)
            time.sleep(3)
            
            # 3. Find the Video row
            first_row = page.locator('ytcp-video-row.style-scope.ytcp-video-section-content').first
            if not first_row.is_visible(timeout=15000):
                raise Exception("No videos found in Content tab")
                
            video_title = first_row.locator('#video-title').first.inner_text()
            if item.title[:10] not in video_title:
                logger.warning(f"⚠️ Top video title '{video_title}' might not match. Checking Shorts tab...")
                shorts_tab = page.locator('tp-yt-paper-tab').filter(has_text="Shorts").first
                if shorts_tab.is_visible():
                    shorts_tab.click()
                    time.sleep(3)
                    first_row = page.locator('ytcp-video-row.style-scope.ytcp-video-section-content').first
                    if first_row.is_visible():
                        video_title = first_row.locator('#video-title').first.inner_text()
                        if item.title[:10] not in video_title:
                            logger.warning(f"⚠️ Still doesn't match. Found: '{video_title}'. Proceeding with caution.")
            
            # 4. Check Restrictions Column
            restrictions_cell = first_row.locator('.style-scope.ytcp-video-row-cell#restrictions').first
            restrictions_text = restrictions_cell.inner_text().strip().lower()
            logger.info(f"🛡️ Video Restrictions: {restrictions_text}")

            if "checking" in restrictions_text or "검사" in restrictions_text or "검토" in restrictions_text:
                logger.info("⏳ Video is still being checked. Updating timestamp to wait another 10 mins.")
                item.updated_at = __import__('datetime').datetime.now()
                db.commit()
                return

            if "copyright" in restrictions_text or "저작권" in restrictions_text or "claim" in restrictions_text or "신고" in restrictions_text:
                logger.error(f"❌ Copyright or restriction claim found: {restrictions_text}")
                item.status = "FAILED_REVIEW"
                item.failure_reason = f"유튜브 검토 실패: {restrictions_text}"
                db.commit()
                return

            # If "None" or safe, proceed to change visibility
            logger.info(f"✅ Checks passed. Applying final privacy: {final_privacy}")
            visibility_cell = first_row.locator('.style-scope.ytcp-video-row-cell#visibility').first
            visibility_cell.click(timeout=5000)
            time.sleep(1)
            
            # Select final privacy
            if final_privacy in ["SCHEDULE", "SCHEDULED"] and item.scheduled_upload_time:
                logger.info(f"📅 Entering Scheduling Mode for {item.scheduled_upload_time}")
                # Click the schedule radio
                page.locator('tp-yt-paper-radio-button[name="SCHEDULE"], tp-yt-paper-radio-button[name="SCHEDULED"]').first.click(timeout=5000)
                time.sleep(1)
                
                # Setup Date
                try:
                    date_input = page.locator('#datepicker-trigger input').first
                    if not date_input.is_visible():
                        date_input = page.locator('input[aria-label*="날짜"], input[aria-label*="date"]').first
                    
                    # Round time to nearest 15 minutes for YouTube constraints
                    t = item.scheduled_upload_time
                    discard = __import__('datetime').timedelta(minutes=t.minute % 15, seconds=t.second, microseconds=t.microsecond)
                    t -= discard
                    if discard >= __import__('datetime').timedelta(minutes=7.5):
                        t += __import__('datetime').timedelta(minutes=15)
                    
                    # Clear and type YYYY. MM. DD. (Korean format) or let JS do its best
                    date_input.click()
                    # Ctrl+A then Delete to clear
                    page.keyboard.press("Control+A")
                    page.keyboard.press("Backspace")
                    date_str = f"{t.year}. {t.month:02d}. {t.day:02d}."
                    date_input.type(date_str, delay=50)
                    page.keyboard.press("Enter")
                    time.sleep(1)
                except Exception as e:
                    logger.warning(f"⚠️ Could not set date: {e}")

                # Setup Time
                try:
                    time_input = page.locator('#time-of-day-trigger input').first
                    if not time_input.is_visible():
                        time_input = page.locator('input[aria-label*="시간"], input[aria-label*="time"]').first
                    
                    time_input.click()
                    page.keyboard.press("Control+A")
                    page.keyboard.press("Backspace")
                    time_str = t.strftime("%H:%M")
                    time_input.type(time_str, delay=50)
                    page.keyboard.press("Enter")
                    time.sleep(1)
                except Exception as e:
                    logger.warning(f"⚠️ Could not set time: {e}")
                
                save_btn = page.locator('#save-button, #done-button').filter(has_text="예약").first
                if not save_btn.is_visible():
                    save_btn = page.locator('#save-button').first
                save_btn.click(timeout=5000)
                time.sleep(3)
                logger.info(f"✅ Video scheduled to {item.scheduled_upload_time}.")

            else:
                page.locator(f'[name="{final_privacy}"]').first.click(timeout=5000)
                time.sleep(1)
                
                # Click Publish/Save (in the popup)
                save_btn = page.locator('#save-button').first
                save_btn.click(timeout=5000)
                time.sleep(3)
                logger.info(f"✅ Video switched to {final_privacy}.")
            item.status = "COMPLETED"
            db.commit()
            
        except Exception as e:
            logger.error(f"❌ Verification & Publish Failed: {e}")
        finally:
            # Keep context open for next reuse
            pass

browser_uploader = BrowserUploader()
