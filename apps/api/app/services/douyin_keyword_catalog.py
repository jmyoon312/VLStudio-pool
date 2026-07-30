"""
중국 더우인(抖音) 쇼츠 검색 키워드 체계
5070 한국 시청층의 클릭률 극대화를 위한 중국어 원문 검색 키워드 모음
"""
from typing import List, Dict


DOUYIN_SEARCH_KEYWORDS: Dict[str, List[str]] = {
    "가족갈등": ["婆媳关系", "母爱感人", "偏心", "争吵道产", "重男轻女", "不考子", "赡养纠纷",
                 "婆媳关系+打脸", "母爱感人+精彩片段", "偏心+遗产争夺"],
    "신분반전": ["吊丝逆袭", "隐姓埋名", "首富", "装穷", "打脸", "战神归了", "乞丐归来", "聊表衣",
                 "装穷+首富", "隐姓埋名+逆袭", "打脸+爽剧"],
    "불륜복수": ["出轨", "手撕小三", "渣男", "净身出户", "撕绿茶", "离婚反击",
                 "出轨+手撕小三+爽剧", "渣男+净身出户"],
    "타임슬립": ["重生", "穿越", "逆袭人生", "虐渣", "带空空间", "复仇重生",
                 "重生+复仇", "重生+首富", "重生+爽剧"],
    "모성감동": ["单亲妈妈", "母情深", "孤儿抚养", "收养", "养母之情",
                 "母爱+精彩片段", "养母之爱"],
    "메타태그": ["短剧", "爽剧", "解照", "热分", "爆款", "高甜", "精彩片断"],
}


def get_all_keywords() -> List[str]:
    out = []
    for kws in DOUYIN_SEARCH_KEYWORDS.values():
        for w in kws:
            if w not in out: out.append(w)
    return out

def get_keywords_by_category(cat: str) -> List[str]:
    return DOUYIN_SEARCH_KEYWORDS.get(cat, [])

def get_star_of_category(cat: str) -> str:
    stars = DOUYIN_SEARCH_KEYWORDS.get(cat, [])
    return stars[0] if stars else ""


def get_combos_for(category: str) -> List[str]:
    kws = DOUYIN_SEARCH_KEYWORDS.get(category, [])
    return [k for k in kws if "+" in k]