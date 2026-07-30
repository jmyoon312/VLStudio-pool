"""
DouyinKeywordEngine — AI（Gemini）더우인 검색 키워드 자동 확장

사용자 시드 → 카테고리 기반 신규 인기 키워드 생성
"""
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Callable, Awaitable

CACHE_TTL_HOURS = 24


class DouyinKeywordExpander:
    """Gemini Flash를 호출하여 trending Douyin search keyword 생성"""

    def __init__(self):
        self._cache: Dict[str, tuple[datetime, list[str]]] = {}

    @staticmethod
    def _build_prompt(category: str, seeds: list[str], n: int = 5) -> str:
        today = datetime.now().strftime("%Y-%m-%d")
        return f"""역할: 중국 더우인 숏폼 트렌드 전문가.

지금 {today} 기준으로, 당신은 트렌드 경쟁급 중국어 검색어를 생성 중입니다.

목표 장르: {category}
기존 잘 알려진 키워드: {', '.join(seeds)}

아래 조건에 맞는 새 검색어 {n}개를 발굴하라:
- 한국 50-70대 시청자에게 강한 관심 유발
- 사이다 + 참교육 스타일 검색
- 2024~2026년 최근 트렌드 용어 포함

JSON ONLY:
{{"keywords": ["신규후보1", "신규후보2", ...]}}"""

    async def expand_keywords(
        self,
        category: str,
        seeds: list[str],
        n: int = 5,
        force_fresh: bool = False,
        gemini_chat_func: Optional[Callable[[str], Awaitable[str]]] = None,
    ) -> List[str]:
        cache_key = f"{category}_{'_'.join(sorted(seeds))}"

        if not force_fresh:
            cached = self._cache.get(cache_key)
            if cached:
                ts, kw_list = cached
                if datetime.now() - ts < timedelta(hours=CACHE_TTL_HOURS):
                    return kw_list

        prompt = self._build_prompt(category, seeds, n)
        raw: str = ""

        if gemini_chat_func:
            try:
                raw = await gemini_chat_func(prompt)
            except Exception:
                pass

        try:
            parsed = json.loads(raw)
            keywords = parsed.get("keywords", [])
            self._cache[cache_key] = (datetime.now(), keywords)
            return keywords
        except (json.JSONDecodeError, TypeError):
            return ["热门推荐", "爆款爽剧", "新剧详情", "总裁爱上顾问", "重生归来胖娘"]


async def generate_recommendations(category_tag: str, seeds: list[str], n: int = 5) -> list[str]:
    engine = DouyinKeywordExpander()
    return await engine.expand_keywords(category_tag, seeds, n)