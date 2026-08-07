"""iXBrowser engine: Commercial anti-detect browser via HTTP API.

iXBrowser provides:
- Profile management (create/delete/launch/close) via REST API
- Built-in fingerprint spoofing (canvas, WebGL, audio, fonts, etc.)
- SOCKS5 proxy per profile
- Cookie/ localStorage import/export
- Group & tag management

API base: http://localhost:5520 (local iXBrowser app must be running)
Docs: https://help.ixbrowser.com/api-doc
"""

import json
import logging
from pathlib import Path
from typing import Optional

import httpx

from .interface import (
    BrowserInterface,
    BrowserSession,
    ProfileConfig,
    UploadResult,
    VideoPayload,
)

logger = logging.getLogger(__name__)


class IXBrowserEngine(BrowserInterface):
    """iXBrowser API wrapper. Requires iXBrowser desktop app running on host."""

    ENGINE_MODE = "ixbrowser"
    IX_API_URL = "http://localhost:5520/api/v2"

    def __init__(self, api_url: str = IX_API_URL):
        try:
            from app.database import SessionLocal
            from app.crud import get_settings
            db = SessionLocal()
            settings = get_settings(db)
            if settings and hasattr(settings, 'ixbrowser_api_url') and settings.ixbrowser_api_url:
                api_url = settings.ixbrowser_api_url
            db.close()
        except Exception as e:
            logger.warning(f"Could not load iXBrowser API URL from settings, using default: {e}")
        self.api_url = api_url
        self._http: Optional[httpx.AsyncClient] = None
        self._active_session: Optional[BrowserSession] = None

    async def _ensure_http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(base_url=self.api_url, timeout=30)
        return self._http

    # ── profile CRUD ──────────────────────────────────────────

    async def create_profile(self, config: ProfileConfig) -> str:
        """Create iXBrowser profile with proxy & group."""
        http = await self._ensure_http()
        payload = {
            "group_id": config.engine_mode,  # use engine_mode as group tag
            "fingerprint_config": {
                "automatic_timezone": True,
                "automatic_geolocation": True,
                "automatic_locale": True,
                "webrtc": "disabled",
                "canvas": "noise",
                "webgl": "noise",
                "audio": "noise",
                "client_rects": "noise",
                "media_devices": "noise",
            },
        }
        
        if config.lte_interface_ip:
            payload["user_proxy_config"] = {
                "proxy_mode": 1,
                "proxy_type": "socks5",
                "proxy_host": config.lte_interface_ip,
                "proxy_port": 8080
            }
        elif config.proxy_host:
            payload["user_proxy_config"] = {
                "proxy_mode": 1,
                "proxy_type": config.proxy_type or "http",
                "proxy_host": config.proxy_host,
                "proxy_port": int(config.proxy_port or 0),
            }
            if getattr(config, 'proxy_username', None):
                payload["user_proxy_config"]["proxy_user"] = config.proxy_username
                payload["user_proxy_config"]["proxy_password"] = getattr(config, 'proxy_password', '')
        else:
            payload["user_proxy_config"] = {"proxy_mode": 2} # Direct connection mode or unassigned

        r = await http.post("/profile/create", json=payload)
        data = self._raise_on_error(r)
        profile_id = data.get("profile_id", config.profile_id)
        logger.info("iXBrowser profile created: %s", profile_id)
        return profile_id

    async def delete_profile(self, profile_id: str) -> None:
        http = await self._ensure_http()
        r = await http.post("/profile/delete", json={"profile_ids": [profile_id]})
        self._raise_on_error(r)
        logger.info("iXBrowser profile deleted: %s", profile_id)

    async def launch_browser(self, profile_id: str) -> BrowserSession:
        """Launch profile and get CDP debug URL."""
        http = await self._ensure_http()
        r = await http.post("/profile/open", json={"profile_id": profile_id})
        data = self._raise_on_error(r)
        session = BrowserSession(
            session_id=data.get("session_id", profile_id),
            cdp_url=data.get("debugger_url", "http://127.0.0.1:9222"),
            profile_id=profile_id,
            pid=data.get("pid", 0),
        )
        self._active_session = session
        return session

    async def close_browser(self, session: BrowserSession) -> None:
        http = await self._ensure_http()
        r = await http.post("/profile/close", json={"profile_id": session.profile_id})
        self._raise_on_error(r)
        self._active_session = None

    # ── video upload (CDP via iXBrowser's debug port) ─────────

    async def upload_youtube(
        self, session: BrowserSession, video: VideoPayload
    ) -> UploadResult:
        """Use iXBrowser CDP to drive youtube.com/upload."""
        cdp_url = session.cdp_url.replace("localhost", "127.0.0.1")
        try:
            # Connect via CDP using Patchright/Playwright
            from patchright.async_api import async_playwright

            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp(cdp_url)
                page = browser.contexts[0].pages[0] if browser.contexts else await browser.new_page()
                await page.goto("https://studio.youtube.com", wait_until="networkidle")
                # Click "CREATE" → "Upload video"
                await page.click("ytcp-button#create-icon")
                await page.click("ytcp-ve#text-item-0")
                # File input
                file_input = page.locator("input[type=file]")
                await file_input.set_input_files(str(video.video_path))
                # Wait for upload processing
                await page.wait_for_selector("ytcp-video-metadata-editor", timeout=120)
                # Fill title
                title_input = page.locator("#title-textarea")
                await title_input.fill(video.title)
                # Fill description
                desc_input = page.locator("#description-textarea")
                await desc_input.fill(video.description)
                # Tags
                if video.tags:
                    tags_input = page.locator("#tags-input")
                    await tags_input.fill(",".join(video.tags))
                # Thumbnail
                if video.thumbnail_path and video.thumbnail_path.exists():
                    thumb_input = page.locator("input#file-loader")
                    await thumb_input.set_input_files(str(video.thumbnail_path))
                # Privacy
                privacy_map = {"public": "PUBLIC", "unlisted": "UNLISTED", "private": "PRIVATE"}
                radio = page.locator(f"tp-yt-paper-radio-button[name={privacy_map.get(video.privacy, 'PUBLIC')}]")
                await radio.click()
                # Submit
                await page.click("ytcp-button#done-button")
                await page.wait_for_timeout(3000)
                # Get video URL from dialog
                url_el = page.locator("a.video-url-fadeable")
                video_url = await url_el.get_attribute("href") if await url_el.count() else None
                await browser.close()

            video_id = ""
            if video_url:
                import re
                m = re.search(r"v=([\w-]+)", video_url)
                if m:
                    video_id = m.group(1)

            return UploadResult(
                success=bool(video_id),
                video_id=video_id or None,
                uploaded_at="",
            )
        except Exception as e:
            logger.exception("iXBrowser upload failed")
            return UploadResult(success=False, error=str(e))

    async def get_screenshot(self, session: BrowserSession) -> Optional[bytes]:
        http = await self._ensure_http()
        r = await http.post(
            "/profile/screenshot",
            json={"profile_id": session.profile_id},
        )
        self._raise_on_error(r)
        return r.content

    async def close(self):
        if self._active_session:
            await self.close_browser(self._active_session)
        if self._http:
            await self._http.aclose()
            self._http = None

    # ── helpers ──────────────────────────────────────────────

    def _raise_on_error(self, response: httpx.Response) -> dict:
        """iXBrowser API returns 0 on success, non-0 on error."""
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {}
        if data.get("code", 0) != 0:
            raise RuntimeError(f"iXBrowser API error (code={data.get('code')}): {data.get('msg', response.text[:200])}")
        return data.get("data", data)