"""
DB 정리 및 수정 스크립트
- 동남아/인도 채널 삭제
- 중복 채널 정리 (channel_id 없는 버전 삭제)
- category_id 없는 채널에 youtube_channel_id로 channel_id 자동 추출 후 저장
- 카테고리 매니저 채널과 블루오션 시그널 연결 개선
"""
import sys
import re
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models import DiscoveryChannel, CategoryTree, DiscoveryVideo

db = SessionLocal()

# ──────────────────────────────────────────────
# STEP 1: 동남아/인도 채널 완전 삭제
# ──────────────────────────────────────────────
REJECT_KEYWORDS = [
    "sifa safira", "ibnu fhazar", "lady tillu", "esha yadav",
    "tarikul islam", "cc love", "apu alone", "dew asia",
    "mamá y mia", "pet ranking", "gv gaming", "wed f reels",
    "bn brothers", "dixon",
]

REJECT_CHANNEL_IDS = [
    # 인도네시아/인도/동남아 채널 ID
    "UCl7BGT04nSM47HGz4LcWAow",  # Sifa Safira
    "UCb8iIFUB-QH7WQBVkQQYQBw",  # Dew Asia
    "UCaite5NzgUb7B72Ssfggh6Q",  # Ibnu Fhazar
    "UCxFHibPseD1bYn-k8bWSpWA",  # LADY TILLU
    "UCzri401hB9yv3ik0TR7xwNA",  # Esha Yadav
    "UCyY4krBsUGzoj1Cjyj4nZqQ",  # Apu Alone
    "UC71ga3VMW44aroi6kLeiaIQ",  # Mamá y mia
    "UCdZTLsO4MZSGhj_Ys0-QJWA",  # Wed F Reels
    "UCopqjPZKOQ31rrVSQxFXnTw",  # Dixon
    "UCP-r32FFZMHKUAWvFYk5msA",  # The BN Brothers
    "UCHGUdEmowFa1tL7DfUiu2NA",  # GV GAMING
]

print("=== STEP 1: 동남아/인도 채널 삭제 ===")
deleted_count = 0
all_channels = db.query(DiscoveryChannel).all()
for ch in all_channels:
    name_lower = ch.name.lower()
    should_delete = False

    if ch.youtube_channel_id in REJECT_CHANNEL_IDS:
        should_delete = True
    elif any(kw in name_lower for kw in REJECT_KEYWORDS):
        should_delete = True

    if should_delete:
        # 연관된 DiscoveryVideo 먼저 삭제
        db.query(DiscoveryVideo).filter(DiscoveryVideo.channel_id == ch.id).delete(synchronize_session=False)
        db.delete(ch)
        print(f"  ❌ 삭제: ID={ch.id} | {ch.name} | {ch.youtube_channel_id}")
        deleted_count += 1

db.commit()
print(f"  → 총 {deleted_count}개 채널 삭제 완료\n")

# ──────────────────────────────────────────────
# STEP 2: 중복 채널 정리 (같은 이름, channel_id 없는 버전 삭제)
# ──────────────────────────────────────────────
print("=== STEP 2: 중복 채널 정리 ===")
all_channels = db.query(DiscoveryChannel).all()
duplicates_removed = 0

# 이름으로 그룹핑
from collections import defaultdict
name_groups = defaultdict(list)
for ch in all_channels:
    name_groups[ch.name.strip()].append(ch)

for name, group in name_groups.items():
    if len(group) <= 1:
        continue
    # channel_id 있는 것 vs 없는 것
    with_id = [ch for ch in group if ch.youtube_channel_id]
    without_id = [ch for ch in group if not ch.youtube_channel_id]

    if with_id and without_id:
        # channel_id 있는 버전에 category_id 병합 후 channel_id 없는 버전 삭제
        keeper = with_id[0]
        for loser in without_id:
            if loser.category_id and not keeper.category_id:
                keeper.category_id = loser.category_id
                print(f"  🔗 category_id 병합: {name} cat_id={loser.category_id}")
            db.query(DiscoveryVideo).filter(DiscoveryVideo.channel_id == loser.id).update(
                {"channel_id": keeper.id}, synchronize_session=False
            )
            db.delete(loser)
            print(f"  🗑️ 중복 제거: ID={loser.id} | {name} (channel_id 없는 버전)")
            duplicates_removed += 1

db.commit()
print(f"  → 총 {duplicates_removed}개 중복 채널 제거 완료\n")

# ──────────────────────────────────────────────
# STEP 3: youtube_channel_id 자동 추출 (URL에서)
# ──────────────────────────────────────────────
print("=== STEP 3: youtube_channel_id URL에서 추출 ===")
channels_no_id = db.query(DiscoveryChannel).filter(
    DiscoveryChannel.youtube_channel_id.is_(None),
    DiscoveryChannel.url.isnot(None),
).all()

extracted = 0
for ch in channels_no_id:
    url = ch.url or ""
    # /channel/UCxxxxx 형태 추출
    m = re.search(r'/channel/(UC[A-Za-z0-9_-]{22})', url)
    if m:
        ch.youtube_channel_id = m.group(1)
        print(f"  ✅ 추출: {ch.name} → {ch.youtube_channel_id}")
        extracted += 1

db.commit()
print(f"  → {extracted}개 채널 ID 추출 완료\n")

# ──────────────────────────────────────────────
# STEP 4: category_id 없는 채널 처리
# ──────────────────────────────────────────────
print("=== STEP 4: category_id 없는 채널 현황 ===")
no_cat = db.query(DiscoveryChannel).filter(
    DiscoveryChannel.category_id.is_(None),
    DiscoveryChannel.lifecycle_status == 'ACTIVE'
).all()
print(f"  ℹ️ category_id 없는 ACTIVE 채널: {len(no_cat)}개")
for ch in no_cat:
    print(f"    - ID={ch.id} | {ch.name} | {ch.url}")

# ──────────────────────────────────────────────
# STEP 5: 최종 현황 요약
# ──────────────────────────────────────────────
print("\n=== STEP 5: 최종 현황 ===")
total = db.query(DiscoveryChannel).count()
active = db.query(DiscoveryChannel).filter(DiscoveryChannel.lifecycle_status == 'ACTIVE').count()
active_with_id = db.query(DiscoveryChannel).filter(
    DiscoveryChannel.lifecycle_status == 'ACTIVE',
    DiscoveryChannel.youtube_channel_id.isnot(None)
).count()
active_with_cat = db.query(DiscoveryChannel).filter(
    DiscoveryChannel.lifecycle_status == 'ACTIVE',
    DiscoveryChannel.category_id.isnot(None)
).count()
rss_ready = db.query(DiscoveryChannel).filter(
    DiscoveryChannel.lifecycle_status == 'ACTIVE',
    DiscoveryChannel.youtube_channel_id.isnot(None),
    DiscoveryChannel.category_id.isnot(None)
).count()

print(f"  전체 채널: {total}")
print(f"  ACTIVE: {active}")
print(f"  ACTIVE + channel_id 있음: {active_with_id}")
print(f"  ACTIVE + category 있음: {active_with_cat}")
print(f"  ✅ RSS 수집 가능 (ACTIVE+channel_id+category): {rss_ready}")

# 카테고리별 RSS 가능 채널
cats = db.query(CategoryTree).all()
print(f"\n  카테고리별 RSS 수집 가능 채널:")
for cat in cats:
    rss = db.query(DiscoveryChannel).filter(
        DiscoveryChannel.category_id == cat.id,
        DiscoveryChannel.lifecycle_status == 'ACTIVE',
        DiscoveryChannel.youtube_channel_id.isnot(None)
    ).count()
    if rss > 0:
        print(f"    [{cat.level}] {cat.name}: {rss}개")

db.close()
print("\n✅ 정리 완료!")
