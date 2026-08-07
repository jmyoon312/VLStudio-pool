"""
local_browser.py
윈도우 네이티브 환경에서 CloakBrowser(Patchright 기반)를 직접 실행하는 스크립트.
cloakbrowser는 내부적으로 sync_playwright를 사용하므로 async 없이 동기 방식으로 실행.
"""
import sys
import os
import time
import logging
from cloakbrowser import launch_persistent_context

logger = logging.getLogger("LocalBrowser")

def main():
    if len(sys.argv) < 3:
        print("Usage: local_browser.py <profile_dir> <url> [proxy_port]")
        sys.exit(1)

    profile_dir = sys.argv[1]
    
    # Ensure profile_dir exists before writing log
    os.makedirs(profile_dir, exist_ok=True)
    
    # Configure logging to file inside profile_dir
    log_file = os.path.join(profile_dir, "local_browser.log")
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )

    # File handler for debugging crashes
    try:
        fh = logging.FileHandler(os.path.join(os.path.dirname(__file__), 'local_browser_crash.log'))
        fh.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        fh.setFormatter(formatter)
        logger.addHandler(fh)
    except:
        pass

    url = sys.argv[2]
    proxy_port = sys.argv[3] if len(sys.argv) >= 4 else None

    browser_args = [
        "--disable-quic",
        "--disable-ipv6",
        "--disable-background-networking",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-webrtc-multiple-routes",
        "--use-fake-ui-for-media-stream",
        "--hide-crash-restore-bubble",
    ]

    proxy = None
    proxy_ext_dir = None
    if proxy_port and proxy_port not in ('0', 'None', ''):
        # Support full proxy URL strings or port numbers
        if proxy_port.startswith('http://') or proxy_port.startswith('https://') or proxy_port.startswith('socks5://') or proxy_port.startswith('socks4://'):
            from urllib.parse import urlparse
            parsed = urlparse(proxy_port)
            if parsed.username and parsed.password:
                # Playwright persistent context proxy auth is flaky for new tabs.
                # Generate a background extension to handle proxy auth automatically.
                proxy_ext_dir = os.path.join(profile_dir, "proxy_auth_ext")
                os.makedirs(proxy_ext_dir, exist_ok=True)
                
                manifest_json = """
                {
                    "version": "1.0.0",
                    "manifest_version": 2,
                    "name": "Proxy Auth Extension",
                    "permissions": [
                        "proxy",
                        "tabs",
                        "unlimitedStorage",
                        "storage",
                        "<all_urls>",
                        "webRequest",
                        "webRequestBlocking"
                    ],
                    "background": {
                        "scripts": ["background.js"]
                    },
                    "minimum_chrome_version":"22.0.0"
                }
                """
                
                scheme = parsed.scheme if parsed.scheme in ('http', 'https', 'socks4', 'socks5') else 'http'
                
                background_js = f"""
                var config = {{
                    mode: "fixed_servers",
                    rules: {{
                      singleProxy: {{
                        scheme: "{scheme}",
                        host: "{parsed.hostname}",
                        port: parseInt({parsed.port})
                      }},
                      bypassList: ["localhost", "127.0.0.1"]
                    }}
                  }};
                
                chrome.proxy.settings.set({{value: config, scope: "regular"}}, function() {{}});
                
                function callbackFn(details) {{
                    return {{
                        authCredentials: {{
                            username: "{parsed.username}",
                            password: "{parsed.password}"
                        }}
                    }};
                }}
                
                chrome.webRequest.onAuthRequired.addListener(
                            callbackFn,
                            {{urls: ["<all_urls>"]}},
                            ['blocking']
                );
                """
                
                with open(os.path.join(proxy_ext_dir, "manifest.json"), "w") as f:
                    f.write(manifest_json)
                with open(os.path.join(proxy_ext_dir, "background.js"), "w") as f:
                    f.write(background_js)
                
                browser_args.append(f"--disable-extensions-except={proxy_ext_dir}")
                browser_args.append(f"--load-extension={proxy_ext_dir}")
                
                # Do NOT set proxy dict to avoid conflicts with the extension
                proxy = None 
            else:
                proxy = {"server": proxy_port}
        elif str(proxy_port) == '8080':
            proxy = {"server": f"http://127.0.0.1:{proxy_port}"}
        else:
            proxy = {"server": f"socks5://127.0.0.1:{proxy_port}"}

    logger.info(f"Launching CloakBrowser at '{profile_dir}' -> {url} (Proxy: {proxy}, Ext: {proxy_ext_dir})")

    ctx = launch_persistent_context(
        user_data_dir=profile_dir,
        headless=False,
        proxy=proxy,
        args=browser_args,
    )

    if len(ctx.pages) > 0:
        page = ctx.pages[0]
    else:
        page = ctx.new_page()
        
    from cloakbrowser.human import patch_page, resolve_config, _CursorState
    cfg = resolve_config()
    cursor = _CursorState()
    patch_page(page, cfg, cursor)
    
    nav_success = True
    try:
        page.goto(url, timeout=30000)
    except Exception as e:
        nav_success = False
        logger.error(f"Navigation failed: {e}")
        try:
            page.evaluate("""(errorMsg) => {
                document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif; color: red;"><h1>네트워크 / 프록시 연결 오류</h1><p>EveryProxy 또는 프록시 연결을 확인해주세요.</p><p>' + errorMsg + '</p></div>';
            }""", str(e))
        except Exception as eval_e:
            logger.error(f"Error displaying message: {eval_e}")
            
    # Check if credentials were provided
    if len(sys.argv) >= 6:
        email = sys.argv[4]
        password = sys.argv[5]
        
        logger.info(f"Credentials provided for {email}. Monitoring for Google Login page...")
        
        import random
        def human_type_into(locator, text):
            try:
                locator.click()
                time.sleep(random.uniform(0.3, 0.6))
                for char in text:
                    page.keyboard.type(char, delay=random.randint(60, 140))
                time.sleep(random.uniform(0.4, 0.8))
            except Exception as ex:
                logger.warning(f"Fallback typing for {text[:3]}...: {ex}")
                locator.fill(text)

        # Wait up to 12s for Google login page redirect
        is_login_page = False
        for _ in range(12):
            curr_url = page.url.lower()
            if "accounts.google.com" in curr_url or "signin" in curr_url:
                is_login_page = True
                break
            time.sleep(1)

        if is_login_page:
            logger.info("🔐 Google Login page detected. Performing natural human-like auto-login...")
            try:
                # Wait for email input
                email_selectors = ['input[type="email"]', 'input[name="identifier"]', '#identifierId']
                email_locator = None
                
                for _ in range(15):
                    for selector in email_selectors:
                        locators = page.locator(selector).all()
                        for loc in locators:
                            if loc.is_visible():
                                email_locator = loc
                                break
                        if email_locator: break
                    if email_locator: break
                    time.sleep(1)
                
                if email_locator:
                    logger.info(f"✍️ Typing email ({email}) naturally...")
                    human_type_into(email_locator, email)
                    page.keyboard.press('Enter')
                else:
                    logger.error("Email field not visible for typing.")
                
                # Wait for password input transition
                time.sleep(2.5)
                pwd_selectors = ['input[name="Passwd"]', 'input[name="password"]', 'input[type="password"]']
                pwd_locator = None
                
                for _ in range(15):
                    for selector in pwd_selectors:
                        locators = page.locator(selector).all()
                        for loc in locators:
                            if loc.is_visible():
                                pwd_locator = loc
                                break
                        if pwd_locator: break
                    if pwd_locator: break
                    time.sleep(1)
                
                if pwd_locator:
                    logger.info("✍️ Typing password naturally...")
                    human_type_into(pwd_locator, password)
                    page.keyboard.press('Enter')
                    logger.info("[OK] Login credentials naturally submitted.")
                else:
                    logger.warning("Password field not visible yet. Please complete manually if needed.")
            except Exception as login_e:
                logger.error(f"Auto-login failed: {login_e}")

    logger.info("Browser launched. Keeping open for manual setup...")
    # 브라우저 창(탭)이 열려있는 동안 대기
    try:
        while len(ctx.pages) > 0:
            time.sleep(1)
    except Exception as e:
        logger.info(f"Context closed or error: {e}")

if __name__ == "__main__":
    main()
