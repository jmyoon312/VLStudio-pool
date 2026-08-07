"""
Warmup Comment Generator
Generates diverse, contextual comments for YouTube warmup automation
Supports multiple languages and video categories
"""

import random
from typing import Optional

# Multi-language comment pools by category
COMMENTS = {
    "gaming": {
        "ko": [
            "개꿀잼 ㅋㅋㅋ", "이거 진짜 레전드", "실력 미쳤다 👍", "와 이런 플레이 처음봄",
            "개잘하네 ㄷㄷ", "이거 어떻게 하는거임?", "존잘 [FIRE]", "다음편 기대됩니다",
            "구독 박고 갑니다", "이 게임 해보고 싶다", "꿀팁 감사합니다 ❤️",
            "역대급 플레이", "진짜 고수시네요", "이거 보고 배워갑니다"
        ],
        "en": [
            "Insane gameplay! [FIRE]", "GG well played", "This is legendary",
            "How did you do that?!", "Pro level skills 👍", "Subscribed!",
            "Can't wait for next episode", "Amazing content", "Best player ever",
            "This game looks fun", "Thanks for the tips ❤️", "Incredible!",
            "You're a beast!", "Mind blown 🤯"
        ],
        "ja": [
            "すごい！", "神プレイ [FIRE]", "上手すぎる", "これは凄い",
            "チャンネル登録しました", "次回も楽しみ ❤️", "勉強になります",
            "最高のプレイヤー 👍", "このゲームやりたい", "ありがとう！",
            "レジェンド級", "感動した", "プロですね"
        ]
    },
    "cooking": {
        "ko": [
            "맛있어 보여요 😋", "레시피 감사합니다", "오늘 저녁 이거 해먹어야겠다",
            "완전 간단하네요 👍", "꿀팁 대박", "요리 잘하시네요 ❤️",
            "따라해볼게요", "군침 도네요", "재료 구하기 쉬울까요?",
            "영상 잘 봤습니다", "다음 레시피 기대돼요", "완전 맛있겠다 [FIRE]",
            "초보도 할 수 있을까요?", "이거 꼭 만들어봐야지"
        ],
        "en": [
            "Looks delicious! 😋", "Thanks for the recipe", "Gonna try this tonight",
            "So easy to make 👍", "Great tips!", "You're an amazing cook ❤️",
            "Can't wait to try this", "My mouth is watering", "Where can I get these ingredients?",
            "Love your videos", "More recipes please [FIRE]", "This looks perfect",
            "Even I can make this!", "Subscribed for more"
        ],
        "ja": [
            "美味しそう！😋", "レシピありがとう", "今日作ってみます",
            "簡単ですね 👍", "素晴らしい ❤️", "料理上手ですね",
            "真似してみます", "お腹空いた", "材料はどこで買えますか？",
            "いい動画です [FIRE]", "次のレシピ楽しみ", "完璧！",
            "初心者でもできそう", "チャンネル登録しました"
        ]
    },
    "travel": {
        "ko": [
            "가보고 싶다 ❤️", "풍경 진짜 예쁘네요", "여기 어디예요?",
            "꼭 가봐야겠어요 ✈️", "영상미 미쳤다", "힐링되네요 😊",
            "다음 여행지 여기로 정했어요", "정보 감사합니다 👍", "부럽다",
            "여행 브이로그 최고", "구독 박았습니다 [FIRE]", "분위기 좋네요",
            "언제 가셨어요?", "비용은 얼마나 들었나요?"
        ],
        "en": [
            "I want to go there! ❤️", "Beautiful scenery", "Where is this place?",
            "Adding to my bucket list ✈️", "Stunning visuals", "So relaxing 😊",
            "This is my next destination", "Thanks for the info 👍", "So jealous!",
            "Best travel vlog", "Subscribed! [FIRE]", "Amazing atmosphere",
            "When did you visit?", "How much did it cost?"
        ],
        "ja": [
            "行きたい！❤️", "綺麗な景色", "ここはどこですか？",
            "絶対行きます ✈️", "映像が素晴らしい", "癒される 😊",
            "次の旅行先決定", "情報ありがとう 👍", "羨ましい",
            "最高の旅行動画", "チャンネル登録 [FIRE]", "雰囲気いいね",
            "いつ行きましたか？", "費用はいくらですか？"
        ]
    },
    "tech": {
        "ko": [
            "유익한 정보 감사합니다 👍", "이거 꼭 필요했어요", "설명 잘하시네요",
            "바로 적용해봤어요 [FIRE]", "초보자도 이해하기 쉽네요", "꿀팁 대박 ❤️",
            "구독했습니다", "다음 영상 기대돼요", "완전 도움됐어요",
            "이거 어디서 살 수 있나요?", "가격은 얼마인가요?", "성능 좋아보이네요",
            "리뷰 잘 봤습니다", "이거 사야겠다"
        ],
        "en": [
            "Very informative! 👍", "This is exactly what I needed", "Great explanation",
            "Just applied this [FIRE]", "Easy to understand", "Awesome tips ❤️",
            "Subscribed!", "Looking forward to more", "Super helpful",
            "Where can I buy this?", "How much does it cost?", "Looks powerful",
            "Great review", "I'm getting this"
        ],
        "ja": [
            "参考になります 👍", "これが欲しかった", "説明が上手",
            "すぐ試しました [FIRE]", "初心者にも分かりやすい", "素晴らしい ❤️",
            "チャンネル登録", "次の動画楽しみ", "とても役立つ",
            "どこで買えますか？", "価格はいくらですか？", "性能良さそう",
            "いいレビュー", "買います"
        ]
    },
    "music": {
        "ko": [
            "노래 좋다 ❤️", "계속 듣게 되네요", "플레이리스트 추가했어요 🎵",
            "음색 미쳤다", "이거 띵곡이다 [FIRE]", "매일 듣는 중",
            "감성 터진다", "힐링되네요 😊", "가사 좋아요",
            "구독 박고 갑니다 👍", "다음 곡 기대돼요", "명곡이네요",
            "이 노래 제목 뭐예요?", "계속 들어도 안 질려요"
        ],
        "en": [
            "Love this song ❤️", "Can't stop listening", "Added to my playlist 🎵",
            "Amazing voice", "This is a banger [FIRE]", "Listening on repeat",
            "So emotional", "Very relaxing 😊", "Great lyrics",
            "Subscribed! 👍", "Can't wait for the next one", "Masterpiece",
            "What's the song title?", "Never gets old"
        ],
        "ja": [
            "いい曲 ❤️", "何度も聞いてる", "プレイリスト追加 🎵",
            "声が素晴らしい", "名曲 [FIRE]", "リピート中",
            "感動した", "癒される 😊", "歌詞がいい",
            "チャンネル登録 👍", "次の曲楽しみ", "傑作",
            "曲名は何ですか？", "飽きない"
        ]
    },
    "nature": {
        "ko": [
            "힐링되네요 🌿", "영상미 미쳤다", "자연 최고 ❤️",
            "평화롭다", "스트레스 풀려요 😊", "화질 좋네요 4K",
            "배경음악도 좋아요 🎵", "잠잘 때 틀어놔야겠어요", "구독했습니다 👍",
            "계속 보게 되네요", "자연 다큐 최고 [FIRE]", "영상 감사합니다",
            "여기 어디예요?", "직접 촬영하신 건가요?"
        ],
        "en": [
            "So relaxing 🌿", "Stunning visuals", "Nature is amazing ❤️",
            "So peaceful", "Stress relief 😊", "Great 4K quality",
            "Love the background music 🎵", "Perfect for sleeping", "Subscribed! 👍",
            "Can't stop watching", "Best nature documentary [FIRE]", "Thanks for sharing",
            "Where is this?", "Did you film this yourself?"
        ],
        "ja": [
            "癒される 🌿", "映像が綺麗", "自然最高 ❤️",
            "平和", "ストレス解消 😊", "4K画質いいね",
            "BGMもいい 🎵", "寝る時に流します", "チャンネル登録 👍",
            "ずっと見てる", "最高の自然動画 [FIRE]", "ありがとう",
            "ここはどこ？", "自分で撮影したの？"
        ]
    },
    "general": {
        "ko": [
            "좋아요 👍", "❤️", "[FIRE]", "대박", "ㅋㅋㅋ", "😊", "최고",
            "잘 봤습니다", "구독했어요", "감사합니다", "멋지네요",
            "재미있어요", "유익해요", "다음 영상 기대돼요"
        ],
        "en": [
            "Nice! 👍", "❤️", "[FIRE]", "Awesome", "LOL", "😊", "Great",
            "Well done", "Subscribed", "Thanks", "Cool",
            "Interesting", "Helpful", "Looking forward to more"
        ],
        "ja": [
            "いいね 👍", "❤️", "[FIRE]", "すごい", "笑", "😊", "最高",
            "よかった", "チャンネル登録", "ありがとう", "かっこいい",
            "面白い", "役立つ", "次も楽しみ"
        ]
    }
}

# 2026 Trend-based search terms
SEARCH_TERMS_2026 = [
    # AI & Technology
    "AI tutorial 2026", "ChatGPT tips", "machine learning basics",
    "AI art generation", "coding with AI", "AI 활용법",
    
    # Sustainability & Climate
    "sustainable living", "zero waste lifestyle", "climate change solutions",
    "eco friendly products", "친환경 생활", "지속가능한 미래",
    
    # Web3 & Blockchain
    "web3 explained", "NFT guide", "blockchain tutorial",
    "crypto news 2026", "메타버스 체험", "디지털 자산",
    
    # Health & Wellness
    "mental health tips", "meditation guide", "wellness routine",
    "healthy recipes 2026", "명상 음악", "건강한 습관",
    
    # Remote Work & Digital Nomad
    "remote work setup", "digital nomad life", "work from anywhere",
    "productivity hacks", "재택근무 팁", "디지털 노마드",
    
    # Electric Vehicles & Future Tech
    "electric car review", "EV charging guide", "future technology",
    "smart home 2026", "전기차 리뷰", "미래 기술",
    
    # Space & Science
    "space exploration 2026", "Mars mission", "astronomy documentary",
    "science explained", "우주 다큐", "과학 실험",
    
    # Gaming & Entertainment
    "gaming highlights 2026", "esports tournament", "game review",
    "VR gaming", "게임 공략", "e스포츠",
    
    # Traditional favorites (still relevant)
    "cute cats", "travel vlog", "cooking recipe", "nature 4k",
    "music playlist", "귀여운 고양이", "여행 브이로그", "요리 레시피"
]


def generate_comment(language: str = "ko", category: str = "general") -> str:
    """
    Generate a contextual comment based on language and category
    
    Args:
        language: Language code ('ko', 'en', 'ja')
        category: Video category ('gaming', 'cooking', 'travel', 'tech', 'music', 'nature', 'general')
    
    Returns:
        A random comment string
    """
    # Validate inputs
    if language not in ["ko", "en", "ja"]:
        language = "ko"  # Default to Korean
    
    if category not in COMMENTS:
        category = "general"  # Default to general
    
    # Get comment pool
    comment_pool = COMMENTS[category].get(language, COMMENTS["general"][language])
    
    return random.choice(comment_pool)


def get_random_search_term() -> str:
    """
    Get a random search term from 2026 trends
    
    Returns:
        A random search term string
    """
    return random.choice(SEARCH_TERMS_2026)


def detect_category_from_url(url: str) -> str:
    """
    Attempt to detect video category from URL or title
    (Simple heuristic - can be enhanced with ML)
    
    Args:
        url: Video URL
    
    Returns:
        Detected category or 'general'
    """
    url_lower = url.lower()
    
    # Simple keyword matching
    if any(word in url_lower for word in ["game", "gaming", "play", "esport"]):
        return "gaming"
    elif any(word in url_lower for word in ["cook", "recipe", "food", "chef"]):
        return "cooking"
    elif any(word in url_lower for word in ["travel", "vlog", "trip", "tour"]):
        return "travel"
    elif any(word in url_lower for word in ["tech", "review", "unbox", "gadget"]):
        return "tech"
    elif any(word in url_lower for word in ["music", "song", "cover", "mv"]):
        return "music"
    elif any(word in url_lower for word in ["nature", "wildlife", "ocean", "forest"]):
        return "nature"
    else:
        return "general"


def get_random_language() -> str:
    """
    Get a random language with weighted distribution
    Korean: 50%, English: 35%, Japanese: 15%
    
    Returns:
        Language code
    """
    return random.choices(
        ["ko", "en", "ja"],
        weights=[50, 35, 15],
        k=1
    )[0]
