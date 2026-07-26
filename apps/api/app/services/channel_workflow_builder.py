import logging
from typing import List, Dict, Any
from app import models, crud
from app.database import SessionLocal
from app.services.n8n_bridge import N8nBridgeService
from app.services.ai_workflow_generator import ai_generator

logger = logging.getLogger(__name__)

class ChannelWorkflowBuilder:
    """
    Automates the creation and setup of n8n workflows for multiple channels.
    Ensures that each channel has a dedicated workflow mapped to its browser profile.
    """

    def __init__(self):
        self.n8n = N8nBridgeService()

    def build_all_channel_workflows(self, channel_ids: List[str]) -> Dict[str, Any]:
        """
        Iterates through channels and builds/updates their n8n workflows.
        """
        results = {"success": [], "failed": []}
        db = SessionLocal()
        try:
            for cid in channel_ids:
                # 1. Get Channel Info
                channel = db.query(models.YouTubeChannel).filter(models.YouTubeChannel.channel_id == cid).first()
                if not channel:
                    results["failed"].append({"id": cid, "reason": "Channel not found in DB"})
                    continue

                # 2. Define Workflow Logic
                prompt = f"""
                Create a high-scale YouTube automation workflow for channel '{channel.channel_name}' ({cid}).
                The workflow should:
                1. Start with a Webhook trigger.
                2. Node 'Check Profile': Use browser profile '{channel.dedicated_profile_path}'.
                3. Node 'Upload Video': Trigger ViraLoop internal upload API.
                4. Node 'Delay': Add a random delay between 2 to 5 minutes to avoid platform detection.
                5. Node 'Report': Send completion status to n8n-bridge.
                """

                # 3. Generate JSON via AI
                try:
                    workflow_json = ai_generator.generate_workflow(prompt)
                    
                    # 4. Create in n8n
                    wf_data = self.n8n.create_workflow(
                        name=f"ViraLoop-Sync-{channel.channel_name[:20]}",
                        nodes=workflow_json.get("nodes", []),
                        connections=workflow_json.get("connections", {})
                    )
                    
                    if wf_data:
                        # 5. Activate
                        wf_id = wf_data.get("id")
                        self.n8n.activate_workflow(wf_id)
                        results["success"].append({"id": cid, "workflow_id": wf_id})
                    else:
                        results["failed"].append({"id": cid, "reason": "n8n creation failed"})
                except Exception as e:
                    logger.error(f"Failed to build workflow for {cid}: {e}")
                    results["failed"].append({"id": cid, "reason": str(e)})

            return results
        finally:
            db.close()

channel_workflow_builder = ChannelWorkflowBuilder()
