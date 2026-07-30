import os
import time
from datetime import datetime
try:
    from patchright.sync_api import sync_playwright
except ImportError:
    pass

# 1. Douyin Downloader (TikVideo)
class TikVideoDownloader:
    """Handles downloading via TikVideo.app using Playwright (Bypass Strategy)."""

    def _ensure_playwright_installed(self):
        # NOTE: Assumes the necessary auto-install/check logic is run during service boot or in dependency_manager.
        pass

    def download(self, video_url, output_dir, headless=True):
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
            with sync_playwright() as p:
                print(f"Bypass: Launching browser (Headless={headless})...")
                browser = p.chromium.launch(headless=headless)
                # context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                page = browser.new_page()
                
                try:
                    # 1. Navigate
                    print(f"Bypass: Navigating to TikVideo for {video_url}...")
                    page.goto("https://tikvideo.app/ko/download-douyin-video", timeout=60000)
                    
                    # [Human Delay 1] Wait for initial load/ads
                    time.sleep(1.0)
                    kill_popups(page)
                    
                    # 2. Input URL
                    print("Bypass: Inputting URL...")
                    page.locator('input#s_input').click(force=True) # Ensure focus
                    page.fill('input#s_input', video_url)
                    
                    # [Human Delay 2] Wait before click
                    time.sleep(0.5)
                    
                    # 3. Click Start (Force)
                    print("Bypass: Clicking Start...")
                    try:
                        # Primary: .btn-red (from user HTML)
                        # Fallback: Text "다운로드"
                        start_btn = page.locator('button.btn-red').first
                        if not start_btn.is_visible():
                            start_btn = page.locator('button').filter(has_text="다운로드").first
                        
                        # Scroll to make sure it's in view
                        start_btn.scroll_into_view_if_needed()
                        
                        # Force click to ignore overlays
                        start_btn.click(force=True)
                        
                    except Exception as e:
                        print(f"Start click failed, trying Enter key: {e}")
                        page.press('input#s_input', 'Enter')
                    
                    # 4. Wait for Result
                    print("Bypass: Waiting for results...")
                    try:
                        # Wait for result container
                        page.wait_for_selector('.tik-video, .download-box', timeout=25000)
                    except:
                        # Retry logic if ad blocked the first click
                        print("Result not found. Retrying start click...")
                        kill_popups(page)
                        page.locator('button.btn-red').click(force=True)
                        page.wait_for_selector('.tik-video, .download-box', timeout=20000)

                    # 5. Find Download Link
                    # Look for .tik-button-dl (from user HTML)
                    download_links = page.locator('a.tik-button-dl')
                    if download_links.count() == 0:
                         # Fallback check
                         download_links = page.locator('a.btn-download, a:has-text("Download")')
                         if download_links.count() == 0:
                             # Check error
                             err = page.locator('.alert-danger, .error-msg')
                             if err.count() > 0:
                                 raise Exception(f"Site Error: {err.first.inner_text()}")
                             raise Exception("No download buttons (.tik-button-dl) found.")

                    # Prioritize "HD" or "MP4"
                    target_link = download_links.first
                    for i in range(download_links.count()):
                        txt = download_links.nth(i).inner_text()
                        if "HD" in txt or "MP4" in txt:
                            target_link = download_links.nth(i)
                            break
                    
                    print(f"Bypass: Selected link: {target_link.inner_text()}")

                    # 6. Trigger Download (Ad Handling)
                    
                    download = None
                    
                    # --- Attempt 1: Standard click with long timeout ---
                    try:
                        # Increased timeout to 90s as per request
                        with page.expect_download(timeout=90000) as download_info: 
                            target_link.click(force=True) # Always force click
                        download = download_info.value
                    except Exception as e:
                        print(f"Bypass: Download event missed on first attempt (Timeout): {e}")
                        
                        # --- Attempt 2: Retry with forced click and popup closure ---
                        try:
                            kill_popups(page)
                            print("Bypass: Retrying click after timeout...")
                            with page.expect_download(timeout=90000) as download_info_retry:
                                target_link.click(force=True)
                            download = download_info_retry.value
                        except Exception as e:
                            print(f"Bypass: Download event missed on second attempt as well. Error: {e}")
                            download = None

                    # 7. Save File (Only executed if expect_download succeeded OR fallback logic applies)
                    timestamp = int(time.time())
                    # [FIX] Distinguish between Douyin and TikTok for filename
                    prefix = "tiktok" if "tiktok.com" in video_url else "douyin"
                    filename = f"{prefix}_{timestamp}.mp4"
                    save_path = os.path.join(output_dir, filename)
                    
                    if download:
                        download.save_as(save_path)
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
                    else:
                        print("Bypass: Download event missed. Returning failure/fallback.")
                        raise Exception("Failed to capture download event. The file might not have started.")
                
                except Exception as e:
                    print(f"Bypass Logic Failed: {e}")
                    try:
                        timestamp = int(time.time())
                        page.screenshot(path=f"bypass_error_{timestamp}.png")
                    except: pass
                    return {'status': 'failed', 'error': str(e)}
                finally:
                    browser.close()

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

    def download(self, video_url, output_dir, headless=True):
        try:
            from patchright.sync_api import sync_playwright, expect
        except ImportError:
            return {'status': 'failed', 'error': 'Playwright missing'}

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=headless)
                page = browser.new_page()
                
                try:
                    print(f"Bypass(V2OB-{self.platform_key}): Navigating to {self.url}...")
                    page.goto(self.url, timeout=60000)
                    
                    # 1. Input URL (Robust Selector)
                    print(f"Bypass(V2OB-{self.platform_key}): Inputting URL...")
                    # Match any placeholder ending in "video URL here" (covers Douyin, Haokan, etc.)
                    input_box = page.locator("input[placeholder*='video URL here']")
                    input_box.click()
                    input_box.fill(video_url)
                    
                    # CRITICAL: Trigger input event to enable the button
                    # Some sites need a real keypress or explicit event
                    input_box.dispatch_event('input') 
                    page.wait_for_timeout(500) # Short delay for state update
                    
                    # 2. Click Start Parsing
                    print(f"Bypass(V2OB-{self.platform_key}): Clicking Start...")
                    # Find button by text
                    start_btn = page.locator('button').filter(has_text="Start Parsing")
                    # Also try generic "Start" if "Start Parsing" not found to be safe, but V2OB usually has Start Parsing
                    if start_btn.count() == 0:
                         start_btn = page.locator('button').filter(has_text="Start")
                    
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
                    page.wait_for_selector("#result", timeout=60000) 
                    
                    # 4. Locate Download Button
                    # Target "Download Video" or similar
                    download_btn_locator = page.locator('#result button:has-text("Download Video")')
                    
                    # Wait for the button to be clickable
                    download_btn_locator.wait_for(state="visible", timeout=10000) 
                    
                    # 5. Trigger Download
                    print(f"Bypass(V2OB-{self.platform_key}): Clicking Download Video button...")
                    download = None
                    try:
                        with page.expect_download(timeout=60000) as download_info:
                            download_btn_locator.click()
                        download = download_info.value
                    except Exception as e:
                        print(f"Download click retry (force=True): {e}")
                        with page.expect_download(timeout=60000) as download_info:
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
                finally:
                    browser.close()
        except Exception as e:
             return {'status': 'failed', 'error': f'Playwright error: {e}'}

# 3. Smart Fallback Downloader (Douyin Only for now)
class DouyinSmartDownloader:
    """Tries CloakDouyinDownloader first, then V2OB, then TikVideo."""
    def download(self, video_url, output_dir, headless=True):
        print("Strategy: Attempting Primary (CloakDouyin - direct aweme_detail API)...")
        try:
            cloak = CloakDouyinDownloader()
            result = cloak.download(video_url, output_dir, headless)
            if result.get('status') == 'success':
                return result
            print(f"CloakDouyin failed: {result.get('error', 'unknown')}. Trying V2OB...")
        except Exception as e:
            print(f"CloakDouyin exception: {e}. Trying V2OB...")

        try:
            v2ob = V2OBDownloader('douyin')
            result = v2ob.download(video_url, output_dir, headless)
            if result.get('status') == 'success':
                return result
            print(f"V2OB failed: {result.get('error', 'unknown')}. Trying TikVideo...")
        except Exception as e:
            print(f"V2OB exception: {e}. Trying TikVideo...")

        try:
            tik = TikVideoDownloader()
            return tik.download(video_url, output_dir, headless)
        except Exception as fallback_error:
            return {'status': 'failed', 'error': f'All strategies failed. Last error: {fallback_error}'}


# 4. CloakDouyinDownloader — cloakbrowser + aweme_detail API (direct, no 3rd-party)
class CloakDouyinDownloader:
    """Uses cloakbrowser stealth browser to intercept Douyin's aweme_detail API,
       extract the CDN video URL, and download via requests."""

    def download(self, video_url, output_dir, headless=True):
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
            with cloakbrowser.launch_context(
                headless=headless,
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale='zh-CN',
                viewport={'width': 1920, 'height': 1080},
                stealth_args=True,
            ) as context:
                page = context.new_page()

                # Visit Douyin to establish cookies
                page.goto('https://www.douyin.com/', wait_until='domcontentloaded', timeout=30000)
                page.wait_for_timeout(2000)

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

                page.on('response', on_response)

                # Navigate to video
                page.goto(video_url, wait_until='domcontentloaded', timeout=30000)
                page.wait_for_timeout(3000)

                if not detail_data:
                    print('[CloakDouyin] API response not captured, trying direct extraction...')
                    detail_data = self._try_extract_video_from_page(page)

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
