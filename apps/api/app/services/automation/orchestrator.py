import logging
import asyncio
from typing import Optional
from sqlalchemy.orm import Session
from app.services.stealth_ops_v2 import PatchrightStealth
from app.services.automation.channel_creator import ChannelCreator
from app.services.automation.admin_delegator import AdminDelegator

logger = logging.getLogger("AutomationOrchestrator")

class AutomationConfig:
    """Configuration for automation workflow"""
    def __init__(
        self,
        auto_create_channel: bool = False,
        auto_delegate_admin: bool = False,
        brand_name: Optional[str] = None,
        admin_email: Optional[str] = None,
        use_ai_brand_name: bool = False,
        brand_name_prompt: Optional[str] = None,
        skip_login: bool = False
    ):
        self.auto_create_channel = auto_create_channel
        self.auto_delegate_admin = auto_delegate_admin
        self.brand_name = brand_name
        self.admin_email = admin_email
        self.use_ai_brand_name = use_ai_brand_name
        self.brand_name_prompt = brand_name_prompt
        self.skip_login = skip_login

class AutomationOrchestrator:
    """Orchestrate multi-step automation workflow"""
    
    def __init__(self, db: Session):
        self.db = db
        self.stealth = PatchrightStealth(db)
        self.channel_creator = ChannelCreator(self.stealth)
        self.admin_delegator = AdminDelegator(self.stealth)
    
    async def execute(
        self, 
        profile_id: str,
        config: AutomationConfig
    ) -> dict:
        """
        Execute automation workflow based on configuration
        Runs Patchright code in separate thread to avoid blocking FastAPI
        """
        # Run sync code in separate thread to prevent blocking event loop
        return await asyncio.to_thread(
            self._execute_sync,
            profile_id,
            config
        )
    
    def _execute_sync(
        self,
        profile_id: str,
        config: AutomationConfig
    ) -> dict:
        """
        Synchronous execution of automation workflow
        This runs in a separate thread via asyncio.to_thread
        """
        results = {
            "profile_id": profile_id,
            "steps": [],
            "overall_success": True
        }
        
        page = None
        
        try:
            logger.info(f"🚀 Starting automation for profile {profile_id}")
            
            # Create browser instance (Background mode)
            page = self.stealth.create_page(profile_id)
            
            # Navigate directly to YouTube Studio to verify real session status
            page.goto('https://studio.youtube.com')
            self.stealth.human_delay(2, 3)
            
            # Check if redirected to Google signin page
            curr_url = page.url.lower()
            is_logged_in = not ("accounts.google.com" in curr_url or "signin" in curr_url or "identifier" in curr_url)
            
            if not is_logged_in:
                if config.skip_login:
                    logger.warning("🚫 Not logged in + Skip Login requested. Manual login required.")
                    results["steps"].append({
                        "step": "login_check",
                        "success": False,
                        "error": "스텔스 브라우저에서 유튜브 스튜디오 로그인을 먼저 진행해주세요.",
                        "requires_manual": True
                    })
                    results["overall_success"] = False
                    return results

                logger.info("Not logged in - attempting auto-login...")
                
                # Get profile from DB to retrieve email/password
                from app.models import Profile
                profile = self.db.query(Profile).filter(Profile.id == profile_id).first()
                
                if profile and profile.email and profile.password:
                    # Attempt human-like auto-login
                    login_result = self.stealth.login_google(page, profile.email, profile.password)
                    
                    if login_result["success"]:
                        logger.info("✅ Auto-login successful!")
                        results["steps"].append({
                            "step": "login_check",
                            "success": True,
                            "message": "Auto-login successful (human-like)"
                        })
                    elif login_result.get("requires_2fa"):
                        logger.warning("⚠️ 2FA/Verification required - manual intervention needed")
                        results["steps"].append({
                            "step": "login_check",
                            "success": False,
                            "error": login_result.get("error", "2FA required"),
                            "requires_manual": True
                        })
                        results["overall_success"] = False
                        return results
                    else:
                        logger.error(f"❌ Auto-login failed: {login_result.get('error')}")
                        results["steps"].append({
                            "step": "login_check",
                            "success": False,
                            "error": login_result.get("error", "Login failed"),
                            "requires_manual": True
                        })
                        results["overall_success"] = False
                        return results
                else:
                    logger.warning("No email/password stored - manual login required")
                    results["steps"].append({
                        "step": "login_check",
                        "success": False,
                        "error": "No credentials stored",
                        "requires_manual": True
                    })
                    results["overall_success"] = False
                    return results
            else:
                results["steps"].append({
                    "step": "login_check",
                    "success": True,
                    "message": "Already logged in (session reused)"
                })
            
            # Step 1: Create Channel (if enabled)
            if config.auto_create_channel:
                brand_name = config.brand_name
                
                if config.use_ai_brand_name and not brand_name:
                    brand_name = f"Channel_{profile_id}"
                    logger.warning(f"AI generation not implemented, using: {brand_name}")
                
                if not brand_name:
                    results["steps"].append({
                        "step": "create_channel",
                        "success": False,
                        "error": "Brand name required"
                    })
                    results["overall_success"] = False
                else:
                    channel_result = self.channel_creator.create_brand_channel(
                        page, brand_name
                    )
                    results["steps"].append({
                        "step": "create_channel",
                        **channel_result
                    })
                    
                    if not channel_result["success"]:
                        results["overall_success"] = False
            else:
                logger.info("🔍 Manual Mode: Detecting active channel...")
                detect_result = self.channel_creator.detect_active_channel(page)
                
                results["steps"].append({
                    "step": "detect_channel",
                    **detect_result
                })
                
                if not detect_result["success"]:
                    results["overall_success"] = False
            
            # Step 2: Delegate Admin (if enabled)
            if config.auto_delegate_admin:
                if not config.admin_email:
                    results["steps"].append({
                        "step": "delegate_admin",
                        "success": False,
                        "error": "Admin email required"
                    })
                    results["overall_success"] = False
                else:
                    admin_result = self.admin_delegator.delegate_admin(
                        page, config.admin_email
                    )
                    results["steps"].append({
                        "step": "delegate_admin",
                        **admin_result
                    })
                    
                    if not admin_result["success"]:
                        results["overall_success"] = False
            
            logger.info(f"✅ Automation completed for profile {profile_id}")
            return results
            
        except Exception as e:
            logger.error(f"❌ Automation failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            results["overall_success"] = False
            results["error"] = str(e)
            return results
        finally:
            self.stealth.close()
