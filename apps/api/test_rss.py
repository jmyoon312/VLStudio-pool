import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# channel_id 방식으로 RSS 테스트
channel_id = 'UCddiUEpeqJcYeBxX1IVBKvQ'
rss_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}'
resp = requests.get(rss_url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
print('Status:', resp.status_code)

ns = {'atom': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
root = ET.fromstring(resp.text)

# 채널명
title_el = root.find('atom:title', ns)
author_el = root.find('atom:author/atom:name', ns)
print('Feed title:', title_el.text if title_el is not None else 'N/A')
print('Author:', author_el.text if author_el is not None else 'N/A')

entries = root.findall('atom:entry', ns)
print(f'Total entries: {len(entries)}')

cutoff = datetime.now() - timedelta(days=30)
for e in entries[:5]:
    vid_el = e.find('yt:videoId', ns)
    pub_el = e.find('atom:published', ns)
    title_el2 = e.find('atom:title', ns)
    vid_id = vid_el.text if vid_el is not None else 'N/A'
    pub = pub_el.text if pub_el is not None else 'N/A'
    title = title_el2.text[:40] if title_el2 is not None else 'N/A'
    print(f'  {pub} | {vid_id} | {title}')

# UUSH 테스트
print('\n=== UUSH (Shorts) ===')
playlist_id = 'UUSH' + channel_id[2:]
rss_url2 = f'https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}'
resp2 = requests.get(rss_url2, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
print('UUSH Status:', resp2.status_code)
print('UUSH body[:300]:', resp2.text[:300])
