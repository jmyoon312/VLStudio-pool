import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

channel_id = 'UCiBr0bK06imaMbLc8sAEz0A'
rss_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}'
resp = requests.get(rss_url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})

ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
root = ET.fromstring(resp.text)

cutoff = datetime.now() - timedelta(days=90)
print(f"Cutoff: {cutoff}")

entries = root.findall("atom:entry", ns)
print(f"Total entries: {len(entries)}")

video_ids = []
for entry in entries:
    vid_id_el = entry.find("yt:videoId", ns)
    published_el = entry.find("atom:published", ns)
    
    vid_id = vid_id_el.text if vid_id_el is not None else 'NONE'
    pub_text = published_el.text if published_el is not None else 'NONE'
    
    # date check
    skip = False
    if published_el is not None:
        try:
            pub_str = published_el.text.replace("Z", "+00:00")
            pub_dt = datetime.fromisoformat(pub_str).replace(tzinfo=None)
            skip = pub_dt < cutoff
            print(f"  {pub_dt.date()} | {vid_id} | skip={skip}")
        except Exception as e:
            print(f"  DATE ERROR: {e}")
    
    if not skip and vid_id_el is not None:
        video_ids.append(vid_id)

print(f"\nResult: {len(video_ids)} valid video IDs")
print("IDs:", video_ids[:5])
