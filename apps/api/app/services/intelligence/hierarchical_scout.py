from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class HierarchicalScout:
    def __init__(self, settings, llm_client=None): pass
    async def run_market_scan(self, db, target_category_id=None): return {'status': 'success', 'message': 'Skipped (Mocked)'}
    async def _auto_expand_taxonomy(self, db, category_name): pass

