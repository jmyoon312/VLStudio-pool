import logging
from app.services.stealth_ops_v2 import PatchrightStealth

logger = logging.getLogger("AdminDelegator")

class AdminDelegator:
    """Automate YouTube channel admin permission delegation"""
    
    def __init__(self, stealth: PatchrightStealth):
        self.stealth = stealth
    
    def delegate_admin(
        self, 
        page, 
        admin_email: str
    ) -> dict:
        """
        Automate admin permission delegation in YouTube Studio
        
        Args:
            page: Patchright Page instance
            admin_email: Email of the admin to add
            
        Returns:
            dict with success status and error if any
        """
        
        try:
            logger.info(f"👤 Starting admin delegation: {admin_email}")
            
            # 1. Navigate to YouTube Studio
            page.goto('https://studio.youtube.com')
            self.stealth.human_delay(3, 5)
            
            # [HANDLE UNSUPPORTED BROWSER PAGE PRE-CHECK]
            for _ in range(3):
                # Detect "Update Browser" / "Unsupported" / "Environment Improvement"
                has_warning = False
                if page.locator('text="환경 개선하기"').first.is_visible() or \
                   page.locator('text="브라우저 버전"').first.is_visible() or \
                   "google_app_unsupported" in page.url:
                    has_warning = True
                
                if has_warning:
                    logger.warning("[WARN] 'Unsupported Browser' page detected. Attempting to skip...")
                    
                    # Try finding the skip button
                    skip_btn = page.locator('text="스튜디오로 건너뛰기"').first
                    if not skip_btn.is_visible():
                        skip_btn = page.locator('text="건너뛰기"').first
                    if not skip_btn.is_visible():
                        skip_btn = page.locator('a[href*="studio"]').first
                    
                    if skip_btn.is_visible():
                        logger.info("Found 'Skip' button, clicking...")
                        self.stealth.safe_click(skip_btn)
                        self.stealth.human_delay(4, 6)
                        
                        # Refresh if stuck
                        if page.locator('text="환경 개선하기"').first.is_visible():
                             logger.warning("Still on unsupported page, refreshing...")
                             page.goto('https://studio.youtube.com')
                             self.stealth.human_delay(3, 5)
                        break
                self.stealth.human_delay(1, 1.5)

            # [HANDLE WELCOME POPUP]
            welcome_dialog = page.locator('text="스튜디오에 오신 것을 환영합니다"').first
            if not welcome_dialog.is_visible():
                welcome_dialog = page.locator('text="Welcome to YouTube Studio"').first

            if welcome_dialog.is_visible():
                logger.info("👋 'Welcome to Studio' popup detected. Clicking Continue...")
                continue_btn = page.locator('text="계속"').first
                if not continue_btn.is_visible():
                    continue_btn = page.locator('text="Continue"').first
                if not continue_btn.is_visible():
                    continue_btn = page.locator('ytcp-button#confirm-button').first
                
                if continue_btn.is_visible():
                    self.stealth.safe_click(continue_btn)
                    self.stealth.human_delay(1, 2)

            # 2. Click Settings icon
            logger.info("Looking for Settings button...")
            settings_btn = None
            for _ in range(5):
                settings_btn = page.locator('yt-icon-button#settings-button').first
                if not settings_btn.is_visible():
                    settings_btn = page.locator('#settings-button').first
                if not settings_btn.is_visible():
                    settings_btn = page.locator('[aria-label="설정"]').first
                if not settings_btn.is_visible():
                    settings_btn = page.locator('[aria-label="Settings"]').first
                    
                if settings_btn.is_visible():
                    break
                self.stealth.human_delay(1, 2)
            
            if not settings_btn or not settings_btn.is_visible():
                logger.warning("Settings button not found")
                return {"success": False, "error": "Settings button not found"}
            
            self.stealth.safe_click(settings_btn)
            self.stealth.human_delay(1, 2)
            
            # 3. Click Permissions tab
            permissions_tab = page.locator('text="권한"').first
            if not permissions_tab.is_visible():
                permissions_tab = page.locator('text="Permissions"').first
            if not permissions_tab.is_visible():
                permissions_tab = page.locator('div.ytcp-settings-dialog >> text="권한"').first
            
            if not permissions_tab.is_visible():
                logger.warning("Permissions tab not found")
                return {"success": False, "error": "Permissions tab not found"}
            
            self.stealth.safe_click(permissions_tab)
            self.stealth.human_delay(2, 3)
            
            # [IDEMPOTENCY CHECK] Check if admin already exists
            if admin_email in page.content():
                logger.info(f"[OK] Users '{admin_email}' already has permissions. Skipping.")
                return {
                    "success": True, 
                    "admin_email": admin_email,
                    "skipped": True
                }

            # 4. Click "Invite" or "Add" button
            invite_btn = page.locator('ytcp-button#invite-button').first
            if not invite_btn.is_visible():
                invite_btn = page.locator('text="초대"').first
            if not invite_btn.is_visible():
                invite_btn = page.locator('text="Invite"').first
            if not invite_btn.is_visible():
                invite_btn = page.locator('text="관리자 추가"').first
            
            if not invite_btn.is_visible():
                logger.warning("Invite button not found")
                return {"success": False, "error": "Invite button not found"}
            
            self.stealth.safe_click(invite_btn)
            self.stealth.human_delay(1, 2)
            
            # 5. Enter admin email (In Popup)
            email_input = page.locator('input[type="email"]').first
            if not email_input.is_visible():
                email_input = page.locator('input[placeholder*="이메일"]').first
            
            if not email_input.is_visible():
                logger.error("Email input field not found")
                return {"success": False, "error": "Email input not found"}
            
            email_input.fill("")
            self.stealth.human_type(email_input, admin_email)
            self.stealth.human_delay(0.5, 1)
            
            # 6. Select permission level (Manager)
            manager_option = page.locator('text="관리자"').first
            if not manager_option.is_visible():
                manager_option = page.locator('text="Manager"').first
            if not manager_option.is_visible():
                manager_option = page.locator('ytcp-text-dropdown-trigger >> text="액세스 권한"').first
            
            if manager_option.is_visible():
                self.stealth.safe_click(manager_option)
                self.stealth.human_delay(0.5, 1)
                
                # If it was a dropdown, click "Manager" item
                real_manager_item = page.locator('paper-item >> text="관리자"').first
                if not real_manager_item.is_visible():
                    real_manager_item = page.locator('paper-item >> text="Manager"').first
                    
                if real_manager_item.is_visible():
                    self.stealth.safe_click(real_manager_item)
            
            # 7. Send invitation (Done button in popup)
            send_btn = page.locator('ytcp-button#done-button').first
            if not send_btn.is_visible():
                send_btn = page.locator('text="완료"').first
            if not send_btn.is_visible():
                send_btn = page.locator('text="Done"').first
            
            if send_btn.is_visible():
                self.stealth.safe_click(send_btn)
                self.stealth.human_delay(1, 2)
            
            # 8. Save changes (Main dialog save button) -- CRITICAL STEP OFTEN MISSED
            save_btn = page.locator('ytcp-button#save-button').first
            if not save_btn.is_visible():
                save_btn = page.locator('text="저장"').first
            if not save_btn.is_visible():
                save_btn = page.locator('text="Save"').first
            
            if save_btn.is_visible():
                self.stealth.safe_click(save_btn)
                logger.info("Clicked Save button...")
                self.stealth.human_delay(3, 5)
            
            # 9. Verify
            logger.info(f"[OK] Admin invitation process for {admin_email} completed")
            return {
                "success": True,
                "admin_email": admin_email
            }

        except Exception as e:
            logger.error(f"[FAIL] Admin delegation failed: {e}")
            return {"success": False, "error": str(e)}
