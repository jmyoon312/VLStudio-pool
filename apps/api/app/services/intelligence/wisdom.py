from sqlalchemy.orm import Session
from datetime import datetime
import json
import logging
from typing import List, Dict, Any, Optional
from app.models import SwarmWisdom
from app.config.feature_flags import get_llm_client
from app.services.intelligence.hybrid_memory import hybrid_memory
from app.services.intelligence.obsidian_manager import ObsidianManager

logger = logging.getLogger(__name__)

class WisdomDistiller:
    """
    Distills raw mission logs and production data into high-level 'Swarm Wisdom'.
    This is the evolutionary core that prevents the AI from repeating mistakes 
    and reinforces successful creative patterns.
    """
    
    def __init__(self, db: Session):
        self.db = db
        # We'll use the highest intelligence model available for distillation
        self.llm = get_llm_client(preferred_provider="gemini", preferred_model="gemini-1.5-pro")
        self.obsidian = ObsidianManager()

    async def distill_mission_experience(self, session_id: str, niche: str, logs: List[Dict[str, Any]]) -> Optional[SwarmWisdom]:
        """
        Analyzes mission logs to extract a single high-value 'Wisdom' entry.
        """
        try:
            log_text = "\n".join([f"[{l.get('level', 'INFO')}] {l.get('message', '')}" for l in logs])
            
            prompt = f"""
            너는 ViraLoop 시스템의 '지혜 감별사(Wisdom Distiller)'야.
            아래는 '{niche}' 니치에서 수행된 스웜 미션의 로그 일체야.
            
            이 로그를 분석하여 다음 중 하나를 추출해:
            1. SUCCESS_PATTERN: 영상이 성공적으로 제작되거나 바이럴 가능성이 높은 '결'을 발견했을 때.
            2. FAILURE_POST_MORTEM: 기술적 오류, 품질 저하, 혹은 심미적 실패가 발생하여 다음엔 피해야 할 때.
            
            추출된 지혜는 에이전트가 다음 작업에서 시스템 프롬프트로 주입받아 직접 활용할 수 있도록 구체적이고 실천적이어야 해.
            
            [미션 로그]
            {log_text[:4000]} # 로그가 너무 길면 상단 4000자만 분석
            
            [응답 양식 (JSON)]
            {{
                "title": "지혜의 제목 (요약)",
                "content": "실천적인 지침이나 패턴 분석 내용",
                "experience_type": "SUCCESS_PATTERN" 또는 "FAILURE_POST_MORTEM",
                "category": "SCRIPT", "VISUAL", "TREND", "HOOK" 중 선택,
                "importance_score": 0-100 점수
            }}
            """
            
            response = await self.llm.generate(prompt)
            # Basic JSON extraction (assuming the LLM returns valid JSON in code block or raw)
            cleaned_resp = response.strip()
            if "```json" in cleaned_resp:
                cleaned_resp = cleaned_resp.split("```json")[1].split("```")[0].strip()
            
            wisdom_data = json.loads(cleaned_resp)
            
            new_wisdom = SwarmWisdom(
                niche=niche,
                category=wisdom_data.get("category", "TREND"),
                title=wisdom_data.get("title", "New Wisdom"),
                content=wisdom_data.get("content", ""),
                experience_type=wisdom_data.get("experience_type", "SUCCESS_PATTERN"),
                importance_score=wisdom_data.get("importance_score", 50),
                source_session_id=session_id
            )
            
            self.db.add(new_wisdom)
            self.db.commit()
            self.db.refresh(new_wisdom)
            
            # [PHASE 13] Persistent Hybrid Memory
            try:
                # 1. Generate Embedding
                embedding = self.llm.embed_text(new_wisdom.content)
                
                # 2. Store in LanceDB
                hybrid_memory.add_vector_wisdom(
                    niche=niche,
                    title=new_wisdom.title,
                    content=new_wisdom.content,
                    embedding=embedding
                )
                
                hybrid_memory.add_knowledge_link(
                    source=niche,
                    target=new_wisdom.category,
                    relationship=f"Uses_{new_wisdom.experience_type}",
                    weight=float(new_wisdom.importance_score) / 100.0
                )
                
                # 4. [PHASE 14+] Direct Obsidian Synchronization
                self.obsidian.update_wiki_concept(
                    concept=new_wisdom.title,
                    definition=new_wisdom.content,
                    references=[niche, new_wisdom.category],
                    importance=new_wisdom.importance_score
                )
            except Exception as e_mem:
                logger.warning(f"⚠️ Failed to update hybrid memory layers: {e_mem}")

            logger.info(f"✨ Distilled new wisdom for {niche}: {new_wisdom.title}")
            return new_wisdom
            
        except Exception as e:
            logger.error(f"❌ Failed to distill wisdom: {e}")
            self.db.rollback()
            return None

    def get_wisdom_for_niche(self, niche: str, limit: int = 5) -> str:
        """
        Returns a concatenated string of top wisdom for a specific niche to be injected into agent prompt.
        """
        wisdoms = self.db.query(SwarmWisdom).filter(
            SwarmWisdom.niche == niche
        ).order_by(SwarmWisdom.importance_score.desc()).limit(limit).all()
        
        if not wisdoms:
            return ""
            
        text = "이전에 학습된 중요한 지침들:\n"
        for i, w in enumerate(wisdoms):
            text += f"{i+1}. [{w.category}] {w.title}: {w.content}\n"
            
        return text
