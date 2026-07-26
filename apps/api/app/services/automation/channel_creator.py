import logging
import time
from app.services.stealth_ops_v2 import PatchrightStealth

logger = logging.getLogger("ChannelCreator")

class ChannelCreator:
    """Automate YouTube brand channel creation"""
    
    def __init__(self, stealth: PatchrightStealth):
        self.stealth = stealth
    
    def create_brand_channel(
        self, 
        page, 
        brand_name: str
    ) -> dict:
        """
        Automate brand channel creation on YouTube.
        Handles missing main channel (My Profile popup) automatically.
        """
        try:
            logger.info(f"🎬 Starting channel creation: {brand_name}")
            
            # 1. Direct navigation to Channel Switcher
            switcher_url = 'https://www.youtube.com/channel_switcher'
            page.goto(switcher_url)
            self.stealth.human_delay(3, 5)

            # [IDEMPOTENCY CHECK] Check if channel already exists (Robust Match)
            normalized_target = brand_name.replace(" ", "").lower()
            existing_channels = page.locator(f'//*[contains(text(), "{brand_name}")]').all()
            
            for ch in existing_channels:
                if ch.inner_text().replace(" ", "").lower() == normalized_target:
                    logger.info(f"✅ Channel '{brand_name}' already exists. Skipping creation.")
                    return {
                        "success": True, 
                        "channel_url": page.url,
                        "brand_name": brand_name,
                        "skipped": True
                    }

            # 2. Creation Loop (Handles Personal Channel Prerequisite)
            max_attempts = 2
            for attempt in range(max_attempts):
                phase_name = "Personal Channel Check" if attempt == 0 else "Brand Channel Creation"
                logger.info(f"🔄 Phase {attempt+1}: {phase_name}")
                
                # A. Look for "Create a channel" button
                create_btn = page.locator('text=채널 만들기').first
                if not create_btn.is_visible():
                    create_btn = page.locator('text=Create a channel').first
                if not create_btn.is_visible():
                    create_btn = page.locator('a[href*="create_channel"]').first

                if create_btn.is_visible():
                    logger.info("Found 'Create a channel' button, clicking...")
                    self.stealth.safe_click(create_btn)
                    self.stealth.human_delay(3, 5)
                
                # B. Determine State - Use explicit checks for Dialog vs Page
                
                # State 1: "My Profile" Dialog (Personal Channel Required)
                personal_dialog_candidate = page.locator('ytd-channel-creation-dialog-renderer').first
                if not personal_dialog_candidate.is_visible():
                    personal_dialog_candidate = page.locator('#channel-creation-form').first
                if not personal_dialog_candidate.is_visible():
                    personal_dialog_candidate = page.locator('div:has-text("내 프로필")').last

                if personal_dialog_candidate.is_visible():
                    logger.info("⚠️ Detected 'My Profile' Dialog (Personal Channel missing). Creating it first...")
                    
                    all_inputs = personal_dialog_candidate.locator('input').all()
                    valid_inputs = [inp for inp in all_inputs if inp.is_visible() and inp.get_attribute('type') not in ['checkbox', 'hidden', 'file']]
                    
                    logger.info(f"Found {len(valid_inputs)} visible inputs in dialog.")

                    if len(valid_inputs) >= 1:
                        # 1. Fill Name
                        p_name_input = valid_inputs[0]
                        logger.info(f"Filling Personal Channel Name: {brand_name}")
                        p_name_input.fill("")
                        self.stealth.human_type(p_name_input, brand_name)
                        self.stealth.human_delay(0.5, 1)

                        # 2. Fill Handle (if exists)
                        if len(valid_inputs) >= 2:
                            p_handle_input = valid_inputs[1]
                            import random
                            safe_handle = "".join(x for x in brand_name if x.isalnum())
                            if not safe_handle: safe_handle = "user"
                            safe_handle = f"{safe_handle}{random.randint(1000,9999)}"
                            
                            logger.info(f"Filling Personal Handle: @{safe_handle}")
                            p_handle_input.fill("")
                            self.stealth.human_type(p_handle_input, safe_handle)
                            self.stealth.human_delay(1, 2)
                    else:
                         logger.warning("⚠️ No text inputs found in 'My Profile' dialog! Trying fallback...")
                         fallback_name = page.locator('input[placeholder="이름"]').first
                         if fallback_name.is_visible():
                             fallback_name.fill("")
                             self.stealth.human_type(fallback_name, brand_name)

                    # Target the 'Create' button
                    create_personal_btn = page.locator('ytd-channel-creation-dialog-renderer yt-button-renderer#submit-button').first
                    if not create_personal_btn.is_visible():
                        create_personal_btn = page.locator('button:has(span:text-is("채널 만들기"))').first
                    if not create_personal_btn.is_visible():
                        create_personal_btn = page.locator('button:has-text("채널 만들기")').first
                    
                    if create_personal_btn.is_visible():
                        logger.info("Clicking confirm on Personal Channel dialog...")
                        self.stealth.safe_click(create_personal_btn)
                        logger.info("⏳ Waiting for Personal Channel creation...")
                        self.stealth.human_delay(6, 8)
                        
                        logger.info("Returning to Switcher to proceed to Brand Channel...")
                        page.goto(switcher_url)
                        self.stealth.human_delay(3, 5)
                        continue # Restart loop to now create Brand Channel
                
                # State 2: Brand Channel Creation Page (Target)
                name_input = page.locator('input#channel-name').first
                if not name_input.is_visible():
                    name_input = page.locator('input[name="channelName"]').first
                if not name_input.is_visible():
                    name_input = page.locator('ytd-channel-name-input-renderer input').first

                if name_input.is_visible():
                    logger.info("✅ Found Brand Channel Name Input")
                    name_input.fill("")
                    self.stealth.human_type(name_input, brand_name)
                    self.stealth.human_delay(0.5, 1)
                    
                    # Terms Checkbox
                    terms_input = page.locator('input[type="checkbox"]').first
                    if terms_input.is_visible():
                        if not terms_input.is_checked():
                            logger.info("Clicking Terms Checkbox...")
                            # Playwright check() handles clicking checkboxes properly
                            terms_input.check(force=True)
                    self.stealth.human_delay(0.5, 1)
                    
                    # Submit
                    submit_btn = page.locator('text=만들기').first
                    if not submit_btn.is_visible():
                        submit_btn = page.locator('text=Create').first
                    if not submit_btn.is_visible():
                        submit_btn = page.locator('input[type="submit"]').first
                    
                    if submit_btn.is_visible():
                        self.stealth.safe_click(submit_btn)
                        logger.info("Clicked Create button...")
                        self.stealth.human_delay(5, 8)
                        
                        # Verify Logic
                        current_url = page.url
                        if "youtube.com/channel/" in current_url or "youtube.com/@" in current_url:
                            logger.info(f"✅ Channel created successfully: {current_url}")
                            return {
                                "success": True, 
                                "channel_url": current_url,
                                "brand_name": brand_name
                            }
                        else:
                            error_msg = page.locator('.error-message, [role="alert"]').first
                            if error_msg.is_visible():
                                raise Exception(f"Creation Error: {error_msg.inner_text()}")
                            elif "phone" in page.content().lower() and "verify" in page.content().lower() and "number" in page.content().lower():
                                raise Exception("Phone verification required")
                            else:
                                raise Exception("Unknown error (Page did not redirect)")
                                
                else:
                    logger.warning("Unknown state or 'Create' button failed. Dumping minimal info.")
                    if attempt == max_attempts - 1:
                         return {"success": False, "error": "Could not find creation form after retries (Stuck on My Profile?)"}
            
            return {"success": False, "error": "Max attempts exceeded"}
                
        except Exception as e:
            logger.error(f"❌ Channel creation failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def detect_active_channel(self, page) -> dict:
        """
        Detects the currently active channel ID and exact Brand Channel Name.
        1. Primary: YouTube Studio (https://studio.youtube.com) URL & DOM inspection.
        2. Fallback: Advanced Settings & Account page scraping.
        """
        try:
            logger.info("🕵️ Detection Mode: Scouting for active brand channel...")
            import re

            detected_id = None
            detected_name = None

            # 1. Try YouTube Studio first
            try:
                if "studio.youtube.com" not in page.url:
                    page.goto('https://studio.youtube.com', wait_until="domcontentloaded")
                    self.stealth.human_delay(3, 4)

                current_url = page.url
                logger.info(f"📍 Studio Current URL: {current_url}")

                # Studio URL channel ID extraction: studio.youtube.com/channel/UCxxxx...
                if "/channel/" in current_url:
                    detected_id = current_url.split("/channel/")[1].split("/")[0].split("?")[0]
                
                # Extract Brand Name from Studio DOM
                try:
                    # Method 1: Wait for navigation drawer or header to load
                    page.wait_for_selector('#entity-name, ytcp-navigation-drawer, #entity-header', timeout=5000)
                    self.stealth.human_delay(1, 2)
                    
                    selectors = [
                        '#entity-name',
                        'ytcp-navigation-drawer #name',
                        'ytcp-navigation-drawer .channel-name',
                        '#entity-header yt-formatted-string',
                        'div[id="entity-name"]',
                        '.ytcp-navigation-drawer #entity-name'
                    ]
                    
                    for sel in selectors:
                        try:
                            elem = page.locator(sel).first
                            if elem.is_visible():
                                txt = elem.inner_text().strip()
                                if txt and txt != "내 채널" and "Studio" not in txt:
                                    detected_name = txt
                                    logger.info(f"🎯 [Studio Selector Hit] Selector '{sel}' -> '{detected_name}'")
                                    break
                        except:
                            continue
                            
                    # Method 2: If "내 채널" text exists in drawer, grab sibling text
                    if not detected_name:
                        try:
                            drawer_text = page.locator('ytcp-navigation-drawer').inner_text()
                            lines = [line.strip() for line in drawer_text.split('\n') if line.strip()]
                            if "내 채널" in lines:
                                idx = lines.index("내 채널")
                                if idx + 1 < len(lines):
                                    candidate = lines[idx + 1]
                                    if candidate and not candidate.startswith("대시보드"):
                                        detected_name = candidate
                                        logger.info(f"🎯 [Studio Drawer Lines Hit] -> '{detected_name}'")
                        except Exception as e:
                            logger.warning(f"Drawer text parse warning: {e}")

                    # Method 3: Studio Page Title (e.g. "YouTube Studio - 브랜드 채널명")
                    if not detected_name:
                        page_title = page.title()
                        if "-" in page_title:
                            parts = page_title.split("-")
                            if len(parts) >= 2:
                                candidate_name = parts[-1].strip()
                                if candidate_name and "Studio" not in candidate_name and "유튜브" not in candidate_name:
                                    detected_name = candidate_name
                except Exception as e:
                    logger.warning(f"Studio name extract warning: {e}")

                # Extract Channel ID from Studio page source regex if not in URL
                if not detected_id:
                    html_content = page.content()
                    candidates = set(re.findall(r'\bUC[\w-]{22}\b', html_content))
                    if candidates:
                        detected_id = list(candidates)[0]

                if detected_id:
                    final_name = detected_name or f"채널 ({detected_id[:8]})"
                    logger.info(f"🎉 [Studio Success] ID: {detected_id}, Name: {final_name}")
                    return {
                        "success": True,
                        "channel_id": detected_id,
                        "channel_url": f"https://www.youtube.com/channel/{detected_id}",
                        "brand_name": final_name,
                        "message": f"Detected via Studio: {final_name}"
                    }
            except Exception as studio_err:
                logger.warning(f"Studio direct scouting failed: {studio_err}")

            # 2. Fallback to Account Advanced
            try:
                page.goto('https://www.youtube.com/account_advanced', wait_until="domcontentloaded")
                self.stealth.human_delay(2, 3)

                html_content = page.content()
                candidates = set(re.findall(r'\bUC[\w-]{22}\b', html_content))
                if candidates:
                    detected_id = list(candidates)[0]

                # Try pulling channel title from account page
                try:
                    title_elem = page.locator('#channel-title, .ytd-channel-name, #account-name').first
                    if title_elem.is_visible():
                        detected_name = title_elem.inner_text().strip()
                except:
                    pass

                if detected_id:
                    final_name = detected_name or f"채널 ({detected_id[:8]})"
                    return {
                        "success": True, 
                        "channel_id": detected_id,
                        "channel_url": f"https://www.youtube.com/channel/{detected_id}",
                        "brand_name": final_name,
                        "message": f"Detected via Account Settings: {final_name}"
                    }
            except Exception as acc_err:
                logger.warning(f"Account settings scouting failed: {acc_err}")

            return {"success": False, "error": "Could not detect active channel ID or name."}

        except Exception as e:
            logger.error(f"❌ Detection failed: {e}")
            return {"success": False, "error": str(e)}
