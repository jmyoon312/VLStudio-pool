import sys
import os
import re
import urllib.parse

# Append the directory containing the 'app' module
sys.path.append(r"c:\ViraLoopMedia\VLStudio-pool\apps\api")

from app import downloader
from app.download_strategies.yt_dlp_strategy import YTDLPDownloader

test_urls = [
    "https://www.youtube.com/@%EC%98%81%ED%99%94%EB%A6%AC%EB%B7%B0/shorts",
    "https://www.youtube.com/@%EC%98%81%ED%99%94%EB%A6%AC%EB%B7%B0",
    "https://www.youtube.com/@user/videos?app=desktop",
    "https://youtube.com/channel/UC9-VAxSv_-hOWj8J3WQGOFg/live"
]

for url in test_urls:
    print(f"\n--- Testing: {url} ---")
    if 'youtube.com' in url or 'youtu.be' in url:
        clean_url = re.sub(r'/(shorts|videos|streams|live|playlists|community|featured).*?$', '', url)
        clean_url = clean_url.rstrip('/')
    else:
        clean_url = url
        
    print(f"Clean URL: {clean_url}")
    info = downloader.downloader.get_channel_info(clean_url)
    print("Result:", info is not None)
