"""
AI Metadata Generation Service

Extracts subtitles from video files and generates platform-optimized metadata
(title, description, hashtags) using AI models configured in settings.
"""

import logging
import subprocess
import tempfile
import os
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from .. import crud
from ..llm_manager import LLMClient

logger = logging.getLogger(__name__)


class AIMetadataService:
    """Service for AI-powered video metadata generation"""
    
    def __init__(self, db: Session):
        self.db = db
        self.settings = crud.get_settings(db)
        if not self.settings:
            from .. import schemas
            self.settings = crud.create_settings(db, schemas.SettingsCreate())
        self.llm_client = LLMClient(self.settings)
    
    def extract_subtitles(self, video_path: str) -> Optional[str]:
        """
        Extract subtitles from video file using ffmpeg.
        
        Args:
            video_path: Path to video file
            
        Returns:
            Extracted subtitle text or None if extraction fails
        """
        try:
            # Check if video file exists
            if not os.path.exists(video_path):
                logger.error(f"Video file not found: {video_path}")
                return None
            
            # Create temporary file for subtitle output
            with tempfile.NamedTemporaryFile(mode='w+', suffix='.srt', delete=False, encoding='utf-8') as temp_file:
                subtitle_path = temp_file.name
            
            try:
                # Extract subtitles using ffmpeg
                # Try to extract embedded subtitles first
                ffmpeg_path = self.settings.ffmpeg_path or "ffmpeg"
                
                command = [
                    ffmpeg_path,
                    '-i', video_path,
                    '-map', '0:s:0',  # Select first subtitle stream
                    '-c:s', 'srt',     # Convert to SRT format
                    '-y',              # Overwrite output
                    subtitle_path
                ]
                
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',     # [FIX] Force UTF-8 execution
                    errors='replace',     # [FIX] Ignore decode errors
                    timeout=60
                )
                
                # If subtitle extraction failed, try extracting from audio
                if result.returncode != 0:
                    logger.info("No embedded subtitles found, attempting audio transcription...")
                    return self._transcribe_audio(video_path)
                
                # Read extracted subtitles
                with open(subtitle_path, 'r', encoding='utf-8') as f:
                    subtitle_content = f.read()
                
                # Parse SRT and extract text only
                text = self._parse_srt(subtitle_content)
                
                logger.info(f"✅ Extracted {len(text)} characters of subtitle text")
                return text
                
            finally:
                # Clean up temporary file
                if os.path.exists(subtitle_path):
                    os.remove(subtitle_path)
                    
        except subprocess.TimeoutExpired:
            logger.error("Subtitle extraction timed out")
            return None
        except Exception as e:
            logger.error(f"Failed to extract subtitles: {e}")
            return None
    
    def _parse_srt(self, srt_content: str) -> str:
        """
        Parse SRT subtitle format and extract text only.
        
        Args:
            srt_content: Raw SRT file content
            
        Returns:
            Extracted text without timestamps and numbering
        """
        lines = srt_content.strip().split('\n')
        text_lines = []
        
        for line in lines:
            line = line.strip()
            # Skip empty lines, numbers, and timestamps
            if not line or line.isdigit() or '-->' in line:
                continue
            text_lines.append(line)
        
        return ' '.join(text_lines)
    
    def _transcribe_audio(self, video_path: str) -> Optional[str]:
        """
        Transcribe audio from video using Whisper (via SubtitleEngine).
        """
        try:
            logger.info("Initializing SubtitleEngine for transcription...")
            # Lazy import to avoid circular dependencies
            import sys
            # Add backend root to path to find subtitle_core.py
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            if backend_root not in sys.path:
                sys.path.append(backend_root)
                
            from subtitle_core import SubtitleEngine
            
            # Initialize Engine (SubtitleEngine takes no constructor arguments)
            engine = SubtitleEngine()
            
            # Use ffmpeg path from settings if available
            ffmpeg_path = self.settings.ffmpeg_path
            
            # Run Transcription (using 'base' model by default for speed/accuracy balance)
            srt_content, error = engine.extract_subtitle(
                video_path, 
                model_name="base", 
                language="ko", # Target Korean for ViraLoop
                progress_callback=lambda msg, p=0: logger.info(f"Whisper: {msg}")
            )
            
            if error:
                logger.error(f"Whisper Transcription Error: {error}")
                return None
                
            if srt_content:
                logger.info(f"✅ Transcription successful! ({len(srt_content)} chars)")
                # Parse SRT to get plain text
                return self._parse_srt(srt_content)
                
            return None
            
        except Exception as e:
            logger.error(f"Audio transcription failed: {e}")
            return None
    
    def generate_metadata(
        self,
        video_path: str,
        platform: str = "youtube",
        subtitle_text: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Generate platform-optimized metadata using AI.
        
        Args:
            video_path: Path to video file
            platform: Target platform (youtube, tiktok, instagram)
            subtitle_text: Optional pre-extracted subtitle text
            
        Returns:
            Dictionary containing title, description, and hashtags
        """
        try:
            # Extract subtitles if not provided
            if not subtitle_text:
                subtitle_text = self.extract_subtitles(video_path)
            
            if not subtitle_text:
                logger.warning("No subtitle text available for metadata generation. Using filename as hint.")
                # Use the video filename as a minimal context hint for the AI
                filename = os.path.basename(video_path)
                filename_no_ext = os.path.splitext(filename)[0]
                subtitle_text = f"[영상 파일명: {filename_no_ext}] (자막 추출 실패 - 파일명 기반으로 메타데이터를 생성합니다)"
            
            # Truncate subtitle text if too long (max 8000 chars for context)
            if len(subtitle_text) > 8000:
                subtitle_text = subtitle_text[:8000] + "..."
            
            # Get AI model from settings
            model = self.settings.script_analysis_model or "opencode/deepseek-v4-flash-free"
            
            # Generate platform-specific metadata
            if platform.lower() == "youtube":
                return self._generate_youtube_metadata(subtitle_text, model)
            elif platform.lower() == "tiktok":
                return self._generate_tiktok_metadata(subtitle_text, model)
            elif platform.lower() == "instagram":
                return self._generate_instagram_metadata(subtitle_text, model)
            else:
                logger.warning(f"Unknown platform: {platform}, using YouTube defaults")
                return self._generate_youtube_metadata(subtitle_text, model)
                
        except Exception as e:
            logger.error(f"Metadata generation failed: {e}")
            return {
                "title": "",
                "description": "",
                "hashtags": []
            }
    
    def _generate_youtube_metadata(self, subtitle_text: str, model: str) -> Dict[str, any]:
        """Generate YouTube-optimized metadata"""
        
        prompt = f"""다음은 영상의 자막 내용입니다:

{subtitle_text}

위 자막을 분석하여 YouTube에 최적화된 메타데이터를 생성해주세요.

다음 형식으로 응답해주세요:
TITLE: [가장 클릭하고 싶은 60자 이내의 제목]
DESCRIPTION: [3줄 이내의 핵심 요약 설명]
HASHTAGS: [#Shorts #키워드1 #키워드2 ... #키워드6] (총 6~7개, #Shorts 필수 포함)
TAGS: [태그1, 태그2, 태그3, ...] (검색 의도를 파악한 문장형 태그 포함 15-20개)

요구사항:
1. [핵심] 제목 전략 (Viral Title Strategy):
   당신은 세계 최고의 유튜브 썸네일/제목 컨설턴트입니다. 다음 3가지 전략 중 가장 적절한 하나를 선택하여 제목을 지으세요.
   - 전략 A (Curiosity Gap): 정보의 공백을 만들어 호기심을 극대화 (예: "이걸 몰라서 99%가 실패합니다", "결국 밝혀진 충격적인 진실")
   - 전략 B (Negativity Bias): 손실이나 실수에 대한 두려움 자극 (예: "절대 하지 마세요", "당신이 가난한 이유")
   - 전략 C (Specific Benefit): 구체적인 숫자와 즉각적인 이득 제시 (예: "10분만에 100만원 버는 법", "3가지 비밀")
   * 절대 '평범한 요약' 금지.

2. 설명(Description) 최적화 - "3줄 요약":
   - 사용자가 '더보기'를 누르지 않아도 핵심이 보이도록 **최대 3줄**로 짧고 강렬하게 작성하세요.
   - 첫 줄에 가장 강력한 Hook을 배치하세요.

3. 해시태그 & 태그 전략:
   - HASHTAGS:
     - 총 6~7개를 작성하세요.
     - 1번은 무조건 #Shorts
     - 나머지는 대형 키워드(Mega)와 틈새 키워드(Niche)를 적절히 섞으세요.
   - TAGS:
     - 단순 명사 나열보다 '사용자가 실제로 검색창에 칠 법한 구문'을 포함하세요. (예: "시간여행 하는 법", "미래에서 온 사람")

[중요] 안전 가이드라인 준수 (Safety & Compliance):
유튜브 커뮤니티 가이드를 철저히 준수해야 합니다.
- 성적인 콘텐츠(Sexual Content) 금지
- 아동 안전(Child Safety) 준수
- 혐오 표현(Hate Speech) 금지
- 괴롭힘(Harassment) 금지
- 폭력성(Violent Content) 순화

만약 자막 내용이 위 가이드라인을 위반할 소지가 있다면, 이를 안전한 표현으로 순화하여 작성해주세요.
"""
        
        system_instruction = """당신은 YouTube MrBeast 팀의 메인 카피라이터입니다. 
클릭율(CTR)을 0.1%라도 올리기 위해 집요하게 고민하는 전문가입니다.
지루한 제목은 죄악입니다. 사람들의 본능(호기심, 공포, 욕망)을 자극하는 제목을 만드세요."""
        
        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=model,
                system_instruction=system_instruction
            )
            
            return self._parse_metadata_response(response, platform="youtube")
            
        except Exception as e:
            logger.error(f"YouTube metadata generation failed: {e}")
            return {"title": "", "description": "", "hashtags": []}
    
    def _generate_tiktok_metadata(self, subtitle_text: str, model: str) -> Dict[str, any]:
        """Generate TikTok-optimized metadata"""
        
        prompt = f"""다음은 영상의 자막 내용입니다:

{subtitle_text}

위 자막을 분석하여 TikTok에 최적화된 메타데이터를 생성해주세요.

다음 형식으로 응답해주세요:
TITLE: [짧고 임팩트 있는 제목, 30자 이내]
CAPTION: [150자 이내의 매력적인 캡션]
HASHTAGS: [#해시태그1 #해시태그2 ... 형식으로 10-15개]

요구사항:
1. 바이럴 임팩트:
   - 초반 3초 안에 시선을 끄는 강렬한 단어 선택
2. 참여 유도:
   - 댓글이나 공유를 부르는 질문형/행동유도형 캡션

[중요] 안전 가이드라인 준수 (Safety & Compliance):
TikTok 커뮤니티 가이드를 철저히 준수해야 합니다.
- 성적인 뉘앙스/노출 묘사 금지
- 위험한 챌린지/행동 조장 금지
- 혐오/차별/괴롭힘 표현 절대 금지
위반 소지가 있는 내용은 즉시 안전하고 긍정적인 방향으로 수정하세요.
"""
        
        system_instruction = """당신은 TikTok 바이럴 트렌드 세터이자 콘텐츠 안전 관리자입니다.
폭발적인 조회수를 유도하지만, 계정 정지 위험이 없는 안전하고 건전한 바이럴 콘텐츠를 기획합니다."""
        
        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=model,
                system_instruction=system_instruction
            )
            
            return self._parse_metadata_response(response, platform="tiktok")
            
        except Exception as e:
            logger.error(f"TikTok metadata generation failed: {e}")
            return {"title": "", "caption": "", "hashtags": []}
    
    def _generate_instagram_metadata(self, subtitle_text: str, model: str) -> Dict[str, any]:
        """Generate Instagram-optimized metadata"""
        
        prompt = f"""다음은 영상의 자막 내용입니다:

{subtitle_text}

위 자막을 분석하여 Instagram Reels에 최적화된 메타데이터를 생성해주세요.

다음 형식으로 응답해주세요:
TITLE: [짧고 매력적인 제목, 40자 이내]
CAPTION: [2200자 이내의 스토리텔링 캡션]
HASHTAGS: [#해시태그1 #해시태그2 ... 형식으로 20-30개]

요구사항:
1. 시각적/감성적 후킹:
   - 감성적이거나 트렌디한 어조 사용
2. 커뮤니티 연결:
   - 공감을 불러일으키는 스토리텔링

[중요] 안전 가이드라인 준수 (Safety & Compliance):
Instagram 커뮤니티 가이드를 철저히 준수해야 합니다.
- 성적 유혹/나체 묘사 엄격 금지
- 자해/섭식 장애 등 유해한 내용 미화 금지
- 따돌림/괴롭힘/혐오 표현 금지
모든 내용은 '전체 이용가' 수준으로 안전하게 작성되어야 합니다.
"""
        
        system_instruction = """당신은 Instagram 인플루언서 멘토이자 브랜드 안전 전문가입니다.
감각적이고 트렌디한 콘텐츠를 만들되, 브랜드 이미지를 해치지 않는 'Brand Safe'한 텍스트를 생성합니다."""
        
        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=model,
                system_instruction=system_instruction
            )
            
            return self._parse_metadata_response(response, platform="instagram")
            
        except Exception as e:
            logger.error(f"Instagram metadata generation failed: {e}")
            return {"title": "", "caption": "", "hashtags": []}
    
    def _parse_metadata_response(self, response: str, platform: str) -> Dict[str, any]:
        """
        Parse AI response into structured metadata.
        
        Args:
            response: AI-generated response text
            platform: Target platform
            
        Returns:
            Structured metadata dictionary
        """
        try:
            lines = response.strip().split('\n')
            metadata = {
                "title": "",
                "description": "" if platform == "youtube" else "caption",
                "hashtags": [],
                "tags": []
            }
            
            current_field = None
            content_buffer = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Check for field markers
                if line.startswith("TITLE:"):
                    if current_field and content_buffer:
                        self._save_field(metadata, current_field, content_buffer, platform)
                    current_field = "title"
                    content_buffer = [line.replace("TITLE:", "").strip()]
                    
                elif line.startswith("DESCRIPTION:") or line.startswith("CAPTION:"):
                    if current_field and content_buffer:
                        self._save_field(metadata, current_field, content_buffer, platform)
                    current_field = "description"
                    content = line.replace("DESCRIPTION:", "").replace("CAPTION:", "").strip()
                    content_buffer = [content] if content else []
                    
                elif line.startswith("HASHTAGS:"):
                    if current_field and content_buffer:
                        self._save_field(metadata, current_field, content_buffer, platform)
                    current_field = "hashtags"
                    content = line.replace("HASHTAGS:", "").strip()
                    content_buffer = [content] if content else []

                elif line.startswith("TAGS:"):
                    if current_field and content_buffer:
                        self._save_field(metadata, current_field, content_buffer, platform)
                    current_field = "tags"
                    content = line.replace("TAGS:", "").strip()
                    content_buffer = [content] if content else []
                    
                else:
                    # Continue current field
                    if current_field:
                        content_buffer.append(line)
            
            # Save last field
            if current_field and content_buffer:
                self._save_field(metadata, current_field, content_buffer, platform)
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to parse metadata response: {e}")
            return {
                "title": "",
                "description": "" if platform == "youtube" else "caption",
                "hashtags": []
            }
    
    def _save_field(self, metadata: dict, field: str, content: List[str], platform: str):
        """Save parsed field content to metadata dictionary"""
        
        content_text = ' '.join(content).strip()
        
        if field == "title":
            metadata["title"] = content_text
            
        elif field == "description":
            if platform == "youtube":
                metadata["description"] = content_text
            else:
                metadata["caption"] = content_text
                
        elif field == "hashtags":
            # Parse hashtags (Visible)
            hashtags = []
            parts = content_text.replace(',', ' ').replace('\n', ' ').split()
            for part in parts:
                part = part.strip()
                if not part: continue
                if part.startswith('#'):
                    hashtags.append(part)
                else:  # Add # if missing
                    hashtags.append(f"#{part}")
            metadata["hashtags"] = hashtags

        elif field == "tags":
            # Parse tags (Hidden Metadata)
            # Split by comma
            tags = [t.strip() for t in content_text.split(',')]
            # Remove empty and leading # if present (tags usually don't have #)
            cleaned_tags = []
            for t in tags:
                if not t: continue
                t = t.replace('#', '') # Remove # for metadata tags
                cleaned_tags.append(t)
            metadata["tags"] = cleaned_tags


def generate_video_metadata(
    db: Session,
    video_path: str,
    platform: str = "youtube"
) -> Dict[str, any]:
    """
    Convenience function to generate metadata for a video.
    
    Args:
        db: Database session
        video_path: Path to video file
        platform: Target platform
        
    Returns:
        Generated metadata dictionary
    """
    service = AIMetadataService(db)
    return service.generate_metadata(video_path, platform)
