"""CloakBrowser engine: Electron-based self-developed anti-detect browser."""

import asyncio
import json
import logging
import subprocess
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


class CloakBrowserEngine(BrowserInterface):
    """자체 개발 안티디텍트 브라우저 (Electron 기반)."""

    ENGINE_MODE = "cloakbrowser"

    def __init__(self, electron_binary: str = "npx electron", cwd: Optional[Path] = None):
        self.electron_binary = electron_binary
        self.cwd = cwd or Path.cwd() / "electron"
        self._process: Optional[subprocess.Popen] = None
        self._http: Optional[httpx.AsyncClient] = None

    async def _ensure_http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(base_url="http://127.0.0.1:5173", timeout=120)
        return self._http

    async def create_profile(self, config: ProfileConfig) -> str:
        """Create a Chrome user-data-dir for the profile."""
        # Electron main.js handles profile dir creation via IPC
        profile_dir = config.user_data_dir / config.profile_id
        profile_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Cloak profile dir created: %s", profile_dir)
        return config.profile_id

    async def delete_profile(self, profile_id: str) -> None:
        # Delegate to Electron IPC (rm -rf user-data-dir/<profile_id>)
        http = await self._ensure_http()
        try:
            await http.post("/api/browser/delete-profile", json={"profile_id": profile_id})
        except httpx.RequestError:
            logger.warning("delete-profile IPC unreachable (process may not be running)")

    async def launch_browser(self, profile_id: str) -> BrowserSession:
        """Launch Electron app with --profile flag."""
        cmd = [
            *self.electron_binary.split(),
            str(self.cwd),
            "--profile",
            profile_id,
        ]
        self._process = subprocess.Popen(
            cmd,
            cwd=self.cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Wait for IPC server to come up
        http = await self._ensure_http()
        for attempt in range(30):
            try:
                r = await http.get("/api/browser/status", timeout=2)
                if r.status_code == 200:
                    data = r.json()
                    return BrowserSession(
                        session_id=data.get("session_id", profile_id),
                        cdp_url=data.get("cdp_url", ""),
                        profile_id=profile_id,
                        pid=self._process.pid or 0,
                    )
            except (httpx.RequestError, json.JSONDecodeError):
                pass
            await asyncio.sleep(1)
        raise RuntimeError(f"CloakBrowser failed to start within 30s (profile={profile_id})")

    async def close_browser(self, session: BrowserSession) -> None:
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._process.kill()
                await self._process.wait()
        self._process = None

    async def upload_youtube(
        self, session: BrowserSession, video: VideoPayload
    ) -> UploadResult:
        """Delegate video upload to Electron's CDP dispatch logic."""
        http = await self._ensure_http()
        payload = {
            "video_path": str(video.video_path),
            "thumbnail_path": str(video.thumbnail_path) if video.thumbnail_path else None,
            "title": video.title,
            "description": video.description,
            "tags": video.tags,
            "category_id": video.category_id,
            "privacy": video.privacy,
            "schedule_publish_at": video.schedule_publish_at,
        }
        try:
            r = await http.post(
                "/api/browser/upload",
                json=payload,
                timeout=300,
            )
            if r.status_code == 200:
                data = r.json()
                return UploadResult(
                    success=data.get("success", False),
                    video_id=data.get("video_id"),
                    error=data.get("error"),
                    uploaded_at=data.get("uploaded_at", ""),
                )
            return UploadResult(success=False, error=f"HTTP {r.status_code}: {r.text[:200]}")
        except httpx.RequestError as e:
            return UploadResult(success=False, error=str(e))

    async def get_screenshot(self, session: BrowserSession) -> Optional[bytes]:
        http = await self._ensure_http()
        try:
            r = await http.get("/api/browser/screenshot", timeout=30)
            if r.status_code == 200:
                return r.content
        except httpx.RequestError:
            pass
        return None

    async def close(self):
        if self._process and self._process.poll() is None:
            self._process.terminate()
        if self._http:
            await self._http.aclose()
            self._http = None