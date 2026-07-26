from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ProfileConfig:
    profile_id: str
    user_data_dir: Path
    proxy_host: str = ''
    proxy_port: int = 0
    proxy_type: str = 'http'  # http / socks5
    lte_interface_ip: Optional[str] = None  # USB tethering IP
    engine_mode: str = 'cloakbrowser'  # cloakbrowser / ixbrowser


@dataclass
class VideoPayload:
    video_path: Path
    thumbnail_path: Optional[Path] = None
    title: str = ''
    description: str = ''
    tags: list[str] = field(default_factory=list)
    category_id: str = '22'
    privacy: str = 'public'  # public / unlisted / private
    schedule_publish_at: Optional[str] = None


@dataclass
class UploadResult:
    success: bool = False
    video_id: Optional[str] = None
    error: Optional[str] = None
    uploaded_at: str = ''


@dataclass
class BrowserSession:
    session_id: str = ''
    cdp_url: str = ''  # devtools:// URL
    profile_id: str = ''
    pid: int = 0


class BrowserInterface(ABC):
    """브라우저 엔진 추상화 계층. CloakBrowser / iXBrowser 공통 인터페이스."""

    @abstractmethod
    async def create_profile(self, config: ProfileConfig) -> str:
        ...

    @abstractmethod
    async def delete_profile(self, profile_id: str) -> None:
        ...

    @abstractmethod
    async def launch_browser(self, profile_id: str) -> BrowserSession:
        ...

    @abstractmethod
    async def close_browser(self, session: BrowserSession) -> None:
        ...

    @abstractmethod
    async def upload_youtube(
        self, session: BrowserSession, video: VideoPayload
    ) -> UploadResult:
        ...

    @abstractmethod
    async def get_screenshot(
        self, session: BrowserSession
    ) -> Optional[bytes]:
        ...