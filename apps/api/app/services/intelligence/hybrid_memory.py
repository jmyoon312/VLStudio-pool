import os
import lancedb
import networkx as nx
import pickle
import logging
from typing import List, Dict, Any, Optional
import pyarrow as pa
from datetime import datetime

logger = logging.getLogger("hybrid_memory")

class HybridMemory:
    """
    Sovereign Hybrid Memory (2026 Strategy).
    Combines Vector Semantic Memory (LanceDB) with Structural Reasoning (Graph).
    """
    
    def __init__(self, base_path: str = None):
        if base_path is None:
            from app.config import settings
            self.base_path = os.getenv("SWARM_MEMORY_PATH", os.path.join(settings.MEDIA_ROOT, ".swarm", "memory"))
        else:
            self.base_path = base_path
        
        self.vector_db_path = os.path.join(self.base_path, "vector_store")
        self.graph_path = os.path.join(self.base_path, "knowledge_graph.pkl")
        
        os.makedirs(self.vector_db_path, exist_ok=True)
        self.db = lancedb.connect(self.vector_db_path)
        
        # Load or Init Knowledge Graph
        self.graph = self._load_graph()
        
    def _load_graph(self) -> nx.DiGraph:
        if os.path.exists(self.graph_path):
            with open(self.graph_path, 'rb') as f:
                return pickle.load(f)
        return nx.DiGraph()

    def _save_graph(self):
        with open(self.graph_path, 'wb') as f:
            pickle.dump(self.graph, f)

    # ─── VECTOR OPS (LANCEDB) ──────────────────────────────────────────────

    def add_vector_wisdom(self, niche: str, title: str, content: str, embedding: List[float]):
        """
        Adds a wisdom entry to the vector table.
        """
        table_name = "wisdom_manifold"
        data = [{
            "niche": niche,
            "title": title,
            "content": content,
            "vector": embedding,
            "timestamp": datetime.now().isoformat()
        }]
        
        if table_name not in self.db.table_names():
            schema = pa.schema([
                pa.field("niche", pa.string()),
                pa.field("title", pa.string()),
                pa.field("content", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), len(embedding))),
                pa.field("timestamp", pa.string())
            ])
            self.db.create_table(table_name, data=data, schema=schema)
        else:
            table = self.db.open_table(table_name)
            table.add(data)
        logger.info(f"[SAVE] Vector Wisdom added for niche: {niche}")

    def query_vector_wisdom(self, embedding: List[float], limit: int = 5) -> List[Dict]:
        if "wisdom_manifold" not in self.db.table_names():
            return []
        table = self.db.open_table("wisdom_manifold")
        return table.search(embedding).limit(limit).to_list()

    # ─── GRAPH OPS (STRUCTURAL) ────────────────────────────────────────────

    def add_knowledge_link(self, source: str, target: str, relationship: str, weight: float = 1.0):
        """
        Links two entities (e.g., Niche -> HookType).
        """
        self.graph.add_edge(source, target, relationship=relationship, weight=weight)
        self._save_graph()
        logger.info(f"🕸️ Graph Link established: {source} ─[{relationship}]─▶ {target}")

    def get_related_strategies(self, entity: str) -> List[Dict]:
        """
        Finds connected nodes in the graph.
        """
        if not self.graph.has_node(entity):
            return []
        
        neighbors = []
        for neighbor in self.graph.neighbors(entity):
            edge_data = self.graph.get_edge_data(entity, neighbor)
            neighbors.append({
                "target": neighbor,
                "relationship": edge_data.get("relationship"),
                "weight": edge_data.get("weight")
            })
        return neighbors

# Global Singleton
hybrid_memory = HybridMemory()
