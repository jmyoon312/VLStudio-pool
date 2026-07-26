import sqlite3
import json
import os
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self, db_path: Optional[str] = None):
        if not db_path:
            try:
                from app.config import settings
                db_path = os.path.join(settings.MEDIA_ROOT, "06_Database", "cache.db")
            except Exception as e:
                db_path = "backend/data/cache.db"
        self.db_path = db_path
        self._ensure_db()

    def _ensure_db(self):
        """Ensure DB directory and table exist, and enable WAL mode."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable WAL mode for concurrency
                conn.execute("PRAGMA journal_mode=WAL;")
                
                # Create table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_entries (
                        key TEXT PRIMARY KEY,
                        value TEXT,
                        created_at TIMESTAMP,
                        expires_at TIMESTAMP
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to initialize Cache DB: {e}")

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def generate_key(self, node_id: str, system_instruction: str, user_input: str, memory_context: list) -> str:
        """Generate a stable MD5 hash key based on inputs."""
        # Normalize inputs
        raw_str = f"{node_id}:{system_instruction}:{user_input}:{json.dumps(memory_context, sort_keys=True)}"
        return hashlib.md5(raw_str.encode('utf-8')).hexdigest()

    def set(self, key: str, value: Any, ttl_hours: int = 24):
        """Save a value to cache with expiration."""
        try:
            json_val = json.dumps(value)
            created_at = datetime.now()
            expires_at = created_at + timedelta(hours=ttl_hours)
            
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO cache_entries (key, value, created_at, expires_at)
                    VALUES (?, ?, ?, ?)
                """, (key, json_val, created_at, expires_at))
                conn.commit()
        except Exception as e:
            logger.error(f"Cache SET failed: {e}")

    def get(self, key: str) -> Optional[Any]:
        """Retrieve value if exists and not expired."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT value, expires_at FROM cache_entries WHERE key = ?", (key,))
                row = cursor.fetchone()
                
                if row:
                    value_json, expires_at_str = row
                    # Parse timestamp (SQLite stores as string typically)
                    # If using default adapter, it might come back as datetime or string depending on setup
                    # Let's handle string parsing if needed
                    if isinstance(expires_at_str, str):
                        try:
                            expires_at = datetime.fromisoformat(expires_at_str)
                        except:
                            # Fallback if format differs, usually isoformat works with default py sqlite
                            # Try generic parse or ignore expiry if malformed (better to miss cache than crash)
                             expires_at = datetime.max 
                    else:
                        expires_at = expires_at_str

                    if datetime.now() > expires_at:
                        # Expired - Lazy Delete
                        conn.execute("DELETE FROM cache_entries WHERE key = ?", (key,))
                        conn.commit()
                        return None
                    
                    return json.loads(value_json)
                
                return None
        except Exception as e:
            logger.error(f"Cache GET failed: {e}")
            return None

    def clear_node(self, node_id_prefix: str):
        """Clear cache entries starting with a hash? 
        Wait, we bake node_id into the hash, so we can't delete by prefix solely on hash.
        Requirement: 'DELETE .../nodes/{node_id}/cache'
        
        Correction: Standard MD5 hash destroys the prefix info.
        To support 'clear by node', we should store 'node_id' in a separate column or 
        prefix the key like 'node_id:HASH'.
        
        Let's change key strategy: key = f"{node_id}:{md5_hash}"
        """
        try:
             with self._get_connection() as conn:
                # Delete where key starts with node_id + ":"
                # Using LIKE for prefix match
                conn.execute("DELETE FROM cache_entries WHERE key LIKE ?", (f"{node_id_prefix}:%",))
                conn.commit()
        except Exception as e:
            logger.error(f"Cache CLEAR failed: {e}")

    # Override generate_key to support prefix strategy
    def generate_key_with_prefix(self, node_id: str, system_instruction: str, user_input: str, memory_context: list, model: str = "default") -> str:
        raw_str = f"{model}:{system_instruction}:{user_input}:{json.dumps(memory_context, sort_keys=True)}"
        hashed = hashlib.md5(raw_str.encode('utf-8')).hexdigest()
        return f"{node_id}:{hashed}"

# Singleton Instance
cache_manager = CacheManager()
