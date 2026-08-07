import logging
import requests
import json
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class N8nBridgeService:
    # TODO: Move to Settings (Env Var) in Production
    API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3N2NhMWJmZS0yMzM1LTQzZjUtYjUzNy05NTU5MTEzZmViZjEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzY4Mjg1ODk5fQ.iBJo2L0kYHuGErzgbA5QGjQBrrB4Q7EZh-KbzgDYb4U"
    BASE_URL = "http://localhost:5678/api/v1"

    @classmethod
    def get_headers(cls) -> Dict[str, str]:
        return {
            "X-N8N-API-KEY": cls.API_KEY,
            "Content-Type": "application/json"
        }

    @classmethod
    def check_connection(cls) -> Dict[str, Any]:
        """
        Verifies connection to n8n API.
        """
        try:
            # Check owner (user) info as a ping
            resp = requests.get(f"{cls.BASE_URL}/users", headers=cls.get_headers(), timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                return {"status": "ok", "users": len(data.get("data", []))}
            else:
                return {"status": "error", "code": resp.status_code, "detail": resp.text}
        except Exception as e:
            logger.error(f"n8n Connection Failed: {e}")
            return {"status": "error", "detail": str(e)}

    @classmethod
    def list_workflows(cls, limit: int = 10) -> List[Dict[str, Any]]:
        try:
            resp = requests.get(f"{cls.BASE_URL}/workflows?limit={limit}", headers=cls.get_headers())
            resp.raise_for_status()
            return resp.json().get("data", [])
        except Exception as e:
            logger.error(f"Failed to list workflows: {e}")
            return []

    @classmethod
    def create_workflow(cls, workflow_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new workflow in n8n.
        Expected JSON structure: { "name": "...", "nodes": [...], "connections": {...} }
        """
        url = f"{cls.BASE_URL}/workflows"
        try:
            # Ensure 'settings' (and 'meta') exists as n8n API requires it
            if "settings" not in workflow_json:
                workflow_json["settings"] = {"executionOrder": "v1"}
            
            resp = requests.post(url, headers=cls.get_headers(), json=workflow_json)
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"[OK] Created n8n Workflow: {data.get('id')} ({data.get('name')})")
            return data
        except requests.exceptions.HTTPError as e:
            logger.error(f"Failed to create workflow: {e.response.text}")
            raise Exception(f"n8n API Error: {e.response.text}")
        except Exception as e:
            logger.error(f"Error creating workflow: {e}")
            raise e

    @classmethod
    def activate_workflow(cls, workflow_id: str) -> bool:
        url = f"{cls.BASE_URL}/workflows/{workflow_id}/activate"
        try:
            resp = requests.post(url, headers=cls.get_headers())
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Failed to activate workflow {workflow_id}: {e}")
            return False

    @classmethod
    def trigger_webhook(cls, webhook_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Directly triggers an n8n workflow via its Webhook URL.
        """
        try:
            logger.info(f"[FALLBACK] Triggering n8n Webhook: {webhook_url}")
            resp = requests.post(webhook_url, json=payload, timeout=30)
            resp.raise_for_status()
            return {"status": "success", "data": resp.json()}
        except Exception as e:
            logger.error(f"Failed to trigger n8n webhook: {e}")
            return {"status": "error", "message": str(e)}

    @classmethod
    def get_workflow_webhook_url(cls, workflow_id: str) -> Optional[str]:
        """
        Parses workflow JSON to find the internal/test/production Webhook URL.
        """
        try:
            resp = requests.get(f"{cls.BASE_URL}/workflows/{workflow_id}", headers=cls.get_headers())
            resp.raise_for_status()
            data = resp.json()
            
            # Search nodes for a webhook
            for node in data.get("nodes", []):
                if node.get("type") == "n8n-nodes-base.webhook":
                    path = node.get("parameters", {}).get("path")
                    if path:
                        # Assuming default n8n webhook structure
                        # e.g., http://localhost:5678/webhook/path
                        base = cls.BASE_URL.replace("/api/v1", "")
                        return f"{base}/webhook/{path}"
            return None
        except Exception as e:
            logger.error(f"Failed to extract webhook URL: {e}")
            return None

n8n_bridge = N8nBridgeService()
