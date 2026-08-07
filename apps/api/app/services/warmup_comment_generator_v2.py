"""
Warmup Comment Generator v2 (Intelligence Edition)
Generates DNA-driven search queries and comments using LLMs (Gemini/Groq/etc.)
"""

import logging
import random
import json
from typing import Optional, List
from app.llm_manager import LLMClient
from app.schemas.dna import ChannelDNA

logger = logging.getLogger("WarmupIntelligence")

class WarmupIntelligenceGenerator:
    def __init__(self, settings):
        self.llm = LLMClient(settings)
        self.default_model = getattr(settings, "default_model", "opencode/deepseek-v4-flash-free")

    def generate_dna_search_queries(self, dna: ChannelDNA, count: int = 5) -> List[str]:
        """
        Generates search queries based on the channel's micro-niche.
        """
        niche = dna.positioning.micro_niche
        macro = dna.positioning.macro_category
        
        prompt = f"""
        당신은 유튜브 알고리즘을 연구하는 전문가입니다.
        다음 채널 DNA 정보를 바탕으로, 이 분야에 관심 있는 실제 유저가 유튜브에서 검색할 만한 검색어 {count}개를 생성하세요.
        
        [채널 DNA]
        - 대분류: {macro}
        - 소분류(니치): {niche}
        - 타겟 페르소나: {dna.target_audience_avatar}
        
        [지침]
        - 너무 일반적인 단어보다는 구체적인 'Long-tail' 검색어를 포함하세요.
        - 한국어와 영어 검색어를 적절히 섞어주세요.
        - 출력은 오직 JSON 리스트 형식으로만 하세요. 예: ["검색어1", "검색어2"]
        """
        
        try:
            response = self.llm.generate_content(prompt, self.default_model)
            # JSON 파싱 시도
            start = response.find("[")
            end = response.rfind("]") + 1
            if start != -1 and end != -1:
                queries = json.loads(response[start:end])
                logger.info(f"[OK] Generated {len(queries)} DNA-driven queries for {niche}")
                return queries
        except Exception as e:
            logger.error(f"[FAIL] Failed to generate DNA queries: {e}")
        
        # Fallback to general terms if AI fails
        return ["shorts", "trending shorts", niche, macro]

    def generate_dna_comment(self, dna: ChannelDNA, video_title: str, video_category: str = "general") -> str:
        """
        Generates a contextual comment based on the video title and channel persona.
        """
        persona = dna.target_audience_avatar
        tone = dna.script.tone_and_manner
        prohibited = ", ".join(dna.script.prohibited_words)
        
        prompt = f"""
        당신은 유튜브 시청자입니다. 다음 페르소나와 어조를 유지하며 영상에 댓글을 작성하세요.
        
        [당신의 페르소나]
        - 특성: {persona}
        - 어조 및 스타일: {tone}
        
        [영상 정보]
        - 제목: {video_title}
        - 카테고리: {video_category}
        
        [지침]
        - 너무 기계적이지 않게, 실제 사람처럼 자연스럽게 작성하세요.
        - 금지어({prohibited})는 절대 사용하지 마세요.
        - 이모지를 적절히 사용하여 감정을 표현하세요.
        - 오직 댓글 내용만 출력하세요.
        """
        
        try:
            comment = self.llm.generate_content(prompt, self.default_model)
            # 따옴표 등 제거
            clean_comment = comment.strip().strip('"').strip("'")
            logger.info(f"[OK] Generated DNA-driven comment for: {video_title[:20]}...")
            return clean_comment
        except Exception as e:
            logger.error(f"[FAIL] Failed to generate DNA comment: {e}")
            return "영상 잘 봤습니다! 👍" # Simple fallback

# Singleton-like access could be managed here
_generator = None

def get_intelligence_generator(settings):
    global _generator
    if _generator is None:
        _generator = WarmupIntelligenceGenerator(settings)
    return _generator

def generate_channel_dna(target_niche: str) -> dict:
    """
    Generates a full ChannelDNA JSON based on a simple target niche keyword using LLM.
    """
    from app.database import SessionLocal
    from app import crud
    
    db = SessionLocal()
    settings = crud.get_settings(db)
    generator = get_intelligence_generator(settings)
    
    prompt = f"""
    당신은 세계 최고의 유튜브 채널 브랜딩 전문가입니다.
    사용자가 제공한 다음 니치/키워드를 바탕으로 초정밀 유튜브 채널 DNA(페르소나 및 전략)를 JSON 형태로 생성하세요.
    반드시 앱에 정의된 ChannelDNA 스키마 포맷을 완벽하게 따라야 합니다.
    
    [타겟 키워드/니치]: {target_niche}
    
    출력은 오직 JSON 형식이어야 합니다. 예시 포맷:
    {{
        "version": 1,
        "target_audience_avatar": "구체적인 시청자 페르소나",
        "positioning": {{
            "macro_category": "대분류",
            "micro_niche": "소분류",
            "competitor_channels": ["채널1", "채널2"],
            "differentiation_strategy": "차별화 포인트"
        }},
        "script": {{
            "hook_formula": "오프닝 훅 공식",
            "adjective_enhancement": "표현 강화 규칙",
            "tone_and_manner": "어조",
            "prohibited_words": ["금칙어1"],
            "signature_closing": "아웃트로 멘트"
        }},
        "visual": {{
            "primary_layout": "주요 화면 배치",
            "font_family": "폰트",
            "caption_layout": "자막 스타일",
            "color_grading": "영상 색감",
            "b_roll_density": "시각 자료 빈도",
            "safe_zone_awareness": true
        }},
        "pacing": {{
            "cut_frequency_seconds": 3.0,
            "silence_removal_level": "STANDARD",
            "transition_style": "전환 기법",
            "bgm_genre_and_bpm": "BGM 장르 및 템포"
        }},
        "evolution": {{
            "retention_hooks_proven": ["검증된 유지 패턴"],
            "past_failures": ["실패 패턴"]
        }}
    }}
    """
    
    try:
        response = generator.llm.generate_content(prompt, generator.default_model)
        start = response.find("{")
        end = response.rfind("}") + 1
        if start != -1 and end != -1:
            dna_data = json.loads(response[start:end])
            logger.info(f"[OK] DNA Auto-generated for niche: {target_niche}")
            return dna_data
    except Exception as e:
        logger.error(f"[FAIL] Failed to auto-generate DNA: {e}")
        
    # Fallback to simple stub
    return {
        "version": 1,
        "target_audience_avatar": target_niche,
        "positioning": {
            "macro_category": target_niche,
            "micro_niche": target_niche,
            "competitor_channels": [],
            "differentiation_strategy": "일관성 유지"
        },
        "script": {
            "hook_formula": "핵심만 간결하게",
            "adjective_enhancement": "담담하게",
            "tone_and_manner": "전문가 톤",
            "prohibited_words": [],
            "signature_closing": "감사합니다."
        },
        "visual": {
            "primary_layout": "중앙 집중형",
            "color_grading": "Normal",
            "b_roll_density": "Moderate",
            "safe_zone_awareness": True
        },
        "pacing": {
            "cut_frequency_seconds": 3.0,
            "silence_removal_level": "STANDARD",
            "transition_style": "Cut",
            "bgm_genre_and_bpm": "None"
        },
        "evolution": {
            "retention_hooks_proven": [],
            "past_failures": []
        }
    }
