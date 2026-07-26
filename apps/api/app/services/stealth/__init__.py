import logging
from .adb_bridge import ADBBridge
from .incubator import Incubator

logger = logging.getLogger(__name__)

class StealthService:
    """
    Modular Stealth & Account Protection Service.
    Handles physical mobile device control (ADB) and automated account warmup.
    """
    def __init__(self, settings):
        self.settings = settings
        self.adb = ADBBridge(settings)
        self.incubator = Incubator(settings)
