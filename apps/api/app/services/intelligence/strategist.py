from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class SovereignStrategist:
    def __init__(self, settings, llm_client=None): pass
    async def generate_brief(self, db, target_category_id=None): return {'status': 'success', 'message': 'Skipped (Mocked)'}

