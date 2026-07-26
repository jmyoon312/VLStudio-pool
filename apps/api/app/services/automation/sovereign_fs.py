import os
import shutil
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional

logger = logging.getLogger("sovereign_fs")

from app.config import settings

class SovereignFileSystem:
    """
    A protected file system wrapper that ensures every autonomous write 
    is preceded by a versioned snapshot for 2026-grade digital resilience.
    """
    
    def __init__(self, base_dir: str = None, max_history: int = 20):
        self.base_dir = base_dir or settings.MEDIA_ROOT
        self.snapshot_dir = os.path.join(self.base_dir, ".swarm", "snapshots")
        self.history_file = os.path.join(self.base_dir, ".swarm", "history.json")
        self.max_history = max_history
        
        # Ensure directories exist
        os.makedirs(self.snapshot_dir, exist_ok=True)
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w') as f:
                json.dump({"history": []}, f)

    def _get_history(self) -> Dict:
        try:
            with open(self.history_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {"history": []}

    def _save_history(self, history: Dict):
        with open(self.history_file, 'w') as f:
            json.dump(history, f, indent=2)

    def write_protected(self, file_path: str, content: str, reason: str = "Autonomous Repair") -> bool:
        """
        Writes content to a file after taking a snapshot.
        """
        try:
            absolute_path = os.path.abspath(file_path)
            if not os.path.exists(absolute_path):
                # If creating a new file, snapshot is technically empty or non-existent
                logger.info(f"Creating new file under protection: {absolute_path}")
            else:
                # Take snapshot
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = os.path.basename(absolute_path)
                snapshot_name = f"{timestamp}_{filename}"
                snapshot_path = os.path.join(self.snapshot_dir, snapshot_name)
                
                shutil.copy2(absolute_path, snapshot_path)
                
                # Update history
                history = self._get_history()
                entry = {
                    "timestamp": datetime.now().isoformat(),
                    "file_path": absolute_path,
                    "snapshot_path": snapshot_path,
                    "reason": reason,
                    "id": timestamp
                }
                history["history"].append(entry)
                
                # Trim history
                if len(history["history"]) > self.max_history:
                    old_entry = history["history"].pop(0)
                    if os.path.exists(old_entry["snapshot_path"]):
                        os.remove(old_entry["snapshot_path"])
                
                self._save_history(history)
                logger.info(f"🛡️ Snapshot created: {snapshot_name}")

            # Perform write
            with open(absolute_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        except Exception as e:
            logger.error(f"❌ Protected write failed: {e}")
            return False

    def rollback(self, file_path: str, version_id: Optional[str] = None) -> bool:
        """
        Rolls back a file to its last snapshot or a specific version ID.
        """
        try:
            absolute_path = os.path.abspath(file_path)
            history = self._get_history()
            
            # Find matching entries for this file
            matches = [e for e in history["history"] if e["file_path"] == absolute_path]
            if not matches:
                logger.warning(f"No history found for {absolute_path}")
                return False
            
            target_entry = matches[-1] # Default to latest
            if version_id:
                for m in matches:
                    if m["id"] == version_id:
                        target_entry = m
                        break
            
            if os.path.exists(target_entry["snapshot_path"]):
                shutil.copy2(target_entry["snapshot_path"], absolute_path)
                logger.info(f"⏪ Successfully rolled back {absolute_path} to version {target_entry['id']}")
                return True
            else:
                logger.error(f"Snapshot file missing: {target_entry['snapshot_path']}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Rollback failed: {e}")
            return False

    def list_history(self, file_path: Optional[str] = None) -> List[Dict]:
        history = self._get_history()
        if file_path:
            abs_path = os.path.abspath(file_path)
            return [e for e in history["history"] if e["file_path"] == abs_path]
        return history["history"]

# Global singleton
sovereign_fs = SovereignFileSystem()
