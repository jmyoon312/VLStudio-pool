import sys
import os
import re

# Append the directory containing the 'app' module
sys.path.append(r"c:\ViraLoopMedia\VLStudio-pool\apps\api")

from app import downloader

url = 'https://www.youtube.com/@%EC%98%81%ED%99%94%EB%A6%AC%EB%B7%B0/shorts'
if 'youtube.com' in url or 'youtu.be' in url:
    clean_url = re.sub(r'/(shorts|videos|streams|live|playlists|community|featured).*?$', '', url)
else:
    clean_url = url

print("Original:", url)
print("Clean:", clean_url)

info = downloader.downloader.get_channel_info(clean_url)
print("INFO:", info)
