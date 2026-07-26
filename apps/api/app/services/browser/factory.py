"""Browser engine factory — routes requests to CloakBrowser or iXBrowser."""

import logging
from typing import Optional, Type

from .interface import BrowserInterface
from .cloak_engine import CloakBrowserEngine
from .ix_engine import IXBrowserEngine

logger = logging.getLogger(__name__)

_engines: dict[str, Type[BrowserInterface]] = {
    CloakBrowserEngine.ENGINE_MODE: CloakBrowserEngine,
    IXBrowserEngine.ENGINE_MODE: IXBrowserEngine,
}


def register_engine(mode: str, cls: Type[BrowserInterface]) -> None:
    """Register a custom browser engine class."""
    _engines[mode] = cls
    logger.info("Browser engine registered: %s -> %s", mode, cls.__name__)


def get_browser_engine(
    mode: str = "cloakbrowser",
    **kwargs,
) -> BrowserInterface:
    """Get a browser engine instance by mode name.

    Args:
        mode: engine_mode string — "cloakbrowser" or "ixbrowser"
        **kwargs: passed to engine constructor

    Returns:
        Initialized engine instance.

    Raises:
        ValueError: if mode is unknown.
    """
    cls = _engines.get(mode)
    if cls is None:
        raise ValueError(
            f"Unknown browser engine mode={mode!r}. "
            f"Available: {list(_engines.keys())}"
        )
    logger.debug("Using browser engine: %s (%s)", mode, cls.__name__)
    return cls(**kwargs)