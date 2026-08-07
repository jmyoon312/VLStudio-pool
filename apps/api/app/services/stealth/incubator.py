import random
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class Incubator:
    """
    Automated Account Incubation (Warmup) Service.
    Generates contextual interactions to build account trust.
    """
    
    COMMENTS = {
        "gaming": {
            "ko": ["개꿀잼 ㅋㅋㅋ", "실력 미쳤다 👍", "구독 박고 갑니다"],
            "en": ["Insane gameplay! [FIRE]", "GG well played", "Subscribed!"],
        },
        "cooking": {
            "ko": ["맛있어 보여요 😋", "레시피 감사합니다", "따라해볼게요"],
            "en": ["Looks delicious! 😋", "Thanks for the recipe", "Gonna try this"],
        },
        "general": {
            "ko": ["좋아요 👍", "잘 봤습니다", "감사합니다"],
            "en": ["Nice! 👍", "Well done", "Thanks"],
        }
    }

    SEARCH_TERMS = [
        "AI tutorial 2026", "sustainable living", "mental health tips",
        "cute cats", "travel vlog", "cooking recipe"
    ]

    def __init__(self, settings):
        self.settings = settings

    def generate_warmup_comment(self, category: str = "general", language: str = "ko") -> str:
        """Generates a random, contextual comment for account warmup."""
        pool = self.COMMENTS.get(category, self.COMMENTS["general"]).get(language, self.COMMENTS["general"]["ko"])
        return random.choice(pool)

    def get_random_trend_search(self) -> str:
        """Returns a random trending search term for the current year."""
        return random.choice(self.SEARCH_TERMS)

    def decide_incubation_activity(self, channel_id: int, current_stage: str):
        """
        Determines the daily activity for a channel based on its incubation stage.
        Stages: 'NEW', 'WARMING', 'TRUSTED', 'SHADOWBANNED'
        """
        if current_stage == 'NEW':
            return {"watch_count": 5, "comment_prob": 0.1, "like_prob": 0.3}
        elif current_stage == 'WARMING':
            return {"watch_count": 10, "comment_prob": 0.3, "like_prob": 0.6}
        else:
            return {"watch_count": 3, "comment_prob": 0.2, "like_prob": 0.4}
