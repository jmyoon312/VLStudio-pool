import time
import logging
from sqlalchemy.orm import Session
from app.models import Profile, BrandChannel, CaptainAccount
from datetime import datetime
import re

logger = logging.getLogger("ChannelScanner")

class ChannelScanner:
    def __init__(self, db: Session):
        self.db = db

    def scan_delegated_channels(self, page: any, profile_id: str) -> dict:
        """
        Scans all delegated channels from https://www.youtube.com/channel_switcher
        Assumes the browser is already logged in as Captain.
        """
        results = {"success": True, "channels_found": 0, "new_channels": 0, "updated_channels": 0, "errors": []}
        
        try:
            logger.info("📡 Scanning delegated channels...")
            page.get("https://www.youtube.com/channel_switcher")
            time.sleep(3)
            
            # Verify page
            if "channel_switcher" not in page.url:
                results["success"] = False
                results["errors"].append("Failed to load channel switcher page")
                return results

            # Find all channel items
            # Structure: #channel-item, with #channel-title, #subscribers-count
            # Note: This page structure varies. We look for the grid items.
            
            # Common selector for channel items in switcher
            # They are usually <a> tags with specific classes or structure
            channel_items = page.eles("css:a.ytd-channel-switcher-renderer") # This might need adjustment based on actual DOM
            
            # If standard selector fails, try a broader search for containers with names and subs
            if not channel_items:
                 # Fallback: Scrape via text blocks?
                 # Actually, usually they are under `ytd-account-item-renderer` or similar.
                 channel_items = page.eles("tag:ytd-account-item-renderer")

            logger.info(f"🔎 Found {len(channel_items)} potential channel items")

            # Get Captain Account from DB
            captain_profile = self.db.query(Profile).filter(Profile.id == profile_id).first()
            if not captain_profile:
                 results["success"] = False
                 results["errors"].append("Captain profile not found in DB")
                 return results
                 
            # Find or Create CaptainAccount
            captain_acct = self.db.query(CaptainAccount).filter(CaptainAccount.email == captain_profile.email).first()
            if not captain_acct:
                captain_acct = CaptainAccount(email=captain_profile.email, browser_profile_name=captain_profile.id)
                self.db.add(captain_acct)
                self.db.flush() # Get ID
            
            for item in channel_items:
                try:
                    # Extract Data
                    title_el = item.ele("#channel-title")
                    title = title_el.text.strip() if title_el else "Unknown"
                    
                    # Subscriber count parsing (Simplified)
                    subs_text = item.text
                    # ... (regex parsing could go here)
                    
                    link = item.attr("href")
                    channel_id = None
                    if link and "/channel/" in link:
                         channel_id = link.split("/channel/")[1].split("?")[0]
                    
                    if channel_id:
                        # Update or Create BrandChannel
                        existing = self.db.query(BrandChannel).filter(BrandChannel.channel_id == channel_id).first()
                        
                        if not existing:
                            existing = BrandChannel(
                                channel_id=channel_id,
                                title=title,
                                is_active=True,
                                captain_account_id=captain_acct.id # Link!
                            )
                            self.db.add(existing)
                            results["new_channels"] += 1
                        else:
                            existing.title = title
                            existing.is_active = True
                            existing.captain_account_id = captain_acct.id # Link!
                            results["updated_channels"] += 1
                        
                        existing.last_synced_at = datetime.now()
                        results["channels_found"] += 1
                        
                except Exception as e:
                    logger.warning(f"Error parsing channel item: {e}")
                    
            self.db.commit()
            
        except Exception as e:
            logger.error(f"[FAIL] Scan failed: {e}")
            results["success"] = False
            results["error"] = str(e)
            
        return results
