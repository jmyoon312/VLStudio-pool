import os
import re
import json
import logging
from typing import List, Dict, Any, Tuple
from pathlib import Path
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# The System Prompt provided by the user
DOUYIN_BRANDYFY_PROMPT = """역할: 중국 드라마/영상(간체) 원본을 정밀 분석·번역하여, 한국 쇼츠 시장에서 조회수와 구독자를 폭발적으로 늘릴 수 있는 50초 최적화 자극적 쇼츠 대본 및 편집용 타임스탬프 가이드를 제작하는 수석 에디터.

2. 알고리즘 폭발을 위한 핵심 전략 (보강 요소)
① 초반 3초 '훅(Hooking)' 및 빌런 구도 명확화
② 핑퐁식 단문 구조 (템포감 유지)
③ 괄호 지문 100% 제거
④ 사이다 반전 및 구독 유도(CTA) 결합

3. 엄격 제약 및 규격 수칙
① 50초 최적화 분량 및 문장 제약 (낭독 기준 정확히 40초~50초, 350~450자 내외. 1~2문장 이내)
② 환각(Hallucination) 방지 및 자극적 각색 (영상 속 인물/상황 기반, 반응 좋은 키워드 각색)

4. 표준 출력 형식 및 타임스탬프 규격 (JSON 형식)
반드시 아래의 JSON 형식에 맞추어 출력해야 합니다. 마크다운 테이블이나 다른 텍스트 설명은 제외하고 오직 유효한 JSON 문자열만 응답하세요.
**[주의사항 1]: `content` 필드에는 [화자A]와 같은 괄호나 지문, 화자 표시를 절대 포함하지 말고 오직 성우가 소리내어 읽을 실제 순수 대사/나레이션 텍스트만 작성하세요.** 화자 식별은 `speaker` 필드에 작성하고, TTS 목소리 매칭을 위해 `speaker_gender`, `speaker_age`, `speaker_tone`을 구체적으로 명시하세요.
**[주의사항 2]: `start_time`과 `end_time`은 당신이 임의로 만들어낸 숫자가 아니라, 반드시 제공된 원본 자막 텍스트의 타임스탬프 `[00:15 - 00:20]`를 정확히 참조하여 기재해야 합니다. (예: 15.0, 20.0)** 이것은 실제 원본 비디오를 컷편집(Slicing)할 절대 좌표로 사용됩니다.
```json
{
  "title": "자극적이고 직관적인 어그로형 제목",
  "script_text": "전체 대본 본문을 줄바꿈 포함하여 여기에 작성합니다...",
  "scenes": [
    {
      "index": 1,
      "type": "나레이션",
      "speaker": "나레이션",
      "speaker_gender": "여성",
      "speaker_age": "청년",
      "speaker_tone": "미스터리하고 긴장감 있는 어조",
      "content": "이 남자는 지금 엄청난 실수를 저질렀습니다.",
      "start_time": 0.0,
      "end_time": 3.5,
      "edit_tip": "자극적인 초반 훅 장면 클로즈업"
    },
    {
      "index": 2,
      "type": "대사",
      "speaker": "시어머니",
      "speaker_gender": "여성",
      "speaker_age": "노년",
      "speaker_tone": "분노하고 표독스러운 어조",
      "content": "감히 내 아들에게 꼬리를 쳐?",
      "start_time": 3.5,
      "end_time": 6.0,
      "edit_tip": "놀란 표정 교차 편집"
    }
  ]
}
```
"""

class ParsedScene(BaseModel):
    index: int
    type: str # '나레이션', '대사', '엔딩'
    content: str
    start_time: float
    end_time: float
    edit_tip: str
    speaker: str = "" # Parsed from content e.g., 화자A
    speaker_gender: str = "" # "남성", "여성"
    speaker_age: str = "" # "청년", "중년", "노년"
    speaker_tone: str = "" # "차분함", "분노", "비열함" 등

class AIAnalysisResult(BaseModel):
    title: str
    script_text: str
    scenes: List[ParsedScene]

def parse_time(time_str: str) -> float:
    """Parses 'MM:SS' or 'HH:MM:SS' into float seconds."""
    try:
        parts = time_str.strip().split(':')
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return 0.0
    except:
        return 0.0

def parse_ai_response(response_text: str) -> AIAnalysisResult:
    """
    Parses the JSON block from the AI's response.
    """
    import json
    import re
    
    # Try to extract JSON from a markdown block if present
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
    json_str = match.group(1) if match else response_text.strip()
    
    # Clean up any potential prefix/suffix text outside JSON braces
    start_idx = json_str.find('{')
    end_idx = json_str.rfind('}')
    if start_idx != -1 and end_idx != -1:
        json_str = json_str[start_idx:end_idx+1]
        
    try:
        data = json.loads(json_str)
        scenes = []
        for s in data.get("scenes", []):
            scenes.append(ParsedScene(
                index=int(s.get("index", 1)),
                type=str(s.get("type", "대사")),
                content=str(s.get("content", "")).replace('[', '').replace(']', ''),
                start_time=float(s.get("start_time", 0.0)),
                end_time=float(s.get("end_time", 0.0)),
                edit_tip=str(s.get("edit_tip", "")),
                speaker=str(s.get("speaker", "나레이션")),
                speaker_gender=str(s.get("speaker_gender", "")),
                speaker_age=str(s.get("speaker_age", "")),
                speaker_tone=str(s.get("speaker_tone", ""))
            ))
        return AIAnalysisResult(
            title=data.get("title", "무제 쇼츠"),
            script_text=data.get("script_text", ""),
            scenes=scenes
        )
    except Exception as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Raw response was: {response_text}")
        
        # Return fallback on error
        return AIAnalysisResult(
            title="AI 분석 결과 파싱 실패",
            script_text="시스템 내부 파싱 오류가 발생했습니다.",
            scenes=[ParsedScene(
                index=1, type="나레이션", content="응답 형식을 파싱할 수 없습니다.",
                start_time=0.0, end_time=3.0, edit_tip="재시도 요망", speaker="시스템"
            )]
        )

async def analyze_video(video_path: str, script_style: str = "base") -> AIAnalysisResult:
    """
    Video Analysis function using Subtitle extraction and Vision frames via LLMClient routing.
    """
    import os
    import cv2
    import base64
    import asyncio
    from app.database import SessionLocal
    from app import crud
    from app.llm_manager import LLMClient
    
    try:
        # Get settings first
        with SessionLocal() as db:
            settings = crud.get_settings(db)
            model_name = getattr(settings, "script_analysis_model", None) or getattr(settings, "default_llm_model", "auto")
            if not model_name:
                model_name = "auto"
                
            llm = LLMClient(settings)
            ffmpeg_path = getattr(settings, "ffmpeg_path", None) or "ffmpeg"
            
        logger.info(f"🎥 [AI Editor] Analyzing video: {video_path} (Style: {script_style})")

        # Define extraction tasks for concurrency
        def extract_sub():
            from app.subtitle_core import SubtitleEngine
            engine = SubtitleEngine(ffmpeg_path=ffmpeg_path)
            logger.info(f"🎙️ [AI Editor] Extracting subtitles from {video_path}...")
            return engine.extract_subtitle(video_path, model_name="base", language="ko")

        def extract_frames():
            import cv2
            logger.info(f"📸 [AI Editor] Extracting keyframes for vision analysis...")
            images = []
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                if total_frames > 0:
                    num_frames = 20 # 20 is optimal for speed vs context
                    step = max(1, total_frames // num_frames)
                    for i in range(num_frames):
                        frame_idx = i * step
                        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                        ret, frame = cap.read()
                        if not ret: break
                        
                        h, w = frame.shape[:2]
                        max_dim = 768
                        if h > max_dim or w > max_dim:
                            scale = max_dim / max(h, w)
                            frame = cv2.resize(frame, (int(w*scale), int(h*scale)))
                            
                        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        images.append(buffer.tobytes())
                cap.release()
            return images

        # Run audio and vision extraction concurrently
        sub_task = asyncio.to_thread(extract_sub)
        frame_task = asyncio.to_thread(extract_frames)
        
        (srt_content, error), images = await asyncio.gather(sub_task, frame_task)
        
        subtitle_text = ""
        if not error and srt_content:
            blocks = srt_content.strip().split('\n\n')
            text_lines = []
            for block in blocks:
                lines = block.strip().split('\n')
                if len(lines) >= 3:
                    # lines[0] is index, lines[1] is timestamp
                    timestamp = lines[1]
                    text = ' '.join(lines[2:])
                    if '-->' in timestamp:
                        start_str, end_str = timestamp.split(' --> ')
                        start_sec = parse_time(start_str.split(',')[0].split('.')[0])
                        end_sec = parse_time(end_str.split(',')[0].split('.')[0])
                        text_lines.append(f"[{start_sec} - {end_sec}] {text}")
            subtitle_text = '\n'.join(text_lines)
            
        logger.info(f"[OK] [AI Editor] Subtitle extracted: {len(subtitle_text)} chars")
        logger.info(f"[OK] [AI Editor] {len(images)} keyframes extracted.")
            
        style_modifier = ""
        if script_style == "old_people":
            style_modifier = "\n\n[타겟 변경 지시]: 50~70대 시청자를 타겟으로 합니다. 느릿하고 공감되는 어조, 자극적인 훅보다는 옛 향수나 따뜻한 공감을 유도하는 내용으로 각색하세요."
        elif script_style == "drama":
            style_modifier = "\n\n[타겟 변경 지시]: 과몰입 드라마형 숏폼. 감정선이 극대화되고 긴장감이 팽팽한 영화적 연출과 심각하고 진지한 나레이션으로 각색하세요."
        elif script_style == "info":
            style_modifier = "\n\n[타겟 변경 지시]: 정보 전달형 숏폼. 어그로나 자극적인 요소보다는 객관적이고 깔끔한 사실 위주의 전달과 담백한 나레이션으로 각색하세요."
            
        system_instruction = DOUYIN_BRANDYFY_PROMPT + style_modifier
            
        prompt = f"다음은 영상의 전체 자막(대사) 내용입니다:\n\n{subtitle_text}\n\n위 자막과 제공된 비디오 프레임 이미지들을 분석하여 대본과 컷편집 가이드를 작성해줘.\n" + system_instruction
        
        logger.info(f"🤖 [AI Editor] Routing analysis to model: {model_name} (Images: {len(images)}, Text: {len(subtitle_text)} chars)")
        
        # Run synchronous LLM call in a thread to prevent blocking FastAPI event loop
        response = await asyncio.to_thread(
            llm.generate_content,
            prompt=prompt,
            model_name=model_name,
            system_instruction=system_instruction,
            images=images if images else None
        )
        
        if isinstance(response, str):
            res_text = response
        elif hasattr(response, "text"):
            res_text = response.text
        elif hasattr(response, "content"):
            res_text = response.content
        else:
            res_text = str(response)
            
        if res_text.startswith("ERROR:"):
            logger.error(f"AI Editor LLM failed: {res_text}")
            raise Exception(res_text)
            
        return parse_ai_response(res_text)
    except Exception as e:
        import traceback
        logger.error(f"AI Editor analysis failed: {e}")
        logger.error(traceback.format_exc())
        mock_response = f"""
```markdown
[제목: AI 분석 실패 (자동 생성)]

【나레이션】 : 모델 연동 중 오류가 발생했습니다.
```

| 대본 구번 | 구분 | 대사/나레이션 내용 | 원본 영상 구간 (타임스탬프) | 화면 연출 및 컷편집 팁 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 나레이션 | 【나레이션】 {str(e)} | 00:00 - 00:03 | 오류 로그 확인 필요 |
"""
        return parse_ai_response(mock_response)
