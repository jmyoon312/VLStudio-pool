import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import SessionLocal
from app.models import SwarmUsageStats

logger = logging.getLogger(__name__)

# Model pricing baseline (Example: USD per 1M tokens)
# These can be moved to settings/config later
PRICING = {
    "gemini-1.5-pro": {"prompt": 3.50, "completion": 10.50},
    "gemini-1.5-flash": {"prompt": 0.075, "completion": 0.30},
    "gpt-4o": {"prompt": 5.00, "completion": 15.00},
    "gpt-4o-mini": {"prompt": 0.15, "completion": 0.60},
    "default": {"prompt": 1.0, "completion": 2.0}
}

class GovernanceManager:
    """
    Sovereign Governance: Tracks and monitors resource usage (tokens, cost) 
    per agent and session to provide real-time telemetry to the UI.
    """
    
    @staticmethod
    def log_usage(
        session_id: str,
        agent_type: str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> Optional[SwarmUsageStats]:
        """
        Calculates cost and logs usage statistics to the database.
        """
        try:
            # Normalize model name for pricing lookup
            price_key = "default"
            for k in PRICING.keys():
                if k in model_name.lower():
                    price_key = k
                    break
            
            pricing = PRICING.get(price_key, PRICING["default"])
            
            # Estimate cost in USD
            cost_prompt = (prompt_tokens / 1_000_000) * pricing["prompt"]
            cost_comp = (completion_tokens / 1_000_000) * pricing["completion"]
            total_cost = cost_prompt + cost_comp
            
            with SessionLocal() as db:
                stats = SwarmUsageStats(
                    session_id=session_id,
                    agent_type=agent_type,
                    model_name=model_name,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    estimated_cost_usd=total_cost,
                    timestamp=datetime.now()
                )
                db.add(stats)
                db.commit()
                db.refresh(stats)
                
                logger.info(f"📊 [Governance] Logged usage for {agent_type} ({model_name}): ${total_cost:.6f}")
                return stats
                
        except Exception as e:
            logger.error(f"❌ [Governance] Failed to log usage: {e}")
            return None

    @staticmethod
    def get_session_telemetry(db: Session, session_id: str) -> Dict[str, Any]:
        """
        Returns aggregated cost and token data for a specific session.
        """
        stats = db.query(SwarmUsageStats).filter(SwarmUsageStats.session_id == session_id).all()
        
        total_cost = sum(s.estimated_cost_usd for s in stats)
        total_tokens = sum(s.total_tokens for s in stats)
        
        agent_breakdown = {}
        for s in stats:
            if s.agent_type not in agent_breakdown:
                agent_breakdown[s.agent_type] = {"cost": 0.0, "tokens": 0}
            agent_breakdown[s.agent_type]["cost"] += s.estimated_cost_usd
            agent_breakdown[s.agent_type]["tokens"] += s.total_tokens
            
        return {
            "session_id": session_id,
            "total_cost_usd": total_cost,
            "total_tokens": total_tokens,
            "agent_breakdown": agent_breakdown
        }

governance_manager = GovernanceManager()
