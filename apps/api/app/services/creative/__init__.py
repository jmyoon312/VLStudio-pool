import logging
from .stylist import Stylist
from .writer import Writer

logger = logging.getLogger(__name__)

class CreativeService:
    """
    Modular Creative Service.
    Handles AI-driven script writing, style analysis, and scene segmentation.
    """
    def __init__(self, llm_client):
        self.llm_client = llm_client
        self.stylist = Stylist(llm_client)
        self.writer = Writer(llm_client)
