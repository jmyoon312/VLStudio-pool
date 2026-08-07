import os
import time
from datetime import datetime
from contextlib import contextmanager

@contextmanager
def get_cloak_page(headless=True, user_data_dir=None, **kwargs):
    import cloakbrowser
    if user_data_dir:
        with cloakbrowser.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=headless,
            **kwargs
        ) as context:
            # Persistent context might already have a page
            pages = context.pages
            if pages:
                yield pages[0]
            else:
                yield context.new_page()
    else:
        with cloakbrowser.launch_context(
            headless=headless,
            **kwargs
        ) as context:
            yield context.new_page()

@contextmanager
def get_or_create_page(existing_page=None, headless=True, user_data_dir=None, **kwargs):
    if existing_page:
        yield existing_page
    else:
        with get_cloak_page(headless=headless, user_data_dir=user_data_dir, **kwargs) as page:
            yield page

# 1. Douyin Downloader (TikVideo)
class TikVideoDownloader:
    """Handles downloading via TikVideo.app using Playwright (Bypass Strategy)."""

    def _ensure_playwright_installed(self):
        # NOTE: Assumes the necessary auto-install/check logic is run during service boot or in dependency_manager.
        pass

    def download(self, video_url, output_dir, headless=True, user_data_dir=None, page=None):
        self._ensure_playwright_installed()
        
        # Aggressive Popup Killer utility function
        def kill_popups(page):
            try:
                popups = page.locator('button:has-text("Close"), button:has-text("닫기"), .modal-close, .close-btn, #cboxClose')
                count = popups.count()
                if count > 0:
                    print(f"Bypass: {count} popups detected. Closing...")
                    for i in range(count):
                        try:
                            if popups.nth(i).is_visible():
                                popups.nth(i).click(timeout=500, force=True)
                        except: pass
            except: pass

        try:
            import cloakbrowser
        except ImportError:
            return {'status': 'failed', 'error': 'cloakbrowser missing'}

        try:
            with get_or_create_page(
                existing_page=page,
                headless=headless,
                stealth_args=True,
                viewport={'width': 1920, 'height': 1080},
                user_data_dir=user_data_dir
            ) as current_page:
                print(f"Bypass: Launching browser via CloakBrowser (Headless={headless})...")
                
                try:
                    # 1. Navigate
                    print(f"Bypass: Navigating to TikVideo for {video_url}...")
                    current_page.goto("https://tikvideo.app/ko/download-douyin-video", timeout=60000)
                    
                    # [Human Delay 1] Wait for initial load/ads
                    time.sleep(1.0)
                    kill_popups(current_page)
                    
                    # 2. Input URL
                    print("Bypass: Inputting URL...")
                    current_page.locator('input#s_input').click(force=True) # Ensure focus
                    current_page.fill('input#s_input', video_url)
                    
                    # [Human Delay 2] Wait before click
                    time.sleep(0.5)
                    kill_popups(current_page)
                    
                    # 3. Click Download
                    print("Bypass: Clicking Download...")
                    current_page.locator('button#btn-submit').click(force=True)
                    
                    # 4. Wait for Results container (it creates a table or div with download links)
                    print("Bypass: Waiting for results container...")
                    # TikVideo uses a container usually #tiktok-parse-result or something similar
                    # We'll wait for any 'a' tag that contains 'douyin' or 'download' text in href
                    # A robust way: wait for network idle or a specific button
                    
                    # wait until the page shows download buttons
                    current_page.wait_for_selector('a.btn-download', timeout=60000) 
                    
                    # [Human Delay 3] Let UI settle
                    time.sleep(1.0)
                    kill_popups(current_page)
                    
                    # 5. Extract video download URL
                    # Usually the first download link is the no-watermark video
                    print("Bypass: Extracting video URL...")
                    dl_links = current_page.locator('a.btn-download').all()
                    dl_url = None
                    for link in dl_links:
                        href = link.get_attribute('href')
                        # look for mp4 or download link
                        if href and ('http' in href or 'download' in href):
                            dl_url = href
                            break
                    
                    if not dl_url:
                        raise Exception("Download link not found in results.")
                        
                    print(f"Bypass: Found CDN URL: {dl_url[:100]}...")
                    
                    # 6. Stream Download manually
                    # Using requests so we don't rely on Playwright's download interceptor which can be finicky
                    print(f"Bypass: Streaming download to disk...")
                    import requests
                    
                    timestamp = int(time.time())
                    prefix = "douyin" if "douyin" in video_url else "tiktok"
                    filename = f"{prefix}_{timestamp}.mp4"
                    save_path = os.path.join(output_dir, filename)
                    
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Referer': 'https://tikvideo.app/'
                    }
                    
                    response = requests.get(dl_url, stream=True, timeout=120, headers=headers)
                    response.raise_for_status()
                    
                    with open(save_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                            
                    print(f"Bypass: Download success: {save_path}")
                    
                    # [FIX] Correct metadata for Gallery display
                    platform_name = "TikTok" if "tiktok.com" in video_url else "Douyin"
                    return {
                        'status': 'success',
                        'file_path': save_path,
                        'thumbnail_path': None,
                        'metadata': {
                            'id': f'{prefix}_{timestamp}',
                            'title': f'{platform_name} Video {timestamp}', 
                            'uploader': platform_name,
                            'upload_date': datetime.now().strftime('%Y%m%d')
                        }
                    }
                
                except Exception as e:
                    print(f"Bypass Logic Failed: {e}")
                    try:
                        timestamp = int(time.time())
                        current_page.screenshot(path=f"bypass_error_{timestamp}.png")
                    except: pass
                    return {'status': 'failed', 'error': str(e)}

        except ImportError as e:
            return {'status': 'failed', 'error': f'Server dependency missing: Playwright ({e})'}
        except Exception as e:
            return {'status': 'failed', 'error': f'Bypass download failed: {e}'}

# 2. Generic V2OB Downloader (Supports 15+ Platforms)
class V2OBDownloader:
    """Handles downloading via v2ob.com for multiple platforms (Haokan, Douyin, Kuaishou, etc.)."""
    
    def __init__(self, platform_key):
        self.platform_key = platform_key
        # Ensure we just append the key. v2ob structure is /en/<platform_key>
        self.url = f"https://www.v2ob.com/en/{platform_key}"

    def download(self, video_url, output_dir, headless=True, user_data_dir=None, page=None):
        try:
            from patchright.sync_api import expect
            import cloakbrowser
        except ImportError:
            return {'status': 'failed', 'error': 'Playwright or cloakbrowser missing'}

        try:
            with get_or_create_page(
                existing_page=page,
                headless=headless,
                stealth_args=True,
                viewport={'width': 1920, 'height': 1080},
                user_data_dir=user_data_dir
            ) as current_page:
                
                try:
                    print(f"Bypass(V2OB-{self.platform_key}): Navigating to {self.url}...")
                    current_page.goto(self.url, timeout=60000)
                    
                    # 1. Input URL (Robust Selector)
                    print(f"Bypass(V2OB-{self.platform_key}): Inputting URL...")
                    # Match any placeholder ending in "video URL here" (covers Douyin, Haokan, etc.)
                    input_box = current_page.locator("input[placeholder*='video URL here']")
                    input_box.click()
                    input_box.fill(video_url)
                    
                    # CRITICAL: Trigger input event to enable the button
                    # Some sites need a real keypress or explicit event
                    input_box.dispatch_event('input') 
                    current_page.wait_for_timeout(500) # Short delay for state update
                    
                    # 2. Click Start Parsing
                    print(f"Bypass(V2OB-{self.platform_key}): Clicking Start...")
                    # Find button by text
                    start_btn = current_page.locator('button').filter(has_text="Start Parsing")
                    # Also try generic "Start" if "Start Parsing" not found to be safe, but V2OB usually has Start Parsing
                    if start_btn.count() == 0:
                         start_btn = current_page.locator('button').filter(has_text="Start")
                    
                    # Wait for button to be ENABLED (remove disabled attribute)
                    try:
                        # Wait up to 5s for button to become enabled
                        expect(start_btn.first).not_to_be_disabled(timeout=5000)
                    except:
                        # Fallback: Force click if check fails
                        print("Button state check timed out, trying force click...")
                    
                    start_btn.first.click(force=True)
                    
                    # 3. Wait for Result Container
                    print(f"Bypass(V2OB-{self.platform_key}): Waiting for result container (#result)...")
                    current_page.wait_for_selector("#result", timeout=60000) 
                    
                    # 4. Locate Download Button
                    # Target "Download Video" or similar
                    download_btn_locator = current_page.locator('#result button:has-text("Download Video")')
                    
                    # Wait for the button to be clickable
                    download_btn_locator.wait_for(state="visible", timeout=10000) 
                    
                    # 5. Trigger Download
                    print(f"Bypass(V2OB-{self.platform_key}): Clicking Download Video button...")
                    download = None
                    try:
                        with current_page.expect_download(timeout=60000) as download_info:
                            download_btn_locator.click()
                        download = download_info.value
                    except Exception as e:
                        print(f"Download click retry (force=True): {e}")
                        with current_page.expect_download(timeout=60000) as download_info:
                            download_btn_locator.click(force=True)
                        download = download_info.value
                    
                    # 6. Save File
                    timestamp = int(time.time())
                    filename = f"{self.platform_key}_{timestamp}.mp4"
                    save_path = os.path.join(output_dir, filename)
                    download.save_as(save_path)
                    
                    print(f"Bypass(V2OB-{self.platform_key}): Success -> {save_path}")
                    return {
                        'status': 'success', 
                        'file_path': save_path, 
                        'thumbnail_path': None, 
                        'metadata': {
                            'id': f'{self.platform_key}_{timestamp}',
                            'title': f'{self.platform_key.capitalize()} Video {timestamp}', 
                            'uploader': self.platform_key.capitalize(), 
                            'upload_date': datetime.now().strftime('%Y%m%d')
                        }
                    }
                    
                except Exception as e:
                    print(f"V2OB-{self.platform_key} Failed: {e}")
                    return {'status': 'failed', 'error': str(e)}
        except Exception as e:
             return {'status': 'failed', 'error': f'Playwright error: {e}'}

# 3. Smart Fallback Downloader (Douyin Only for now)
class DouyinSmartDownloader:
    """Tries CloakDouyinDownloader first, then V2OB, then TikVideo."""
    def download(self, video_url, output_dir, headless=True, user_data_dir=None):
        try:
            with get_cloak_page(
                headless=headless,
                stealth_args=True,
                viewport={'width': 1920, 'height': 1080},
                user_data_dir=user_data_dir
            ) as page:
                
                print("Strategy: Attempting Primary (CloakDouyin - direct aweme_detail API)...")
                try:
                    cloak = CloakDouyinDownloader()
                    result = cloak.download(video_url, output_dir, headless, user_data_dir=user_data_dir, page=page)
                    if result.get('status') == 'success':
                        return result
                    print(f"CloakDouyin failed: {result.get('error', 'unknown')}. Trying V2OB...")
                except Exception as e:
                    print(f"CloakDouyin failed: {e}. Trying V2OB...")
                    
                try:
                    print("Strategy: Attempting Secondary (V2OB)...")
                    result = V2OBDownloader('douyin').download(video_url, output_dir, headless=headless, user_data_dir=user_data_dir, page=page)
                    if result.get('status') == 'success':
                        return result
                    print(f"V2OB failed: {result.get('error')}. Trying TikVideo...")
                except Exception as e:
                    print(f"V2OB failed: {e}. Trying TikVideo...")

                print("Strategy: Attempting Tertiary (TikVideoDownloader)...")
                try:
                    tik = TikVideoDownloader()
                    return tik.download(video_url, output_dir, headless=headless, user_data_dir=user_data_dir, page=page)
                except Exception as fallback_error:
                    return {'status': 'failed', 'error': f'All strategies failed. Last error: {fallback_error}'}
        except Exception as e:
            return {'status': 'failed', 'error': f'Failed to launch persistent context: {e}'}


# 4. CloakDouyinDownloader — cloakbrowser + aweme_detail API (direct, no 3rd-party)
class CloakDouyinDownloader:
    """Uses cloakbrowser stealth browser to intercept Douyin's aweme_detail API,
       extract the CDN video URL, and download via requests."""

    def download(self, video_url, output_dir, headless=True, user_data_dir=None, page=None):
        try:
            import cloakbrowser
        except ImportError:
            return {'status': 'failed', 'error': 'cloakbrowser not installed'}
        try:
            import requests
        except ImportError:
            return {'status': 'failed', 'error': 'requests not available'}

        aweme_id = self._extract_aweme_id(video_url)
        if not aweme_id:
            return {'status': 'failed', 'error': f'Could not parse aweme_id from {video_url[:80]}'}

        os.makedirs(output_dir, exist_ok=True)

        try:
            with get_or_create_page(
                existing_page=page,
                headless=headless,
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale='zh-CN',
                viewport={'width': 1920, 'height': 1080},
                stealth_args=True,
                user_data_dir=user_data_dir
            ) as current_page:

                # Visit Douyin to establish cookies
                current_page.goto('https://www.douyin.com/', wait_until='domcontentloaded', timeout=30000)
                current_page.wait_for_timeout(2000)

                # Capture aweme_detail response
                detail_data = {}
                def on_response(resp):
                    nonlocal detail_data
                    if detail_data:
                        return
                    if f'aweme_id={aweme_id}' in resp.url and 'aweme/v1/web/aweme/detail' in resp.url:
                        try:
                            body = resp.body()
                            data = json.loads(body.decode('utf-8'))
                            detail_data = data.get('aweme_detail', {})
                        except:
                            pass

                current_page.on('response', on_response)

                # Navigate to video
                current_page.goto(video_url, wait_until='domcontentloaded', timeout=30000)
                current_page.wait_for_timeout(5000)

                if not detail_data:
                    print('[CloakDouyin] API response not captured, trying direct extraction...')
                    detail_data = self._try_extract_video_from_page(current_page)

                if not detail_data:
                    return {'status': 'failed', 'error': 'Could not extract video data. Page blocked or video unavailable.'}

                video_info = detail_data.get('video', {})
                author_info = detail_data.get('author', {})
                stats_info = detail_data.get('statistics', {})
                description_detail = detail_data.get('desc', '')

                # Get video CDN URL
                video_cdn_url = None
                play_addr = video_info.get('download_addr') or video_info.get('play_addr') or {}
                if not play_addr:
                    bit_rates = video_info.get('bit_rate', [])
                    for br in bit_rates:
                        pa = br.get('play_addr', {})
                        if pa.get('url_list'):
                            play_addr = pa
                            break

                url_list = play_addr.get('url_list', [])
                if url_list:
                    video_cdn_url = url_list[0]

                if not video_cdn_url:
                    # Fallback: try to find in bit_rate list
                    for br in video_info.get('bit_rate', []):
                        for u in b.get('play_addr', {}).get('url_list', []):
                            if u:
                                video_cdn_url = u
                                break
                        if video_cdn_url:
                            break

                if not video_cdn_url:
                    return {'status': 'failed', 'error': 'No video CDN URL found in aweme_detail'}

                # Download mp4
                filename = f"douyin_{aweme_id}.mp4"
                save_path = os.path.join(output_dir, filename)

                print(f'[CloakDouyin] Downloading from CDN: {video_cdn_url[:100]}...')
                resp = requests.get(video_cdn_url, stream=True, timeout=120, headers={
                    'Referer': 'https://www.douyin.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                })
                resp.raise_for_status()

                with open(save_path, 'wb') as f:
                    for chunk in resp.iter_content(8192):
                        f.write(chunk)

                duration_sec = (video_info.get('duration', 0) or 0) / 1000.0
                view_count = stats_info.get('digg_count', 0) or 0
                uploader_name = author_info.get('nickname', '')

                print(f'[CloakDouyin] Success: {save_path}')
                return {
                    'status': 'success',
                    'file_path': save_path,
                    'thumbnail_path': None,
                    'metadata': {
                        'id': str(aweme_id),
                        'title': description_detail or f'onVideo {aweme_id}',
                        'uploader': uploader_name or 'douyin',
                        'duration_sec': duration_sec,
                        'view_count': view_count,
                        'upload_date': datetime.now().strftime('%Y%m%d'),
                    },
                }

        except Exception as e:
            print(f'[CloakDouyin] Error: {e}')
            return {'status': 'failed', 'error': str(e)}

    def _extract_aweme_id(self, url):
        import re
        
        # Resolve short URLs (like v.douyin.com) first
        if 'v.douyin.com' in url or 'iesdouyin.com' in url:
            try:
                import requests
                r = requests.head(url, allow_redirects=True, timeout=10)
                url = r.url
            except Exception as e:
                print(f"[CloakDouyin] Failed to resolve short URL: {e}")

        match = re.search(r'(?:video|aweme)(?:/|%2F)([0-9]{15,20})', url)
        if match:
            return match.group(1)
        return None

    def _try_extract_video_from_page(self, page):
        detail = {}
        try:
            import re, json
            html = page.content()
            # Try to find __INITIAL_STATE__ or similar
            match = re.search(r'window\.\w*(?:_DATA|_STATE|_PRELOADED_STATE)\s*=\s*(\{.*?\})\s*;', html, re.DOTALL)
            if match:
                raw = match.group(1)
                if raw:
                    detail = json.loads(raw)
                    return detail
            # Try script[type="application/json"]
            script_tags = page.locator('script[type="application/json"], script[id*="RENDER"]').all()
            for tag in script_tags:
                inner = tag.inner_text()
                try:
                    parsed = json.loads(inner)
                    if isinstance(parsed, dict):
                        aweme = (
                            parsed.get('video', {}).get('data', {}).get('awemeDetail')
                            or parsed.get('awemeDetail')
                            or parsed.get('item')
                        )
                        if aweme:
                            return aweme
                except:
                    pass
        except:
            pass
        return detail
