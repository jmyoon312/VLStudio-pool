import logging
import asyncio
import yt_dlp
import re
from sqlalchemy.orm import Session
from app.models import CategoryTree, DiscoveryChannel
from app.services.intelligence.youtube_discovery import search_youtube_channels, search_youtube_videos
from app.services.region_filter import is_blocked_region

logger = logging.getLogger(__name__)

def classify_channel_niche(channel_name: str, video_title: str, video_desc: str, parent_category_name: str, existing_subcategories: list, use_llm: bool = False) -> dict:
    """
    Use Heuristics first, then LLM fallback (if use_llm is True) to classify a channel into an existing subcategory or propose a new one.
    If use_llm is False (default for radar bulk scans), it bypasses AI to save quotas and returns a programmatic fallback category.
    """
    if is_blocked_region(channel_name=channel_name, video_title=video_title, video_desc=video_desc):
        logger.info(f"[Heuristic] Rejected channel {channel_name} (India/SE Asia detected)")
        return {"action": "reject"}

    combined_text = f"{channel_name} {video_title} {video_desc}".lower()

    # 2. Heuristic Filter: Assign to existing subcategory
    combined_nospace = combined_text.replace(" ", "")
    for sub in existing_subcategories:
        if sub.replace(" ", "").lower() in combined_nospace:
            logger.info(f"✨ [Heuristic] Assigned {channel_name} to {sub}")
            return {"action": "assign", "category_name": sub}

    if not use_llm:
        fallback_name = "신규 추천 대기"
        logger.info(f"⏭️ [Bypass LLM] Assigned programmatic fallback: {fallback_name}")
        return {"action": "propose", "category_name": fallback_name}

    # 3. LLM Fallback for ambiguous or new niches
    from app.llm_manager import LLMClient
    from app.database import SessionLocal
    from app import crud
    import json
    
    db = SessionLocal()
    try:
        db_settings = crud.get_settings(db)
        llm = LLMClient(db_settings)
    finally:
        db.close()
        
    prompt = f"""
You are classifying YouTube channels into Korean subcategories. You must output only valid JSON.

Parent category: '{parent_category_name}'
Existing subcategories: {existing_subcategories}

Channel name: '{channel_name}'
Viral video title: '{video_title}'
Description: '{video_desc[:300]}'

Decide the subcategory assignment:
1. If it exactly matches an existing subcategory → "assign" with that name.
2. If it needs a new niche (e.g., specific analysis, review type, unique format) → "propose" with a descriptive Korean name (max 15 chars, no suffixes like "류", "채널", "기타", "Unknown").
3. [CRITICAL] If this channel is FROM or TARGETS India, Indonesia, Philippines, Vietnam, Thailand, Malaysia, Pakistan, Bangladesh, Sri Lanka, Nepal, or any South/Southeast Asian country → "reject". Even if written in English. Even if the content seems generic. If the channel name contains common Indian/SE Asian names (Singh, Kumar, Sharma, Nguyen, Tran, Wong, etc.), sounds like Indian/SE Asian content, or the description mentions these regions → "reject". Only collect Korean, Japanese, English/Western channels.
4. If unsure → prefer "reject" over proposing a vague category.

Output ONLY valid JSON, no explanations:
{{"action": "assign", "category_name": "name"}}
or
{{"action": "propose", "category_name": "name"}}
or
{{"action": "reject"}}
"""
    try:
        model = getattr(db_settings, "script_analysis_model", None)
        response = llm.generate(prompt, model_name=model, system_instruction="You are a JSON-only bot. Reply with valid JSON.")
        if response:
            cleaned = response.strip()
            # Extract from markdown code block if present
            code_match = re.search(r"```(?:json)?(.*?)```", cleaned, re.DOTALL)
            if code_match:
                cleaned = code_match.group(1).strip()
            # Strip leading/trailing text, extract first JSON object
            brace_start = cleaned.find('{')
            brace_end = cleaned.rfind('}')
            if brace_start != -1 and brace_end != -1:
                cleaned = cleaned[brace_start : brace_end + 1]
            # Remove trailing comma before closing brace
            cleaned = re.sub(r',\s*}', '}', cleaned)
            # Remove control characters
            cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', cleaned)

            # Attempt 1: direct parse
            result = None
            try:
                result = json.loads(cleaned)
            except json.JSONDecodeError:
                # Attempt 2: fix unescaped newlines within string values
                fixed = cleaned.replace('\r\n', '\n')
                fixed = re.sub(r'\n(?!\s*[{\["])', ' ', fixed)
                try:
                    result = json.loads(fixed)
                except json.JSONDecodeError:
                    pass

            if result and isinstance(result, dict):
                logger.info(f"💡 [LLM] Classified {channel_name} -> {result}")
                return result
    except Exception as e:
        logger.error(f"Failed to classify channel {channel_name}: {e}")
    
    return {"action": "propose", "category_name": "신규 추천 대기"}



def fetch_single_channel_info(channel_url: str) -> dict:
    """Fetch channel title, subscriber count, and thumbnail using yt-dlp flat extraction."""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist',
            'socket_timeout': 15,
            'sleep_interval': 0.5,      # [OPTIMIZATION]
            'max_sleep_interval': 1.5,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            if info:
                name = info.get('channel') or info.get('uploader') or info.get('title') or "Unknown Channel"
                if name.endswith(" - YouTube"):
                    name = name[:-10]
                return {
                    "name": name,
                    "subscriber_count": info.get('channel_follower_count') or info.get('subscriber_count') or 0,
                    "thumbnail_path": info.get('thumbnail') or info.get('channel_thumbnail_url') or "",
                }
    except Exception as e:
        logger.error(f"Failed to fetch channel info for {channel_url}: {e}")
    return {}

async def resolve_category_seed_channels(db: Session, category_id: int):
    """
    Find all Seed channels in this category, fetch their real YouTube info,
    and update the database.
    """
    seeds = db.query(DiscoveryChannel).filter(
        DiscoveryChannel.category_id == category_id,
        DiscoveryChannel.name.like("Seed UC%")
    ).all()
    
    if not seeds:
        return
        
    logger.info(f"Resolving {len(seeds)} seed channels for category {category_id}")
    
    # [OPTIMIZATION] Concurrency control: max 5 concurrent requests
    semaphore = asyncio.Semaphore(5)
    
    async def process_seed(seed):
        async with semaphore:
            url = seed.url
            if not url and seed.youtube_channel_id:
                url = f"https://www.youtube.com/channel/{seed.youtube_channel_id}"
                seed.url = url
                
            if not url:
                return
                
            info = await asyncio.to_thread(fetch_single_channel_info, url)
            if info:
                seed.name = info.get("name") or seed.name.replace("Seed ", "")
                seed.subscriber_count = info.get("subscriber_count") or 0
                seed.thumbnail_path = info.get("thumbnail_path") or ""
                logger.info(f"Resolved seed channel from YouTube: {seed.name}")
            else:
                # Fallback for dummy/mock channels
                seed.name = seed.name.replace("Seed ", "")
                seed.subscriber_count = 0
                seed.thumbnail_path = ""
                logger.info(f"Resolved seed channel via fallback: {seed.name}")
                
            seed.lifecycle_status = "ACTIVE"
            
    await asyncio.gather(*(process_seed(seed) for seed in seeds))
    db.commit()

async def discover_channels_for_category(db: Session, category_id: int):
    """
    1. Resolve existing seeds
    2. Search YouTube for category name + keywords (shorts) and register channels as ACTIVE (Auto-Registration)
    """
    category = db.query(CategoryTree).filter(CategoryTree.id == category_id).first()
    if not category:
        return
        
    # Step 1: Resolve seeds
    await resolve_category_seed_channels(db, category_id)
    
    # Step 2: Search discovery for Shorts
    query = f"{category.name} 쇼츠 shorts"
    logger.info(f"Searching YouTube Shorts for category {category.name} with query: {query}")
    
    # Find up to 100 shorts videos
    raw_results = await asyncio.to_thread(search_youtube_videos, query, 100, True)
    
    added_count = 0
    skipped_region = 0
    seen_urls = set()
    for r in raw_results:
        url = r.get("channel_url") or r.get("uploader_url")
        if not url or url in seen_urls:
            continue

        seen_urls.add(url)

        name = r.get('uploader') or r.get('channel') or "Unknown Channel"
        if name.endswith(" - YouTube"):
            name = name[:-10]

        # Region filter: skip Indian/SE Asian channels
        vid_title = r.get('title', '')
        if is_blocked_region(channel_name=name, video_title=vid_title):
            skipped_region += 1
            continue

        existing = db.query(DiscoveryChannel).filter(DiscoveryChannel.url == url).first()
        if existing:
            if not existing.category_id:
                existing.category_id = category_id
            if existing.lifecycle_status == "CANDIDATE":
                existing.lifecycle_status = "ACTIVE"
            db.commit()
            continue

        ch_id = url.split("/")[-1] if "/channel/" in url else None

        new_channel = DiscoveryChannel(
            name=name,
            url=url,
            platform="youtube",
            youtube_channel_id=ch_id,
            category_id=category_id,
            lifecycle_status="ACTIVE",
            channel_tier="NANO",
            thumbnail_path="",
            subscriber_count=r.get("channel_follower_count") or 0,
            status="active"
        )
        db.add(new_channel)
        added_count += 1

    db.commit()
    logger.info(f"Auto-registered {added_count} shorts channels (skipped {skipped_region} region-blocked) for category: {category.name}")
