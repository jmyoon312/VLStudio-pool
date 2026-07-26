import os
import cv2
import numpy as np
import logging
import json
from typing import Dict, Any, List
from app.config import settings

logger = logging.getLogger(__name__)

class VideoAnalyzer:
    """
    Advanced Video Intelligence Service.
    Performs local forensic analysis and AI deconstruction.
    """
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self.temp_dir = settings.TEMP_DIR
        os.makedirs(self.temp_dir, exist_ok=True)

    def extract_keyframes(self, video_path: str, num_frames: int = 5) -> List[str]:
        """
        Extracts key frames from the video for visual analysis.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            return []

        indices = [int(total_frames * (i + 1) / (num_frames + 1)) for i in range(num_frames)]
        frame_paths = []

        for i, idx in enumerate(indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                frame_name = f"keyframe_{os.path.basename(video_path)}_{i}.jpg"
                frame_path = os.path.join(self.temp_dir, frame_name)
                cv2.imwrite(frame_path, frame)
                frame_paths.append(frame_path)

        cap.release()
        return frame_paths

    def analyze_local_forensics(self, video_path: str) -> Dict[str, Any]:
        """
        Uses OpenCV and FFmpeg to analyze metadata and visual patterns.
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = total_frames / fps if fps > 0 else 0

        # Shot frequency analysis (Simple difference)
        ret, prev_frame = cap.read()
        scene_changes = 0
        if ret:
            prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
            for _ in range(0, int(total_frames), int(fps)): # Sample 1 frame per second
                cap.set(cv2.CAP_PROP_POS_FRAMES, cap.get(cv2.CAP_PROP_POS_FRAMES) + fps)
                ret, frame = cap.read()
                if not ret: break
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                diff = cv2.absdiff(gray, prev_gray)
                if np.mean(diff) > 30: # Threshold for scene change
                    scene_changes += 1
                prev_gray = gray
        
        cap.release()

        return {
            "dimensions": f"{int(width)}x{int(height)}",
            "aspect_ratio": "9:16" if height > width else "16:9",
            "pacing_score": round(scene_changes / (duration / 60), 2) if duration > 0 else 0, # Shots per minute
            "is_potentially_ai": "undetected", # Rule-based detection is hard, AI stage will handle this
            "source_type": "original" if scene_changes < 3 else "montage/mashup"
        }

    async def deep_analyze(self, video_path: str) -> Dict[str, Any]:
        """
        Combines local forensics with Gemini 1.5 Multimodal analysis.
        """
        logger.info(f"🔍 [Deep Analysis] Starting for {video_path}")
        
        # 1. Local Stage
        local_results = self.analyze_local_forensics(video_path)
        keyframes = self.extract_keyframes(video_path)

        # 2. AI Stage (Gemini 1.5 Flash)
        if self.llm_client:
            prompt = """
            영상 제작 전문가로서 이 영상의 다음 요소들을 아주 디테일하게 분석해줘.
            분석 대상: 제공된 5개의 주요 프레임.
            목표: 이 영상이 왜 성공했는지, 어떤 '결'을 가지고 있는지 파악.

            [분석 항목]
            1. 주제 및 소재: 이 영상이 다루는 구체적인 주제
            2. 무드 및 톤: 영상의 분위기 (감성적, 정보적, 자극적 등)
            3. 기승전결 구조: 스토리의 흐름과 후킹 포인트
            4. 음성/나레이션 스타일: 목소리의 톤, 속도, 감정
            5. 시각적 소스 분석: 실제 촬영 영상인지, 스톡 이미지/영상인지, 아니면 AI 생성 영상인지 판단 (근거 포함)
            6. 확장 전략: 이 주제를 기반으로 더 조회수가 잘 나올 만한 '확장판' 아이디어 3개

            JSON 형식으로 답변해줘.
            """
            
            # Read images for Gemini
            images = []
            for kp in keyframes:
                with open(kp, "rb") as f:
                    images.append({"data": f.read(), "mime_type": "image/jpeg"})

            # Handle sync generation (it's not awaitable in LLMClient)
            ai_report = self.llm_client.generate_content(
                prompt=prompt,
                model_name="gemini-1.5-flash",
                images=images,
                system_instruction="You are a Master Creative Director specializing in viral video analysis."
            )
            
            # If report is a dict (full_response=True), extract content
            if isinstance(ai_report, dict):
                ai_report = ai_report.get("content", "")

            # Try to parse JSON from AI report
            try:
                # Basic cleaning if AI includes markdown code blocks
                clean_report = str(ai_report).replace("```json", "").replace("```", "").strip()
                local_results["ai_analysis"] = json.loads(clean_report)
            except Exception as e:
                logger.warning(f"Failed to parse AI JSON: {e}")
                local_results["ai_analysis"] = {"raw_text": str(ai_report)}

        # Cleanup keyframes
        for kp in keyframes:
            try: os.remove(kp)
            except: pass


    async def aggregate_channel_dna(self, video_paths: List[str]) -> Dict[str, Any]:
        """
        [IDEAL PATH] Analyzes multiple viral videos from a channel to distill a master Style Signature (DNA).
        """
        logger.info(f"🧬 [DNA Aggregation] Analyzing {len(video_paths)} videos for master signature.")
        
        individual_reports = []
        for path in video_paths[:10]: # Limit to top 10 for resource efficiency
            try:
                report = await self.deep_analyze(path)
                individual_reports.append(report)
            except Exception as e:
                logger.warning(f"Failed to analyze {path} during aggregation: {e}")

        if not individual_reports:
            return {}

        # Aggregation Logic (ideal path: LLM powered synthesis)
        if self.llm_client:
            summary_prompt = f"""
            다음은 특정 유튜브 채널에서 가장 성공한 영상 {len(individual_reports)}개의 개별 분석 리포트야.
            이 리포트들을 종합하여 이 채널만의 '성공 DNA (Style Signature)'를 추출해줘.
            
            [개별 리포트 데이터]
            {json.dumps(individual_reports, indent=2, ensure_ascii=False)}
            
            [추출할 DNA 항목]
            1. pacing_profile: 평균적인 컷 전환 속도 및 리듬
            2. tone_voice: 나레이션의 공통된 톤과 감정
            3. hook_dna: 사람들을 끌어당긴 공통적인 오프닝 패턴
            4. visual_identity: 배경, 색감, 편집 스타일(AI 생성 시 사용할 프롬프트 포함)
            5. winning_keywords: 이 채널에서 반복적으로 성공한 키워드들
            
            결과는 반드시 JSON 형식으로만 보내줘.
            """
            
            dna_json = self.llm_client.generate_content(
                prompt=summary_prompt,
                model_name="gemini-1.5-flash",
                system_instruction="You are a Brand Strategist distilling a channel's creative DNA."
            )
            
            try:
                # If report is a dict, extract
                if isinstance(dna_json, dict):
                    dna_json = dna_json.get("content", "")
                
                clean_dna = str(dna_json).replace("```json", "").replace("```", "").strip()
                return json.loads(clean_dna)
            except Exception as e:
                logger.error(f"Failed to aggregate DNA JSON: {e}")
                return {"raw_summary": str(dna_json)}
        
        return {"error": "LLM Client missing for aggregation"}
