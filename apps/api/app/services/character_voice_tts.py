"""
CharacterVoiceTTS — 7+ 캐릭터 멀티 보이스 TTS 매핑

TypeCast 기반 한국어 성별/연령 목소리 프로필을 7개 제공한다.
대본 파싱 시 등장인물 ↔ 음성 매핑을 자동화한다.
"""
import re
from dataclasses import dataclass
from typing import Dict, Optional, List, Tuple


@dataclass
class VoiceProfile:
    id: str
    name_kr: str
    provider: str
    voice_id: str
    gender: str = "M"

    def __hash__(self):
        return hash(self.id)


# ─── 7+ Voice 세트 (TypeCastVoice API 기준) ───
CHARACTER_VOICES: Dict[str, VoiceProfile] = {
    "grandfather": VoiceProfile(
        id="elder_m", name_kr="할아버지", provider="typecast",
        voice_id="tc_elder_male_01", gender="M",
    ),
    "grandmother": VoiceProfile(
        id="elder_f", name_kr="할머니", provider="typecast",
        voice_id="tc_elder_female", gender="F",
    ),
    "middle_man": VoiceProfile(
        id="mid_m", name_kr="아저씨 중년", provider="typecast",
        voice_id="tc_kim_seongsu", gender="M",
    ),
    "middle_woman": VoiceProfile(
        id="mid_f", name_kr="아줌마", provider="typecast",
        voice_id="tc_hyunjoo", gender="F",
    ),
    "young_woman": VoiceProfile(
        id="young_f", name_kr="20대 여자", provider="typecast",
        voice_id="tc_suji_young", gender="F",
    ),
    "young_man": VoiceProfile(
        id="young_m", name_kr="20대 남자", provider="typecast",
        voice_id="tc_john", gender="M",
    ),
    "child_girl": VoiceProfile(
        id="child_f", name_kr="여자아이", provider="kokoro",
        voice_id="ko_child_f", gender="F",
    ),
    "child_boy": VoiceProfile(
        id="child_m", name_kr="아들아이", provider="kokoro",
        voice_id="ko_child_m", gender="M",
    ),
}

# character label → internal id
CHARACTER_ALIASES: Dict[str, str] = {
    "시어머니": "grandmother",
    "장모": "grandmother",
    "아내": "middle_woman",
    "며느리": "<young_woman",
    "시자/宅": "grandfather",
    "寶/甫": "middle_man",
    "두룵": "young_man",
    "秃 vip": "grandfather",
    "어린여자아이": "child_girl",
    "남장": "child_boy",
    "아들, 아니": None,
}


def get_voice_profile(character_type: str) -> VoiceProfile:
    """voice profile retrei"""
    return CHARACTER_VOICES.get(character_type, VoiceProfile("default", "풀", "typecast", ""))




#  Parse script
def parse_speaker_line(line: str) -> Tuple[Optional[str], str]:
    """[시어머니] text → returns (voice_key, text_content)"""
    match = re.match(r'\[([^\1]+)\]', line)
    if not match:
        return None, ""
    char_name = match.group(1).strip()
    voice_key = CHARACTER_ALIASES.get(char_name, "middle_man")  # default
    return voice_key, char_name


def default_voice_for_gender(gender: str) -> VoiceProfile:
    if gender == "F":
        return CHARACTER_VOICES["middle_woman"]
    return CHARACTER_VOICES["middle_man"]