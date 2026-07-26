from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self): pass
    def get_context(self, db, node_id, limit=10): return []
    def add_turn(self, db, node_id, user_input, ai_output, max_pairs=10): pass
    def clear_node(self, db, node_id): pass

memory_manager = MemoryManager()
