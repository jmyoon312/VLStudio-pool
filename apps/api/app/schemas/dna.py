from pydantic import BaseModel, Field
from typing import List, Optional

class NichePositioning(BaseModel):
    """채널의 시장 포지셔닝 및 차별화 전략"""
    macro_category: str = Field(..., description='대분류 (예: "시니어사연", "Lofi Music", "영화짜집기")')
    micro_niche: str = Field(..., description='소분류 (예: "50대 시모 갈등 사연", "사이버펑크 비내리는 Lofi")')
    competitor_channels: List[str] = Field(default_factory=list, description='레퍼런스로 삼는 타겟 경쟁 채널 ID들')
    differentiation_strategy: str = Field(default="", description='경쟁 채널과의 차별화 포인트')

class ScriptFlavor(BaseModel):
    """대본의 말맛(Kick)과 서사 구조"""
    hook_formula: Optional[str] = Field(None, description='오프닝 훅 공식 (예: "질문 던지기 + 3초 내 충격적 시각자료 제시")')
    adjective_enhancement: Optional[str] = Field(None, description='표현의 디테일 강화 규칙 (예: "사과가 맛있다" -> "파란 사과가 아삭하게 맛있다")')
    tone_and_manner: Optional[str] = Field(None, description='문체 (예: "냉소적이지만 팩트 기반의 전문가 톤")')
    prohibited_words: List[str] = Field(default_factory=list, description='절대 쓰지 말아야 할 단어 (플랫폼 금칙어 포함)')
    signature_closing: Optional[str] = Field(None, description='채널 특유의 아웃트로 멘트')

class VisualComposition(BaseModel):
    """화면 분석 및 구성 가이드 (픽셀링/에디터 에이전트용)"""
    primary_layout: str = Field(..., description='주요 화면 배치 (예: "상하 분할", "전체 화면 정적인 일러스트")')
    font_family: Optional[str] = Field(None, description='자막 폰트 (예: "GmarketSansBold")')
    caption_layout: Optional[str] = Field(None, description='자막 위치 및 스타일 (예: "하단 중앙, 노란색 테두리 두껍게")')
    color_grading: str = Field(default="Normal", description='영상 색감 (예: "명도 대비가 강한 Cyberpunk 네온 톤", "빈티지 필터")')
    b_roll_density: str = Field(default="Moderate", description='시각 자료 빈도 (예: "3~5초마다 컷 전환", "1시간 동안 동일 루프")')
    safe_zone_awareness: bool = Field(default=True, description='쇼츠 UI(좋아요, 댓글 버튼) 가림 방지 여부')

class PacingAndRhythm(BaseModel):
    """1초 단위의 템포 및 오디오 호흡"""
    cut_frequency_seconds: float = Field(default=2.0, description='평균 컷 전환 시간 (초)')
    silence_removal_level: str = Field(default="STANDARD", description='오디오 공백 제거 강도 (NONE, CONSERVATIVE, STANDARD, AGGRESSIVE)')
    transition_style: str = Field(default="Cut", description='화면 전환 기법 (예: "Glitch transition with Whoosh SFX")')
    bgm_genre_and_bpm: str = Field(default="None", description='선호 BGM 장르 및 템포 (예: "Phonk, 120BPM+", "잔잔한 LoFi 60BPM")')

class SuccessEvolution(BaseModel):
    """지속적인 성찰(Phase 10)을 통해 업데이트되는 지식"""
    retention_hooks_proven: List[str] = Field(default_factory=list, description='데이터로 검증된 시청 지속시간 유지 패턴')
    past_failures: List[str] = Field(default_factory=list, description='이탈률이 높았던 실패 패턴 (다시 하지 않기 위해)')

class ChannelDNA(BaseModel):
    """
    Sovereign Intelligence v2.0 - 초정밀 채널 DNA 스키마
    모든 에이전트는 작업 전 이 DNA를 참고하여 일관성과 차별성을 유지해야 합니다.
    """
    version: int = Field(default=1, description='DNA 업데이트 횟수 (Phase 10 성찰마다 1씩 증가)')
    target_audience_avatar: str = Field(default="", description='구체적인 페르소나 (예: "출퇴근길에 숏폼을 보는 20대 남성 직장인")')
    
    positioning: NichePositioning
    script: ScriptFlavor
    visual: VisualComposition
    pacing: PacingAndRhythm
    evolution: SuccessEvolution

    class Config:
        json_schema_extra = {
            "example": {
                "version": 1,
                "target_audience_avatar": "50대 은퇴 후 제2의 인생을 준비하는 남성",
                "positioning": {
                    "macro_category": "시니어사연",
                    "micro_niche": "50대 남성의 귀농 실패담",
                    "competitor_channels": ["UC_sample1", "UC_sample2"],
                    "differentiation_strategy": "감정에 호소하지 않고 객관적인 수치와 팩트 위주의 썰 풀이"
                },
                "script": {
                    "hook_formula": "가장 손해본 금액부터 먼저 말하고 시작",
                    "adjective_enhancement": "상황을 과장되게 묘사하는 형용사 필수 사용",
                    "tone_and_manner": "옆집 아저씨가 담담하게 말하는 톤",
                    "prohibited_words": ["주식", "코인", "도박"],
                    "signature_closing": "오늘도 잘 버티셨습니다. 내일 또 뵙죠."
                },
                "visual": {
                    "primary_layout": "AI 생성된 50대 남성 아바타 중앙 배치",
                    "font_family": "Pretendard-Bold",
                    "caption_layout": "화면 중앙에 큰 글씨 (시니어 배려)",
                    "color_grading": "따뜻하고 약간 낡은 느낌의 세피아 톤",
                    "b_roll_density": "15초마다 분위기에 맞는 시골 풍경 컷 삽입",
                    "safe_zone_awareness": True
                },
                "pacing": {
                    "cut_frequency_seconds": 3.0,
                    "silence_removal_level": "CONSERVATIVE",
                    "transition_style": "Slow Fade",
                    "bgm_genre_and_bpm": "어쿠스틱 기타, 60BPM 이하"
                },
                "evolution": {
                    "retention_hooks_proven": ["영상 중간에 실제 귀농 비용 명세서 이미지 노출"],
                    "past_failures": ["도입부에 10초 이상 풍경만 보여준 영상은 이탈률 80% 달성"]
                }
            }
        }
