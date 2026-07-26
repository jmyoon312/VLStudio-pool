import logging
from .image_service import ImageService
from .audio_service import AudioService
from .ffmpeg_service import FFmpegService
from .subtitle_service import SubtitleService
from .higgsfield_service import HiggsfieldService

logger = logging.getLogger(__name__)

class VideoService:
    """
    Modular Video Generation Service.
    Orchestrates specialized sub-services for image, audio, and ffmpeg processing.
    """
    def __init__(self, settings):
        self.settings = settings
        self.image = ImageService(settings)
        self.audio = AudioService(settings)
        self.ffmpeg = FFmpegService(settings)
