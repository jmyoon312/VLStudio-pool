import logging
import json
import asyncio
import time
import yt_dlp
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class SignalCollector:
    """
    Multi-Source Signal Collection for Organic Discovery Engine.
    Runs 3 parallel signal sources and returns unified raw signals.
    
    Sources:
      [A] YouTube Autocomplete Extended (5 seed queries x 10 results = 50 phrases)
      [B] yt-dlp Search Sampler (3 searches x 10 videos = 30 video titles/metadata)
      [C] LLM Niche Generator (20 generated niches with trend reasons)
    """

    def __init__(self, settings=None, llm_client=None, scraper=None):
        self.settings = settings
        self.llm = llm_client
        self.scraper = scraper
        primary = getattr(settings, 'script_analysis_model', None) if settings else None
        primary = primary or "opencode/deepseek-v4-flash-free"
        self.niche_models = [primary, "openrouter/free", "groq/llama-3.3-70b-versatile"]
        self.cluster_models = [primary, "openrouter/free", "groq/llama-3.3-70b-versatile"]
        self._cache: Dict[str, Dict] = {}
        self._cache_ttl = 300  # 5 minutes TTL for signal collection results

    def collect_all_sync(self, broad_category: str) -> Dict[str, Any]:
        """
        Synchronous entry point for all 3 signal sources.
        Runs them in parallel using threads.
        """
        with ThreadPoolExecutor(max_workers=3) as executor:
            fut_a = executor.submit(self._autocomplete_extended, broad_category)
            fut_b = executor.submit(self._ytdlp_search_sampler, broad_category)
            fut_c = executor.submit(self._llm_niche_generator, broad_category)

            signals = {
                "autocomplete": fut_a.result(timeout=60) if not fut_a.exception() else self._handle_error(fut_a, "autocomplete"),
                "ytdlp": fut_b.result(timeout=60) if not fut_b.exception() else self._handle_error(fut_b, "yt-dlp"),
                "llm": fut_c.result(timeout=60) if not fut_c.exception() else self._handle_error(fut_c, "LLM"),
            }

        logger.info(
            f"Signal collection complete: "
            f"A(autocomplete)={len(signals['autocomplete'])}, "
            f"B(ytdlp)={len(signals['ytdlp'])}, "
            f"C(llm)={len(signals['llm'])}"
        )
        return signals

    def _handle_error(self, future, name: str):
        try:
            future.result()
        except Exception as e:
            logger.warning(f"Signal source '{name}' failed: {e}")
        return []

    def _autocomplete_extended(self, broad_category: str) -> List[str]:
        """
        [Source A] Extended Autocomplete
        5 seed queries x 10 results = ~50 unique autocomplete phrases
        """
        if not self.scraper:
            return []

        seeds = self._generate_autocomplete_seeds(broad_category)
        all_results = []
        seen = set()

        for seed in seeds:
            try:
                results = self.scraper.get_youtube_autocomplete(seed, limit=10)
                for r in (results or []):
                    r_clean = r.strip()
                    if r_clean and r_clean not in seen:
                        seen.add(r_clean)
                        all_results.append(r_clean)
            except Exception as e:
                logger.warning(f"Autocomplete failed for seed '{seed}': {e}")

        return all_results

    def _generate_autocomplete_seeds(self, broad_category: str) -> List[str]:
        """Generate 5 seed queries from a broad category."""
        templates = [
            broad_category,
            f"{broad_category} 추천",
            f"{broad_category} 리뷰",
            f"{broad_category} 꿀팁",
            f"{broad_category} 비교",
        ]
        return templates

    def _ytdlp_search_sampler(self, broad_category: str) -> List[Dict[str, Any]]:
        """
        [Source B] yt-dlp Search Sampler
        3 searches x 10 videos = 30 video metadata objects.
        Uses extract_flat=True for speed (no full metadata download).
        """
        searches = [
            broad_category,
            f"{broad_category} 2025",
            f"{broad_category} 인기",
        ]
        all_videos = []
        seen_ids = set()

        for query in searches:
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': True,
                    'playlistend': 10,
                    'socket_timeout': 15,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"ytsearch10:{query}", download=False)
                    entries = info.get('entries') or []
                    for entry in entries:
                        vid = entry.get('id', '')
                        if vid and vid not in seen_ids:
                            seen_ids.add(vid)
                            title = (entry.get('title') or '').strip()
                            if title:
                                all_videos.append({
                                    "id": vid,
                                    "title": title,
                                    "channel": entry.get('uploader', '') or '',
                                    "views": entry.get('view_count') or 0,
                                    "source_query": query,
                                })
            except Exception as e:
                logger.warning(f"yt-dlp search failed for query '{query}': {e}")

        return all_videos

    def _llm_niche_generator(self, broad_category: str) -> List[Dict[str, Any]]:
        """
        [Source C] LLM Niche Generator
        Generates 20 micro-niches with trend reasons via LLM.
        """
        if not self.llm:
            logger.warning("LLM client not available, skipping niche generation")
            return []

        prompt = f"""You are a YouTube trend analyst. Generate 20 specific micro-niches within the YouTube category '{broad_category}'.

For each niche, provide:
- "name": Korean name of the niche (2-6 words, very specific, actionable)
- "trend_reason": Why this niche is relevant right now (1 sentence in Korean)
- "audience": "small", "medium", or "large"

Make the niches diverse — include tutorial, review, news, comparison, and entertainment angles.

Output ONLY a valid JSON array. Example:
[{{"name": "FPS 게임 꿀팁", "trend_reason": "배틀그라운드 모바일 인기로 실전 팁 수요 증가", "audience": "large"}}]"""

        for model in self.niche_models:
            try:
                with ThreadPoolExecutor(max_workers=1) as pool:
                    fut = pool.submit(
                        self.llm.generate_content,
                        prompt,
                        model_name=model,
                        system_instruction="You are a YouTube trend analyst. Output ONLY valid JSON. No markdown, no explanations."
                    )
                    resp = fut.result(timeout=60)
                raw = str(resp)
                cleaned = self._clean_json(raw)
                data = json.loads(cleaned)
                if isinstance(data, list):
                    return data[:20]
            except Exception as e:
                logger.warning(f"LLM niche generation ({model}) failed: {e}")
                continue

        return []

    def _clean_json(self, text: str) -> str:
        """Extract JSON array from LLM response text."""
        import re
        text = text.strip()
        match = re.search(r"```(?:json)?(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
        start = text.find('[')
        end = text.rfind(']')
        if start != -1 and end != -1 and start < end:
            text = text[start:end + 1]
        return text

    # ─── Signal Fusion ────────────────────────────────────────────────

    def fuse_into_targets(self, broad_category: str) -> List[Dict[str, Any]]:
        """
        Collect all 3 signals → cluster via LLM → assign energy → return targets.
        Returns 10~30 micro-target objects with metadata.
        """
        cache_key = f"targets:{broad_category}"
        cached = self._cache.get(cache_key)
        if cached and (time.time() - cached['ts'] < self._cache_ttl):
            logger.info(f"Returning cached targets for '{broad_category}' ({len(cached['data'])} items)")
            return cached['data']

        signals = self.collect_all_sync(broad_category)

        if not any(signals.values()):
            logger.warning("All signal sources failed. Returning generic fallback.")
            return self._generic_fallback(broad_category)

        signal_items = []
        for phrase in signals.get("autocomplete", []):
            signal_items.append({"type": "autocomplete", "text": phrase})
        for vid in signals.get("ytdlp", []):
            signal_items.append({"type": "video_title", "text": vid.get("title", "")})
        for niche in signals.get("llm", []):
            signal_items.append({"type": "llm_niche", "text": niche.get("name", "")})

        if not signal_items:
            return self._generic_fallback(broad_category)

        a_count = len(signals.get("autocomplete", []))
        b_count = len(signals.get("ytdlp", []))
        c_count = len(signals.get("llm", []))
        logger.info(f"Fusing {len(signal_items)} signals (A={a_count}, B={b_count}, C={c_count}) into targets...")

        targets = self._cluster_with_llm(broad_category, signal_items)
        if not targets:
            targets = self._generic_fallback(broad_category)

        self._cache[cache_key] = {'data': targets, 'ts': time.time()}
        logger.info(f"Cached {len(targets)} targets for '{broad_category}'")
        return targets

    def _cluster_with_llm(self, broad_category: str, items: List[Dict]) -> List[Dict]:
        """Use LLM to cluster signals into micro-targets with energy levels."""
        if not self.llm:
            logger.info("No LLM client available, using keyword-based clustering fallback")
            return self._cluster_by_keywords(broad_category, items)

        sample = items[:80]
        items_json = json.dumps([i["text"] for i in sample], ensure_ascii=False)

        prompt = f"""You are a YouTube niche analyst. Analyze these real-time signals for the broad category '{broad_category}':

SIGNALS:
{items_json}

Cluster these signals into 10~30 micro-targets (niches).
For each target, provide:
- "name": Korean niche name (3~6 words, specific, descriptive)
- "energy": one of "hot", "rising", "steady", "emerging"
- "signal_count": how many signals mapped to this cluster (integer)
- "sample_keywords": 2~3 example keywords (array of strings)

Rules:
- Signal count must reflect the actual cluster size.
- Deduplicate similar concepts.
- Cover diverse angles: tutorial, review, news, comparison, entertainment.
- Output between 10 and 30 targets.

Output ONLY a JSON array. Example:
[{{"name": "FPS 게임 실전 꿀팁", "energy": "rising", "signal_count": 5, "sample_keywords": ["발로란트 에임", "배그 전략", "옵치 꿀팁"]}}]"""

        for model in self.cluster_models:
            try:
                with ThreadPoolExecutor(max_workers=1) as pool:
                    fut = pool.submit(
                        self.llm.generate_content,
                        prompt,
                        model_name=model,
                        system_instruction="You are a YouTube niche analyst. Output ONLY valid JSON. No markdown, no explanations."
                    )
                    resp = fut.result(timeout=90)
                raw = str(resp)
                cleaned = self._clean_json(raw)
                data = json.loads(cleaned)
                if isinstance(data, list):
                    return data
            except Exception as e:
                logger.warning(f"LLM clustering ({model}) failed: {e}")
                continue

        logger.info("All LLM clustering failed, using keyword-based fallback")
        return self._cluster_by_keywords(broad_category, items)

    def _cluster_by_keywords(self, broad_category: str, items: List[Dict]) -> List[Dict]:
        """Non-LLM keyword-based clustering fallback."""
        if not items:
            return self._generic_fallback(broad_category)

        stopwords = {"the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
                     "이", "그", "저", "것", "수", "등", "및", "의", "에", "에서", "를", "을",
                     "은", "는", "이랑", "와", "과", "도", "다", "만", "까지", "부터", "에"}
        texts = [i["text"] for i in items if i.get("text")]
        clusters = {}

        for text in texts:
            import re
            tokens = re.findall(r'[가-힣a-zA-Z]{2,}', text)
            tokens = [t.lower() for t in tokens if t.lower() not in stopwords]
            for token in tokens:
                clusters.setdefault(token, []).append(text)

        targets = []
        used = set()
        sorted_clusters = sorted(clusters.items(), key=lambda x: len(x[1]), reverse=True)

        for token, group in sorted_clusters:
            if len(group) < 2:
                continue
            unique_texts = list(dict.fromkeys(group))
            name = f"{broad_category} {token}"
            if name in used:
                continue
            used.add(name)

            if len(unique_texts) >= 10:
                energy = "hot"
            elif len(unique_texts) >= 5:
                energy = "rising"
            else:
                energy = "emerging"

            kw = list(dict.fromkeys(
                w for t in unique_texts[:3]
                for w in re.findall(r'[가-힣a-zA-Z]{2,}', t) if w.lower() not in stopwords
            ))[:3]

            targets.append({
                "name": name,
                "energy": energy,
                "signal_count": len(unique_texts),
                "sample_keywords": kw or [token],
            })

        if targets:
            return targets[:30]

        return self._generic_fallback(broad_category)

    def _generic_fallback(self, broad_category: str) -> List[Dict]:
        """When all signals fail, return basic generic targets."""
        templates = ["리뷰", "추천", "꿀팁", "비교", "뉴스", "가이드", "실전", "초보"]
        return [
            {
                "name": f"{broad_category} {t}",
                "energy": "steady",
                "signal_count": 1,
                "sample_keywords": [f"{broad_category} {t}"],
            }
            for t in templates
        ]
