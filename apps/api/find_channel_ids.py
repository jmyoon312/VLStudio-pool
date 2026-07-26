"""
한국 주요 유튜브 채널의 실제 채널 ID를 조회합니다.
"""
import requests
import re

# 채널 핸들로 channel_id 조회
channels_to_check = [
    ("잇섭", "https://www.youtube.com/@ITSub잇섭"),
    ("피식대학", "https://www.youtube.com/@pisikdaehak"),
    ("워크맨", "https://www.youtube.com/@workmanworker"),
    ("백종원", "https://www.youtube.com/@paik_jongwon"),
    ("곽튜브", "https://www.youtube.com/@kwahtube"),
    ("우왁굳", "https://www.youtube.com/@woowakgood"),
    ("SMTOWN", "https://www.youtube.com/@SMTOWN"),
    ("HYBE LABELS", "https://www.youtube.com/@HYBELABELS"),
    ("JYP", "https://www.youtube.com/@JYPEntertainment"),
    ("빠니보틀", "https://www.youtube.com/@pannibottle"),
    ("MBC Entertainment", "https://www.youtube.com/@MBCentertainment"),
    ("KBS Kpop", "https://www.youtube.com/@kbskpop"),
    ("JTBC Entertainment", "https://www.youtube.com/@jtbcentertainment"),
    ("워크맨", "https://www.youtube.com/@workmanworker"),
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

for name, url in channels_to_check:
    try:
        resp = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        # channel ID 추출
        match = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]{22})"', resp.text)
        if match:
            print(f'{name}: {match.group(1)}')
        else:
            # external_id 방식
            match2 = re.search(r'"externalId":"(UC[a-zA-Z0-9_-]{22})"', resp.text)
            if match2:
                print(f'{name}: {match2.group(1)}')
            else:
                print(f'{name}: NOT FOUND (status={resp.status_code})')
    except Exception as e:
        print(f'{name}: ERROR - {e}')
