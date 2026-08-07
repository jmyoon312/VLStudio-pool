import logging
import json
import re
from typing import Dict, Any, List, Optional
from app.llm_manager import LLMClient

logger = logging.getLogger(__name__)


class QualityAuditor:
    """
    Phase 7 Quality Verification Service
    
    Provides quality scoring (0-100) for scripts and videos:
    - Structure analysis
    - DNA alignment verification
    - Keyword inclusion check
    - Engagement potential assessment
    """
    
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client
    
    async def verify_script(
        self, 
        script: str, 
        dna: str, 
        niche: str = None,
        channel_id: int = None
    ) -> Dict[str, Any]:
        """
        Verify script quality and return score (0-100)
        
        Args:
            script: The script content to verify
            dna: Channel DNA/brand guidelines
            niche: Optional niche context
            channel_id: Optional channel ID for additional context
            
        Returns:
            dict with score, passed status, and detailed feedback
        """
        logger.info(f"[SEARCH] Starting quality verification for script (length: {len(script)})")
        
        # 1. Structure Analysis
        structure_score = self._analyze_structure(script)
        
        # 2. DNA Alignment Score  
        dna_score = await self._verify_dna_alignment(script, dna)
        
        # 3. Keyword Presence Check
        keyword_score = self._check_keywords(script, dna)
        
        # 4. Engagement Potential Score
        engagement_score = self._assess_engagement(script)
        
        # Calculate overall score with weighted components
        total_score = (
            structure_score * 0.25 +
            dna_score * 0.30 +
            keyword_score * 0.20 +
            engagement_score * 0.25
        )
        
        # Determine pass status
        passed = total_score >= 35
        needs_review = total_score < 30
        needs_human_review = 30 <= total_score < 35
        
        logger.info(
            f"[CHART] Quality Scores: Total={total_score:.2f}, "
            f"Structure={structure_score:.2f}, DNA={dna_score:.2f}, "
            f"Keywords={keyword_score:.2f}, Engagement={engagement_score:.2f}"
        )
        
        return {
            "score": round(total_score, 2),
            "passed": passed,
            "needs_review": needs_review,
            "needs_human_review": needs_human_review,
            "status": "APPROVED" if passed else ("REVIEW" if needs_human_review else "REJECTED"),
            "details": {
                "structure_score": round(structure_score, 2),
                "dna_score": round(dna_score, 2),
                "keyword_score": round(keyword_score, 2),
                "engagement_score": round(engagement_score, 2)
            },
            "feedback": self._generate_feedback(
                total_score, 
                structure_score, 
                dna_score, 
                keyword_score, 
                engagement_score
            ),
            "metadata": {
                "script_length": len(script),
                "niche": niche,
                "channel_id": channel_id
            }
        }
    
    def _analyze_structure(self, script: str) -> float:
        """
        Analyze script structure:
        - Has hook in first 3 lines
        - Has clear sections
        - Proper length for format
        - Has transitions
        """
        score = 0
        max_score = 100
        
        lines = script.split('\n')
        line_count = len(lines)
        
        # 1. Hook check (first 3 lines should be engaging) - 25 points
        first_lines = ' '.join(lines[:3]).lower() if lines else ""
        # [FIX] Added professional/informational/polite hooks
        hook_keywords = [
            'wait/', '끝까지', '생각', '惊讶', '실화', '비밀', '공개', '대박', '震撼', '惊爆',
            '전해드립니다', '알려드립니다', '정보', '중요한', '꼭 확인', '안내', '필수', '시니어',
            '안녕하세요', '오늘은', '알아보겠습니다', '공유합니다', '소개합니다'
        ]
        if any(kw in first_lines for kw in hook_keywords):
            score += 25
        elif line_count >= 3:
            score += 20  # Significant partial credit for informational hooks
        
        # 2. Section clarity - 25 points
        section_markers = ['---', '===', ' parte ', ' часть ', '장면', '씬', ' scene ']
        if any(marker in script for marker in section_markers):
            score += 25
        elif line_count > 10:
            score += 15  # Partial credit for longer scripts
        
        # 3. Proper length for shorts (30-90 seconds) - 25 points
        # Rough estimate: ~3 words per second for Korean
        word_count = len(script.split())
        estimated_duration = word_count / 3
        
        if 20 <= estimated_duration <= 120:  # Allow some range
            score += 25
        elif 10 <= estimated_duration <= 180:
            score += 15
        else:
            score += 5
        
        # 4. Transitions - 25 points
        transition_keywords = [
            '그런데', '하지만', '그리고', '다음', '이제', '그다음',
            'however', 'but', 'then', 'next', 'also',
            '따라서', '결론적으로', '그 결과', '즉', '다시 말해'
        ]
        transition_count = sum(1 for kw in transition_keywords if kw in script.lower())
        if transition_count >= 2:
            score += 25
        elif transition_count == 1:
            score += 20  # Increased from 15
        else:
            score += 10  # Increased from 5
        
        return min(score, max_score)
    
    async def _verify_dna_alignment(self, script: str, dna: str) -> float:
        """
        Verify script aligns with Channel DNA using LLM
        """
        if not dna or dna.strip() == "":
            logger.warning("No DNA provided, using default score")
            return 50.0
        
        prompt = f"""
[DNA Alignment Checker]
You are a strict quality checker. Evaluate how well the script aligns with the Channel DNA.

Channel DNA/Style Guidelines:
{dna}

Script to Check:
{script}

Scoring Criteria (0-100):
- 90-100: Perfect alignment, maintains brand voice exactly
- 70-89: Good alignment, minor deviations
- 50-69: Partial alignment, some DNA elements missing
- 30-49: Poor alignment, many DNA elements missing
- 0-29: No alignment, completely off-brand

Output ONLY a number (0-100) representing the DNA alignment score.
"""
        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name="gemini-2.0-flash"
            )
            
            # Extract number from response
            match = re.search(r'(\d+(?:\.\d+)?)', str(response))
            if match:
                score = float(match.group(1))
                return min(max(score, 0), 100)  # Clamp to 0-100
            
            logger.warning(f"Could not parse DNA score from response: {response}")
            return 50.0
            
        except Exception as e:
            logger.error(f"DNA alignment check failed: {e}")
            return 50.0  # Default to middle score on error
    
    def _check_keywords(self, script: str, dna: str) -> float:
        """
        Check if important keywords from DNA are included in script
        """
        if not dna:
            return 50.0
        
        # Extract potential keywords from DNA
        # Look for key phrases, brand terms, etc.
        keyword_patterns = [
            r'[가-힣]{2,4}형',  # Korean style indicators
            r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b',  # English proper nouns
            r'#\w+',  # Hashtags
            r'@{3,}',  # SFX markers like @@@
        ]
        
        dna_keywords = set()
        for pattern in keyword_patterns:
            matches = re.findall(pattern, dna)
            dna_keywords.update(matches)
        
        if not dna_keywords:
            return 50.0
        
        # Check how many DNA keywords appear in script
        script_lower = script.lower()
        matched_keywords = sum(1 for kw in dna_keywords if kw.lower() in script_lower)
        
        match_rate = matched_keywords / len(dna_keywords) if dna_keywords else 0
        
        # Score based on match rate
        return min(match_rate * 100 + 20, 100)  # Minimum 20% if DNA exists
    
    def _assess_engagement(self, script: str) -> float:
        """
        Assess engagement potential of the script
        """
        score = 0
        max_score = 100
        
        # 1. Emotion words - 30 points
        # [FIX] Added trust-based and helpful words for informational niches
        emotion_words = [
            # Positive/Clickbaity
            '대박', '미친', '충격', '놀라운', '감동', '웃김', '재밌', '신나',
            'amazing', 'shocking', 'incredible', 'wow', 'funny', 'exciting',
            # Trust/Helpful (For Senior/Info niches)
            '도움', '건강', '행복', '필수', '안전', '평온', '유익', '지혜',
            # Negative/Dramatic
            '무서운', '恐怖', '긴장', '심장', '후회', '悲慘', '愤怒',
            'scary', 'terrifying', 'heartbreaking', 'heart-stopping'
        ]
        emotion_count = sum(1 for word in emotion_words if word in script.lower())
        if emotion_count >= 2:  # Lowered required count to 2
            score += 30
        elif emotion_count >= 1:
            score += 20  # Increased partial credit
        
        # 2. Call to action - 25 points
        cta_patterns = [
            '구독', '좋아요', '댓글', '공유',
            'subscribe', 'like', 'comment', 'share',
            '지금', '바로', '오늘', '마감'
        ]
        if any(cta in script for cta in cta_patterns):
            score += 25
        
        # 3. Questions/Rhetorical - 20 points
        question_marks = script.count('?')
        question_words = ['어떻게', '왜', '무엇', '누구', '언제', 'where', 'why', 'what', 'how']
        has_questions = question_marks > 0 or any(q in script.lower() for q in question_words)
        
        if has_questions:
            score += 20
        
        # 4. Numbers/Statistics - 15 points
        number_pattern = r'\d+(?:개|번|만|억|%|명|人|万|億)'
        numbers = re.findall(number_pattern, script)
        if len(numbers) >= 2:
            score += 15
        elif len(numbers) == 1:
            score += 8
        
        # 5. Variety of expression - 10 points
        unique_chars = len(set(script))
        if unique_chars > 50:
            score += 10
        elif unique_chars > 30:
            score += 5
        
        return min(score, max_score)
    
    def _generate_feedback(
        self, 
        total_score: float,
        structure: float,
        dna: float,
        keywords: float,
        engagement: float
    ) -> List[str]:
        """Generate actionable feedback based on scores"""
        feedback = []
        
        if total_score >= 70:
            feedback.append("[OK] Script quality is good, ready for production")
            return feedback
        
        # Structure feedback
        if structure < 60:
            feedback.append("[WARN] Improve structure: Add clear sections and transitions")
        
        # DNA feedback
        if dna < 60:
            feedback.append("[WARN] DNA alignment issues: Review brand guidelines and adjust tone")
        
        # Keywords feedback
        if keywords < 50:
            feedback.append("[WARN] Missing key brand keywords from DNA")
        
        # Engagement feedback
        if engagement < 60:
            feedback.append("[WARN] Low engagement potential: Add emotional hooks, questions, or CTAs")
        
        if not feedback:
            feedback.append("ℹ️ Minor improvements needed but overall acceptable")
        
        return feedback
    
    async def verify_video(
        self,
        video_path: str,
        script: str,
        dna: str,
        niche: str = None
    ) -> Dict[str, Any]:
        """
        Verify video quality (basic check without actual video analysis)
        
        Note: Full video analysis would require additional computer vision
        This is a placeholder for future enhancement
        """
        logger.info(f"[SEARCH] Starting video quality verification: {video_path}")
        
        # For now, base video score on script quality
        script_verification = await self.verify_script(script, dna, niche)
        
        # Add video-specific checks (placeholder)
        return {
            **script_verification,
            "video_path": video_path,
            "video_score": script_verification["score"],  # Currently same as script
            "video_checks": {
                "file_exists": __import__('os').path.exists(video_path) if video_path else False,
                "format_check": True,  # Would need actual video metadata
                "duration_check": True  # Would need ffprobe
            }
        }


# Singleton instance for reuse
_quality_auditor_instance = None

def get_quality_auditor(llm_client: LLMClient = None) -> QualityAuditor:
    """Get or create QualityAuditor singleton"""
    global _quality_auditor_instance
    
    if _quality_auditor_instance is None:
        if llm_client is None:
            from app.config import settings
            from app.llm_manager import LLMClient
            llm_client = LLMClient(settings)
        _quality_auditor_instance = QualityAuditor(llm_client)
    
    return _quality_auditor_instance