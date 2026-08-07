import sys
import os

# Append the directory containing the 'app' module
sys.path.append(r"c:\ViraLoopMedia\VLStudio-pool\apps\api")

from app import downloader

url = 'https://www.youtube.com/@MrBeast/shorts'
print(f"Testing {url}")
info = downloader.downloader.get_channel_info(url)
print("INFO:", info)
