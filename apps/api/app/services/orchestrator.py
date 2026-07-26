import os
import json
import logging
import docker
from app.crud import get_settings
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class SovereignOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings(db)
        try:
            self.docker_client = docker.from_env()
        except Exception:
            self.docker_client = None

    def sync_all(self):
        """Orchestrates synchronization across all hubs."""
        logger.info("Starting global hub synchronization...")
        self.update_env_file()
        self.sync_paperclip()
        self.sync_n8n_env()

    def update_env_file(self):
        """Updates the root .env file with latest keys from DB."""
        from app.config import settings
        env_path = os.path.join(settings.PROJECT_ROOT, ".env")
        
        if not os.path.exists(env_path):
            logger.error(f".env file not found at {env_path}")
            return

        try:
            with open(env_path, "r") as f:
                lines = f.readlines()

            new_lines = []
            keys_to_update = {
                "ANTHROPIC_API_KEY": self.settings.openrouter_api_keys[0] if self.settings.openrouter_api_keys else "",
                "GOOGLE_API_KEY": self.settings.gemini_api_keys[0] if self.settings.gemini_api_keys else "",
                "OPENROUTER_API_KEY": self.settings.openrouter_api_keys[0] if self.settings.openrouter_api_keys else "",
                "GROQ_API_KEY": self.settings.groq_api_keys[0] if self.settings.groq_api_keys else "",
                "CLAUDE_CONFIG_DIR": "/tmp/.claude" # Bypass login
            }

            updated_keys = set()
            for line in lines:
                matched = False
                for key, value in keys_to_update.items():
                    if line.startswith(f"{key}=") or line.startswith(f"#{key}=") or line.startswith(f"# {key}="):
                        new_lines.append(f"{key}={value}\n")
                        updated_keys.add(key)
                        matched = True
                        break
                if not matched:
                    new_lines.append(line)
            
            # Add missing keys
            for key, value in keys_to_update.items():
                if key not in updated_keys:
                    new_lines.append(f"{key}={value}\n")

            with open(env_path, "w") as f:
                f.writelines(new_lines)
            logger.info("Successfully updated .env file with latest keys.")
        except Exception as e:
            logger.error(f"Failed to update .env: {e}")

    def sync_paperclip(self):
        """[Elite] Paperclip 컨테이너가 제거됨 — 안전하게 스킵."""
        logger.debug("[Elite] Paperclip service removed. sync_paperclip() skipped (no-op).")
        return {"status": "success", "message": "Paperclip service removed (no-op)"}

    def sync_openclaude(self) -> dict:
        """
        Synchronizes LLM settings and MCP server configuration to OpenClaude's configuration files.
        """
        logger.info("Starting OpenClaude configuration sync...")
        try:
            import os
            import json
            
            home_dir = os.path.expanduser("~")
            claude_dir = os.path.join(home_dir, ".claude")
            os.makedirs(claude_dir, exist_ok=True)
            
            # Paths to OpenClaude configurations
            openclaude_path = os.path.join(home_dir, ".openclaude.json")
            settings_path = os.path.join(claude_dir, "settings.json")
            
            # Determine API Key and Provider based on settings
            provider = self.settings.openclaude_provider or "google"
            api_key = ""
            model = self.settings.openclaude_model or ""
            
            if provider == "google" and self.settings.gemini_api_keys:
                api_key = self.settings.gemini_api_keys[0]
                if not model: model = "gemini-2.5-flash"
            elif provider == "openrouter" and self.settings.openrouter_api_keys:
                api_key = self.settings.openrouter_api_keys[0]
                if not model: model = "google/gemini-2.0-flash-lite-preview-02-05:free"
            elif provider == "groq" and self.settings.groq_api_keys:
                api_key = self.settings.groq_api_keys[0]
                if not model: model = "llama-3.3-70b-versatile"
            elif provider == "openai" and self.settings.openai_api_key:
                api_key = self.settings.openai_api_key
                if not model: model = "gpt-4o-mini"
            else:
                # Fallback to whatever key is available
                if self.settings.gemini_api_keys:
                    provider = "google"
                    api_key = self.settings.gemini_api_keys[0]
                    if not model: model = "gemini-2.5-flash"
                elif self.settings.openrouter_api_keys:
                    provider = "openrouter"
                    api_key = self.settings.openrouter_api_keys[0]
                    if not model: model = "google/gemini-2.0-flash-lite-preview-02-05:free"
                elif self.settings.groq_api_keys:
                    provider = "groq"
                    api_key = self.settings.groq_api_keys[0]
                    if not model: model = "llama-3.3-70b-versatile"
            
            # 1. Update/Create .openclaude.json
            config_data = {}
            if os.path.exists(openclaude_path):
                try:
                    with open(openclaude_path, "r", encoding="utf-8") as f:
                        config_data = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to parse existing .openclaude.json: {e}")
            
            config_data["provider"] = provider
            if api_key:
                config_data["apiKey"] = api_key
            if model:
                config_data["model"] = model
                
            # Configure MCP server
            from app.config import settings as app_settings
            mcp_script_path = os.path.join(app_settings.PROJECT_ROOT, "mcp-server", "index.js").replace("\\", "/")
            
            mcp_servers = config_data.setdefault("mcpServers", {})
            mcp_servers["viraloop"] = {
                "command": "node",
                "args": [mcp_script_path]
            }
            
            with open(openclaude_path, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=2)
                
            # 2. Update/Create .claude/settings.json (also used by some OpenClaude/Claude CLI distributions)
            settings_data = {}
            if os.path.exists(settings_path):
                try:
                    with open(settings_path, "r", encoding="utf-8") as f:
                        settings_data = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to parse existing .claude/settings.json: {e}")
            
            # Sync key fields to settings.json
            settings_data.update({
                "provider": provider,
                "model": model,
                "mcpServers": mcp_servers
            })
            if api_key:
                settings_data["apiKey"] = api_key
                
            with open(settings_path, "w", encoding="utf-8") as f:
                json.dump(settings_data, f, indent=2)
                
            logger.info("Successfully synchronized OpenClaude settings.")
            return {"status": "success", "message": "OpenClaude configuration synchronized."}
            
        except Exception as e:
            logger.error(f"Failed to sync OpenClaude config: {e}")
            return {"status": "error", "message": str(e)}


    def sync_n8n_env(self):
        """
        [Elite] 외부 n8n 노드 URL 동기화.
        DB의 n8n_base_url 또는 환경변수 N8N_EXTERNAL_URL을 사용.
        """
        try:
            external_url = os.getenv("N8N_EXTERNAL_URL", "")
            if external_url:
                logger.info(f"[Elite] External n8n URL configured: {external_url}")
            else:
                logger.info("[Elite] N8N_EXTERNAL_URL not set. n8n triggers use DB-configured n8n_base_url.")
        except Exception as e:
            logger.warning(f"[Elite] sync_n8n_env warning: {e}")
