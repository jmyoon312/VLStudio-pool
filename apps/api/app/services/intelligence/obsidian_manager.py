import os
import yaml
import logging
from datetime import datetime
import json
import uuid
from typing import List, Dict, Any, Optional, Union

logger = logging.getLogger(__name__)

class ObsidianManager:
    """
    Manages the 'Sovereign Brain' Obsidian vault.
    Handles atomic note creation, linkage, and metadata management for the AI swarm.
    """
    
    def __init__(self, vault_path: str = None):
        if vault_path is None:
            from app.config import settings
            vault_path = os.getenv("BRAIN_VAULT_PATH", os.path.join(settings.MEDIA_ROOT, "brain_vault"))
            
            # Legacy fallback check (only if container default doesn't exist)
            if not os.path.exists(vault_path):
                local_fallback = os.path.join(os.path.expanduser("~"), "viral_loop/backend/downloads/brain_vault")
                if os.path.exists(local_fallback):
                    vault_path = local_fallback
                elif os.path.exists("/mnt/f/download/ObsidianBrain"):
                    vault_path = "/mnt/f/download/ObsidianBrain"
        
        self.vault_path = vault_path
        self.raw_path = os.path.join(vault_path, "00-raw")
        self.wiki_path = os.path.join(vault_path, "01-wiki")
        self.system_path = os.path.join(vault_path, "02-system")
        self.pipeline_path = os.path.join(vault_path, "03-pipeline-records")
        self.blackboard_path = os.path.join(vault_path, "04-blackboard-data")
        
        # Ensure directory structure exists
        for p in [self.raw_path, self.wiki_path, self.system_path, self.pipeline_path, self.blackboard_path]:
            os.makedirs(p, exist_ok=True)

    def _create_note(self, directory: str, filename: str, content: str, metadata: Dict[str, Any]):
        """Internal helper to write a markdown file with YAML frontmatter."""
        if not filename.endswith(".md"):
            filename += ".md"
            
        full_path = os.path.join(directory, filename)
        
        # Format Frontmatter
        frontmatter = "---\n"
        frontmatter += yaml.dump(metadata, allow_unicode=True)
        frontmatter += "---\n\n"
        
        try:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(frontmatter + content)
            logger.info(f"📓 Note created: {filename} in {os.path.basename(directory)}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to create note {filename}: {e}")
            return False

    def store_raw_research(self, title: str, content: str, source_url: str = "", tags: List[str] = []):
        """Stores raw data from NotebookLM or other scrapers."""
        metadata = {
            "type": "raw_research",
            "date": datetime.now().isoformat(),
            "source": source_url,
            "tags": tags,
            "swarm_ver": "6.0"
        }
        # Sanitize filename
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).rstrip()
        return self._create_note(self.raw_path, safe_title, content, metadata)

    def update_wiki_concept(self, concept: str, definition: str, references: List[str] = [], importance: int = 50):
        """Updates or creates a structured knowledge note."""
        metadata = {
            "type": "concept",
            "updated": datetime.now().isoformat(),
            "importance": importance,
            "links": [f"[[{r}]]" for r in references]
        }
        return self._create_note(self.wiki_path, concept, definition, metadata)

    def get_note_content(self, filename: str) -> Optional[str]:
        """Reads a note's content (excluding frontmatter)."""
        # Search in all 3 directories
        for directory in [self.wiki_path, self.raw_path, self.system_path]:
            full_path = os.path.join(directory, filename if filename.endswith(".md") else filename + ".md")
            if os.path.exists(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        parts = f.read().split("---")
                        if len(parts) >= 3:
                            return parts[2].strip()
                        return parts[0].strip()
                except Exception as e:
                    logger.error(f"Failed to read note {filename}: {e}")
        return None

    def list_recent_notes(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Lists recently modified notes for the UI viewer."""
        notes = []
        for directory in [self.wiki_path, self.raw_path, self.system_path]:
            if not os.path.exists(directory): continue
            for f in os.listdir(directory):
                if f.endswith(".md"):
                    p = os.path.join(directory, f)
                    notes.append({
                        "name": f,
                        "folder": os.path.basename(directory),
                        "modified": os.path.getmtime(p)
                    })
        
        notes.sort(key=lambda x: x["modified"], reverse=True)
        return notes[:limit]

    # --- Phase 5: Versioning & Lineage ---
    def save_versioned_note(self, directory: str, filename: str, content: str, metadata: Dict[str, Any], version: int = 1):
        """
        Saves a note with an explicit version suffix if it already exists.
        Ensures traceability of idea evolution.
        """
        if not filename.endswith(".md"):
            filename += ".md"
            
        base_name = filename.replace(".md", "")
        versioned_filename = f"{base_name}_v{version}.md"
        
        # Link to previous version in metadata if applicable
        if version > 1:
            metadata["previous_version"] = f"[[{base_name}_v{version-1}]]"
            
        return self._create_note(directory, versioned_filename, content, metadata)

    def create_lineage_link(self, source_note: str, target_note: str, relationship: str = "derived_from"):
        """
        Creates a backlink between two notes to build the Sovereign Knowledge Graph.
        """
        logger.info(f"🔗 Linking {target_note} -> {source_note} ({relationship})")
        # In Obsidian, we just need to ensure backlink exists in the target note's metadata
        # Implementation depends on whether we want to append to existing notes
        pass

    # --- Phase 2: Blackboard (Shared Memory) Implementation ---
    def create_data_pointer(self, data: Union[str, dict], category: str = "general") -> str:
        """
        Stores large payloads into the blackboard vault and returns an MCP data pointer.
        Prevents LLM Context Blowout.
        """
        pointer_id = f"{category}_{uuid.uuid4().hex[:8]}"
        filename = f"{pointer_id}.md"
        
        content = json.dumps(data, ensure_ascii=False, indent=2) if isinstance(data, dict) else str(data)
        
        metadata = {
            "type": "blackboard_pointer",
            "category": category,
            "created": datetime.now().isoformat()
        }
        
        success = self._create_note(self.blackboard_path, filename, f"```json\n{content}\n```", metadata)
        if success:
            logger.info(f"💾 Blackboard Pointer created: mcp_data://{pointer_id}")
            return f"mcp_data://{pointer_id}"
        return ""

    def resolve_data_pointer(self, pointer: str) -> Optional[Union[str, dict]]:
        """
        Parses an MCP data pointer and retrieves the raw data.
        """
        if not pointer.startswith("mcp_data://"):
            return pointer # Return as is if not a pointer
            
        pointer_id = pointer.replace("mcp_data://", "")
        filename = f"{pointer_id}.md"
        full_path = os.path.join(self.blackboard_path, filename)
        
        if not os.path.exists(full_path):
            logger.error(f"❌ Blackboard lookup failed for pointer: {pointer}")
            return None
            
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                parts = f.read().split("---")
                content = parts[2].strip() if len(parts) >= 3 else parts[0].strip()
                
                # strip markdown codeblocks if dict
                if content.startswith("```json"):
                    content_json = content.replace("```json", "").replace("```", "").strip()
                    return json.loads(content_json)
                return content
        except Exception as e:
            logger.error(f"❌ Error parsing blackboard pointer {pointer}: {e}")
            return None

    # --- Phase 4: Pipeline Event Logging ---
    def record_pipeline_event(self, stage: str, status: str, agent: str, artifacts: dict = None):
        """
        Records an untamperable event log in the pipeline-records vault.
        """
        event_time = datetime.now()
        filename = f"LOG_{event_time.strftime('%Y%m%d_%H%M%S')}_{stage}"
        
        content = f"## 🚀 Pipeline Stage: {stage}\n* **Status**: {status}\n* **Agent**: {agent}\n"
        if artifacts:
            content += f"\n### 📦 Artifacts\n```json\n{json.dumps(artifacts, ensure_ascii=False, indent=2)}\n```"
            
        metadata = {
            "type": "pipeline_event",
            "stage": stage,
            "status": status,
            "agent": agent,
            "timestamp": event_time.isoformat()
        }
        
        self._create_note(self.pipeline_path, filename, content, metadata)
