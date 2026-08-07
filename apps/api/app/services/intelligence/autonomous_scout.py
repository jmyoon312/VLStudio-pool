import asyncio
import logging
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use import Agent, Browser, Controller
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Trend, ScoutCandidate, SwarmWisdom, SwarmArtifact
from app.config import settings

logger = logging.getLogger(__name__)

class AutonomousScout:
    """
    Spider-web Scouter: Autonomous discovery of viral trends and reference channels.
    Uses browser-use to navigate social platforms and extract real-time intelligence.
    """

    def __init__(self, settings, llm_client):
        self.settings = settings
        self.llm_client = llm_client
        self._init_llm()

    def _init_llm(self):
        """Uses the brain_router to initialize the LangChain model based on settings"""
        from app.agent.brain_router import brain_router
        
        provider = getattr(self.settings, "openclaw_preferred_provider", "auto")
        model_name = getattr(self.settings, "openclaw_model", self.settings.default_model)
        
        # Normalize and handle auto provider
        if not provider or provider == "auto":
            provider = "google"
            
        if "/" in model_name:
            provider, clean_model = model_name.split("/", 1)
        else:
            clean_model = model_name

        logger.info(f"🤖 [AutonomousScout] Initializing LLM via brain_router: {provider}/{clean_model}")
        self.llm = brain_router._create_langchain_model(provider, clean_model, self.settings)
        if not self.llm:
            raise ValueError(f"Failed to create LangChain model via brain_router for {provider}/{clean_model}")
        
    async def scout_niche(self, niche: str, depth: int = 1):
        """
        Main entry point for scouting a specific niche.
        """
        logger.info(f"🕸️ Starting Spider-web Scout for niche: {niche}")
        
        # Initialize browser directly with settings in browser-use v0.12+
        browser = Browser(headless=True)
        try:
            # 1. Trend & Keyword Discovery
            trends = await self._discover_trends(browser, niche)
            
            # 2. Reference Channel Discovery
            candidates = await self._discover_channels(browser, niche)
            
            # 3. Store Results
            self._persist_results(niche, trends, candidates)
            
            return {
                "niche": niche,
                "trends_found": len(trends),
                "channels_found": len(candidates)
            }
            
        finally:
            await browser.close()

    async def _discover_trends(self, browser: Browser, niche: str) -> List[Dict[str, Any]]:
        """
        Navigates to YouTube/TikTok trending and search to find viral keywords.
        """
        if niche.lower() == "autonomous":
            task = """
            Explore YouTube Trending (Global), TikTok Trending Hashtags, and Google Trends.
            Identify 5 high-velocity topics that are currently breaking out in the last 24-48 hours.
            Focus on topics suitable for automated video production (News, Explainer, Reaction).
            Return a list of viral keywords with their estimated search volume (0-100) as a JSON list.
            Example: [{"keyword": "OpenAI Sora New Update", "category": "AI", "volume": 95}]
            """
        else:
            task = f"""
            Go to YouTube and search for '{niche}'. 
            Analyze the search results and find 'Suggested' or 'Related' search terms that appear in the search bar or under results.
            Then go to TikTok and look for trending hashtags related to '{niche}'.
            Return a list of viral keywords with their estimated search volume (High/Medium/Low) as a JSON list.
            Example: [{{"keyword": "Apple Vision Pro Review", "category": "{niche}", "volume": 80}}]
            """
        
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=browser
        )
        
        result = await agent.run()
        # Parse the result from the agent (result is an AgentHistory object, we want the final content)
        # Note: In real implementation, we might need a better parser for agent output
        try:
            # Try to extract JSON from the last message
            last_msg = result.final_result()
            if not last_msg:
                return []
            
            # Extract JSON if returned in markers
            if "```json" in last_msg:
                last_msg = last_msg.split("```json")[1].split("```")[0]
            
            return json.loads(last_msg)
        except Exception as e:
            logger.error(f"Failed to parse trend results: {e}")
            return []

    async def _discover_channels(self, browser: Browser, niche: str) -> List[Dict[str, Any]]:
        """
        Finds outlier channels (low subscribers, high views) in the niche.
        """
        if niche.lower() == "autonomous":
            task = """
            On YouTube, find at least 3 'outlier' channels that are currently viral (gaining subscribers fast or high views on recent videos) regardless of niche.
            Look for channels with high 'Viral Score' (Views / Subscriber Ratio > 10).
            Extract the channel URL, name, and a one-sentence summary of their success strategy.
            Return as a JSON list.
            Example: [{ "url": "...", "name": "...", "dna": "...", "viral_score": 95 }]
            """
        else:
            task = f"""
            On YouTube, find at least 3 channels in the '{niche}' niche that have under 50k subscribers but videos with over 100k views in the last 30 days.
            Extract the channel URL, name, and a one-sentence summary of why they are successful (their 'DNA').
            Return as a JSON list.
            Example: [{{ "url": "...", "name": "...", "dna": "...", "viral_score": 90 }}]
            """
        
        agent = Agent(
            task=task,
            llm=self.llm,
            browser=browser
        )
        
        result = await agent.run()
        try:
            last_msg = result.final_result()
            if not last_msg:
                return []
            
            if "```json" in last_msg:
                last_msg = last_msg.split("```json")[1].split("```")[0]
                
            return json.loads(last_msg)
        except Exception as e:
            logger.error(f"Failed to parse channel results: {e}")
            return []

    def _persist_results(self, niche: str, trends: List[Dict[str, Any]], candidates: List[Dict[str, Any]]):
        """
        Saves findings to the database.
        """
        db: Session = SessionLocal()
        try:
            # 1. Save Trends
            for t in trends:
                kw = t.get("keyword")
                if not kw: continue
                
                existing = db.query(Trend).filter(Trend.keyword == kw).first()
                if not existing:
                    new_trend = Trend(
                        keyword=kw,
                        category=niche,
                        search_volume=t.get("volume", 50),
                        source="AutonomousScout"
                    )
                    db.add(new_trend)
            
            # 2. Save Candidates
            for c in candidates:
                url = c.get("url")
                if not url: continue
                
                existing = db.query(ScoutCandidate).filter(ScoutCandidate.channel_url == url).first()
                if not existing:
                    new_cand = ScoutCandidate(
                        channel_url=url,
                        channel_name=c.get("name", "Unknown"),
                        niche=niche,
                        viral_potential_score=c.get("viral_score", 50),
                        total_sovereign_score=c.get("viral_score", 50),
                        subscriber_growth_7d=0.20, # Default for autonomous outliers
                        ai_reasoning="Discovered via Autonomous Browser Scout: " + c.get("dna", "")
                    )
                    db.add(new_cand)
                else:
                    existing.channel_name = c.get("name", existing.channel_name)
                    existing.total_sovereign_score = c.get("viral_score", existing.total_sovereign_score)
                    existing.subscriber_growth_7d = 0.25
                    existing.ai_reasoning = "Re-scanned via Autonomous Scout: " + c.get("dna", "")
                    existing.status = "PENDING"
            
            db.commit()
            
            # 3. [NEW] Save Lineage Artifact for Phase 4 Maturity
            # Record that a successful discovery happened for this niche
            discovery_artifact = SwarmArtifact(
                session_id=f"discovery-{niche}-{datetime.now().strftime('%Y%m%d')}",
                node_id="AUTONOMOUS_SCOUT",
                stage_name="DISCOVER",
                artifact_type="TREND_REPORT",
                data_packet={
                    "niche": niche,
                    "trends_count": len(trends),
                    "candidates_count": len(candidates),
                    "trends": trends[:5] # Sample for audit
                },
                created_at=datetime.now()
            )
            db.add(discovery_artifact)
            db.commit()

            logger.info(f"[OK] Saved {len(trends)} trends and {len(candidates)} candidates for {niche}. Lineage recorded.")
            
        except Exception as e:
            logger.error(f"Database persistence failed: {e}")
            db.rollback()
        finally:
            db.close()

# For testing
if __name__ == "__main__":
    scout = AutonomousScout()
    asyncio.run(scout.scout_niche("AI Technology News"))
