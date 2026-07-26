import logging
from .manager import PersonaManager
from .scheduler import PersonaScheduler

logger = logging.getLogger(__name__)

class PersonaService:
    """
    Modular Multi-Channel Persona Service.
    Manages identities, visual styles, and production schedules for 30+ channels.
    """
    def __init__(self, db, settings):
        self.db = db
        self.settings = settings
        self.manager = PersonaManager(db)
        self.scheduler = PersonaScheduler(db)
