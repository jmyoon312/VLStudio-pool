import logging
from .scout import OracleScout
from .analyst import Analyst
from .wisdom import WisdomDistiller
from ...llm_manager import LLMClient

logger = logging.getLogger(__name__)

class IntelligenceService:
    """
    Modular Intelligence Service.
    Handles global trend scouting, competitor analysis, and evolutionary wisdom distillation.
    """
    def __init__(self, settings, db=None):
        self.settings = settings
        self.db = db
        # Initialize specialized LLM client for intelligence tasks
        self.llm = LLMClient(settings)
        
        self.scout = OracleScout(settings, self.llm)
        self.analyst = Analyst(settings, self.llm)
        self.wisdom = WisdomDistiller(db) if db else None
