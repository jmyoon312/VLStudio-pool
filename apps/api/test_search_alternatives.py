import urllib.request
import urllib.parse
import json
import re

def search_duckduckgo(keyword):
    print(f"--- DuckDuckGo Search: {keyword} ---")
    try:
        url = "https://html.duckduckgo.com/html/"
        data = urllib.parse.urlencode({'q': f'site:douyin.com/video/ "{keyword}"'}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        
        matches = re.findall(r'href="(https://(?:www\.)?douyin\.com/video/\d+)"', html)
        print(f"Found {len(matches)} links:")
        for m in set(matches):
            print(m)
    except Exception as e:
        print("DuckDuckGo failed:", e)

def search_baidu(keyword):
    print(f"\n--- Baidu Search: {keyword} ---")
    try:
        url = f"https://www.baidu.com/s?wd={urllib.parse.quote('site:douyin.com/video/ ' + keyword)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        
        # Baidu redirects links, but we can look for douyin.com/video text or data-url
        # Or look for titles
        if "douyin.com/video/" in html:
            print("Found Douyin video references in Baidu HTML.")
        else:
            print("No obvious Douyin video references found.")
    except Exception as e:
        print("Baidu failed:", e)

if __name__ == "__main__":
    search_duckduckgo("母爱感人")
    search_baidu("母爱感人")
