import sys
from pathlib import Path
import urllib.parse

def run_test():
    keyword = "母爱感人"
    encoded_kw = urllib.parse.quote(keyword)
    url = f"https://www.douyin.com/search/{encoded_kw}?type=video"
    
    try:
        import cloakbrowser
        with cloakbrowser.launch_context(
            headless=True,
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale='zh-CN',
            viewport={'width': 1920, 'height': 1080},
            stealth_args=True,
        ) as context:
            page = context.new_page()
            
            print(f"Navigating to {url}...")
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(5000)
            
            html = page.content()
            with open("douyin_dump.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("Dumped HTML to douyin_dump.html")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    run_test()
