import sys
from pathlib import Path
import urllib.parse

def run_test():
    url = "https://www.douyin.com/user/MS4wLjABAAAAaN_R7T3Xh5R8S8hD2-H7jL_B9yT8c-3-WzM_M" # random user
    
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
            if "douyin_login_comp" in html or "手机号" in html:
                print("Login popup detected on user profile as well.")
            else:
                print("User profile loaded successfully without login popup.")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    run_test()
