import os
from patchright.sync_api import sync_playwright

class DouyinChannelScraper:
    def __init__(self, settings=None):
        # Allow passing settings to get cookie path
        self.settings = settings
        self.headless = True # Default to True if cookies work

    def _parse_netscape_cookies(self, cookie_file):
        cookies = []
        if not cookie_file or not os.path.exists(cookie_file):
            return []
            
        try:
            with open(cookie_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('#') or not line.strip(): continue
                    parts = line.strip().split('\t')
                    if len(parts) >= 7:
                        cookie = {
                            'domain': parts[0],
                            'path': parts[2],
                            'secure': parts[3] == 'TRUE',
                            'expires': int(parts[4]) if parts[4] != '0' else -1,
                            'name': parts[5],
                            'value': parts[6]
                        }
                        # Filter for Douyin only to avoid pollution
                        if 'douyin.com' in cookie['domain']:
                            cookies.append(cookie)
            return cookies
        except Exception as e:
            print(f"Cookie parsing failed: {e}")
            return []

    def get_channel_info(self, url, headless=True):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            
            # Load Cookies
            cookie_list = []
            if self.settings and self.settings.cookies_path:
                print(f"Loading cookies from {self.settings.cookies_path}...")
                cookie_list = self._parse_netscape_cookies(self.settings.cookies_path)

            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080}
            )
            
            if cookie_list:
                try:
                    context.add_cookies(cookie_list)
                    print(f"Injected {len(cookie_list)} cookies.")
                except Exception as e:
                    print(f"Cookie injection warning: {e}")

            page = context.new_page()
            
            try:
                print(f"Scraping Douyin Profile: {url} (Headless={headless})")
                page.goto(url, timeout=60000)
                
                # Check for Captcha (Just in case)
                if not headless and page.locator('#captcha_verify_image').count() > 0:
                     print("⚠️ Captcha detected. Waiting for user...")
                     try:
                        page.wait_for_selector('#captcha_verify_image', state='hidden', timeout=60000)
                     except:
                        print("User did not solve captcha in time.")
                
                page.wait_for_load_state("networkidle")
                
                # Extract Info (Same as before)
                name = page.title()
                try:
                    name_el = page.locator("h1 span, .nickname, [data-e2e='user-title']").first
                    if name_el.is_visible(): name = name_el.inner_text()
                except: pass

                avatar = None
                try:
                    img_el = page.locator("img.avatar, .avatar-component img").first
                    if img_el.is_visible(): avatar = img_el.get_attribute("src")
                except: pass

                return {
                    'platform': 'douyin',
                    'name': name or 'Douyin User',
                    'id': url.split('/')[-1].split('?')[0],
                    'thumbnail': avatar
                }

            except Exception as e:
                print(f"Douyin Scrape Failed: {e}")
                return None
            finally:
                browser.close()

    def get_latest_video_urls(self, channel_url, limit=5, headless=True):
        """
        Visits the channel page and extracts the latest video URLs.
        """
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=headless)
            
            # Load Cookies
            cookie_list = []
            if self.settings and self.settings.cookies_path:
                print(f"Loading cookies from {self.settings.cookies_path}...")
                cookie_list = self._parse_netscape_cookies(self.settings.cookies_path)

            context = browser.new_context(
                # Desktop UA for grid view
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 
                viewport={'width': 1920, 'height': 1080}
            )
            
            if cookie_list:
                try:
                    context.add_cookies(cookie_list)
                except Exception as e:
                    print(f"Cookie injection warning: {e}")

            page = context.new_page()
            try:
                print(f"Monitor: Scanning {channel_url}...")
                page.goto(channel_url, timeout=60000)
                
                # Check for Captcha
                if page.locator('#captcha_verify_image').count() > 0:
                     print("⚠️ Captcha detected during scan!")
                
                page.wait_for_load_state("networkidle")
                
                # Extract Links
                # Look for links that contain '/video/'
                video_urls = set()
                links = page.locator('a').all()
                for link in links:
                    href = link.get_attribute('href')
                    if href and '/video/' in href:
                        # Normalize URL
                        if href.startswith('/'): 
                             href = f"https://www.douyin.com{href}"
                        
                        # Filter out unrelated links and ensure standard format
                        if 'douyin.com/video/' in href:
                             video_urls.add(href)
                
                print(f"Monitor: Found {len(video_urls)} videos.")
                return list(video_urls)

            except Exception as e:
                print(f"Monitor Failed: {e}")
                return []
            finally:
                browser.close()
