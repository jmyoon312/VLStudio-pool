import logging
from sqlalchemy.orm import Session
from app.models import DiscoveryChannel, CategoryTree
from datetime import datetime

logger = logging.getLogger(__name__)

class ChannelPoolManager:
    """
    Manages the lifecycle and discovery of DiscoveryChannel entities.
    Handles Tiers (MEGA, LARGE, MID, SMALL, NANO), lifecycle status (CANDIDATE, ACTIVE, DORMANT, DELETED),
    and automatic discovery strategies.
    """
    
    def __init__(self, settings):
        self.settings = settings
        
    def discover_from_viral_video(self, db: Session, video_data: dict, category_name: str) -> bool:
        """
        [Viral Chain Strategy]
        Called when an OUTLIER video is found. Extracts its channel and adds to pool if new.
        Returns True if a new channel was added.
        """
        channel_id = video_data.get('channel_id')
        channel_name = video_data.get('channel', 'Unknown')
        channel_url = f"https://www.youtube.com/channel/{channel_id}" if channel_id else video_data.get('channel_url')
        
        if not channel_url:
            return False
            
        # Check if already exists
        existing = db.query(DiscoveryChannel).filter(DiscoveryChannel.url == channel_url).first()
        if existing:
            # We could update its status if it was dormant
            if existing.lifecycle_status in ['DORMANT', 'INACTIVE']:
                existing.lifecycle_status = 'ACTIVE'
                existing.last_scanned_at = datetime.now()
                db.commit()
            return False
            
        # Find category
        category = db.query(CategoryTree).filter(CategoryTree.name == category_name).first()
        category_id = category.id if category else None
        
        assigned_category_id = category_id
        lifecycle_status = "ACTIVE"
        
        if category:
            from app.services.category_discovery_service import classify_channel_niche
            
            # Fetch existing subcategories
            subcategories = db.query(CategoryTree).filter(CategoryTree.parent_id == category.id).all()
            sub_map = {c.name: c.id for c in subcategories}
            
            # Classify (always use LLM for precise niche assignment)
            video_title = video_data.get('title', '')
            video_desc = video_data.get('description', '')
            result = classify_channel_niche(channel_name, video_title, video_desc, category.name, list(sub_map.keys()), use_llm=True)

            def _find_fuzzy_category(session: Session, name: str, parent_id: int):
                """Find category by exact match first, then fuzzy (normalized substring)."""
                exact = session.query(CategoryTree).filter(
                    CategoryTree.name == name,
                    CategoryTree.parent_id == parent_id
                ).first()
                if exact:
                    return exact
                norm = name.replace(" ", "").lower()
                all_subs = session.query(CategoryTree).filter(
                    CategoryTree.parent_id == parent_id
                ).all()
                for sub in all_subs:
                    if sub.name and sub.name.replace(" ", "").lower() == norm:
                        return sub
                return None

            if result.get('action') == 'reject':
                logger.info(f"🚫 AI Rejected channel {channel_name} (Failed criteria e.g. Indian channel)")
                return False
            elif result.get('action') == 'assign' and result.get('category_name') in sub_map:
                assigned_category_id = sub_map[result['category_name']]
                logger.info(f"[MAGIC] AI Assigned {channel_name} to existing subcategory '{result['category_name']}'")
            elif result.get('action') == 'propose' and result.get('category_name'):
                proposed_name = result['category_name']
                existing_sub = _find_fuzzy_category(db, proposed_name, category.id)

                if existing_sub:
                    assigned_category_id = existing_sub.id
                else:
                    new_sub = CategoryTree(
                        name=proposed_name,
                        parent_id=category.id,
                        level=category.level + 1,
                        ai_generated=True
                    )
                    db.add(new_sub)
                    db.commit()
                    db.refresh(new_sub)
                    assigned_category_id = new_sub.id
                    logger.info(f"[INFO] AI Proposed new subcategory '{proposed_name}' for {channel_name}")

                lifecycle_status = "CANDIDATE"

        logger.info(f"[FALLBACK] [Viral Chain] New Faceless Channel Discovered: {channel_name} ({channel_url}) -> {lifecycle_status}")
        
        # Add new channel
        new_channel = DiscoveryChannel(
            name=channel_name,
            url=channel_url,
            platform="youtube",
            youtube_channel_id=channel_id,
            category_id=assigned_category_id,
            lifecycle_status=lifecycle_status,
            channel_tier="NANO", # Default, updated on next scan
            status="active"
        )
        
        db.add(new_channel)
        db.commit()
        return True
