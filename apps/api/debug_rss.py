import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

channel_id = 'UCiBr0bK06imaMbLc8sAEz0A'
rss_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}'
resp = requests.get(rss_url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
print('Status:', resp.status_code)

ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
root = ET.fromstring(resp.text)

# 모든 태그 확인
print('Root tag:', root.tag)
print('Root attrib:', root.attrib)
for child in list(root)[:5]:
    print('  Child:', child.tag, '|', child.text[:50] if child.text else 'None')

# entry 검색
entries = root.findall("atom:entry", ns)
print(f'\nEntries found (atom:entry): {len(entries)}')

# 대안: 직접 태그 이름으로 검색
all_entries = [e for e in root.iter() if e.tag.endswith('}entry') or e.tag == 'entry']
print(f'Entries via iter: {len(all_entries)}')

if all_entries:
    e = all_entries[0]
    print('First entry children:')
    for c in e:
        print(f'  {c.tag}: {str(c.text)[:60] if c.text else None}')
