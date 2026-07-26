from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import database, crud

from ..llm_manager import LLMClient
import logging
import json
import os

router = APIRouter(tags=["agent"])
logger = logging.getLogger(__name__)

class CommandRequest(BaseModel):
    command: str
    context: dict = {} # Current editor state (optional)
    provider: str = "cerebras"
    model: str = "cerebras/llama3.1-8b"

class Action(BaseModel):
    type: str
    params: dict = {}

class AgentResponse(BaseModel):
    actions: list[Action]
    message: str

# --- Tool Definitions ---
# We define tools for Gemini to "call".
# In reality, we just want the structured output.

def get_editor_tools():
    return [
        {
            "name": "remove_silence",
            "description": "Remove silent parts from the video.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "threshold": {"type": "NUMBER", "description": "Silence threshold in dB (e.g. -30). Default -30."}
                }
            }
        },
        {
            "name": "add_text",
            "description": "Add a text overlay or subtitle.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "content": {"type": "STRING", "description": "The text content to display."},
                    "style": {"type": "STRING", "description": "Style preset (e.g. 'title', 'subtitle', 'caption')."}
                },
                "required": ["content"]
            }
        },
        {
            "name": "add_music",
            "description": "Add background music.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "genre": {"type": "STRING", "description": "Genre or mood of the music (e.g. 'happy', 'cinematic')."}
                },
                "required": ["genre"]
            }
        },
        {
            "name": "cut_clip",
            "description": "Cut or trim the video.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER", "description": "Start time in seconds."},
                    "end": {"type": "NUMBER", "description": "End time in seconds."}
                }
            }
        },
        {
            "name": "apply_filter",
            "description": "Apply a visual filter or color grading.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filter_type": {"type": "STRING", "description": "Type of filter (e.g. 'bw', 'vintage', 'bright')."}
                },
                "required": ["filter_type"]
            }
        }
    ]

@router.post("/command", response_model=AgentResponse)
def process_command(req: CommandRequest, db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    
    # Use brain_router to get the LangChain model
    try:
        # Determine Provider and Model Name
        target_provider = req.provider
        target_model = req.model
        
        # If model is default/auto/empty, use Settings hermes_agent_provider and hermes_agent_model
        if not target_model or target_model in ["auto", "cerebras/llama3.1-8b"]:
            target_provider = settings.hermes_agent_provider or "nvidia"
            target_model = settings.hermes_agent_model or "llama-3.3-70b-versatile"
            
        # Parse double prefixes
        if "/" in target_model:
            target_provider, clean_model = target_model.split("/", 1)
        else:
            clean_model = target_model

        # Ensure correct prefixing if needed (e.g. for custom openrouter)
        if target_provider == "openrouter" and not clean_model.startswith("openrouter/"):
             clean_model = f"openrouter/{clean_model}"
        elif target_provider == "groq" and not clean_model.startswith("groq/"):
             clean_model = f"groq/{clean_model}"
        elif target_provider == "cerebras" and not clean_model.startswith("cerebras/"):
             clean_model = f"cerebras/{clean_model}"

        logger.info(f"🤖 [Loopie] Routing command request via LangChain brain_router: {target_provider}/{clean_model}")
               # Use Korean system prompt for general chat via Loopie
        current_path = req.context.get("currentPath", "")
        system_instruction = (
            "당신은 'ViraLoop Elite' 시스템의 핵심 전략 에이전트, '루피'입니다. "
            "단순한 편집 보조를 넘어, 상업적 성공과 시청자 전환율(Conversion)을 극대화하는 '엘리트 커머셜 비디오 전략가'로서 행동하십시오. "
            "지휘관(사용자)의 명령을 수행할 때 항상 다음을 고려하십시오:\n"
            "1. 첫 3초(Hook)의 강렬함과 시각적 충격력.\n"
            "2. 정보 전달의 효율성과 텍스트 가독성.\n"
            "3. 최신 바이럴 트렌드에 기반한 구도 및 스타일 제안.\n\n"
            "**[절대 규칙 1]: 어떤 상황에서도 반드시 100% '한국어'로만 대답하세요.** 영어나 다른 언어는 단 한 단어도 사용하지 마세요. "
            "불가피하게 고유명사나 IT 용어를 써야 할 경우 반드시 '소리나는 대로 한글로' 작성하세요. (예: ViraLoop -> 바이럴루프) "
            "**[절대 규칙 2]: 사용자의 명령을 분석하여 실제 시스템 제어 액션을 JSON 형태로 반환해야 합니다.** "
            "순수 JSON 문자열만 출력하세요 (마크다운 불가).\n"
            "형식: {\"actions\": [{\"type\": \"액션명\", \"params\": {\"키\": \"값\"}}], \"message\": \"음성으로 보고할 한국어 대사\"}\n"
            "사용 가능한 액션:\n"
            "1. navigate: 특정 화면으로 이동. params: {\"path\": \"/channels, /insights, /swarm-hub, /settings 중 하나\"}. 존재하지 않는 경로는 절대 만들지 마세요.\n"
            "2. delegate_to_openclaw: 영상 제작/레퍼런스 분석 등 복합 임무를 OpenClaw 워커에 하달. params: {\"mission_type\": \"analyze_channels 등\", \"context\": \"상세 내용\"}\n"
            "사용자가 시스템의 실제 작동 여부를 의심할 경우, '스웜 허브(Swarm Hub)'에서 실시간 에이전트 로그와 세션 상태를 확인할 수 있다고 안내하고 /swarm-hub 로 이동시키세요.\n"
            f"현재 사용자가 보고 있는 페이지: {current_path}."
        )
        
        # [STRATEGIC CONTEXT] Inject video metadata if available
        video_title = req.context.get("videoTitle")
        transcript = req.context.get("transcript")
        
        prompt = req.command
        if video_title or transcript:
            prompt = (
                f"[현재 분석 중인 영상 데이터]\n"
                f"제목: {video_title or '제목 없음'}\n"
                f"대본 내용: {transcript or '대본 없음'}\n\n"
                f"명령: {req.command}"
            )

        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=prompt)
        ]
        
        from app.agent.brain_router import brain_router
        
        # Collect API keys for rotation
        keys = []
        if target_provider == "groq":
            if settings.groq_api_keys:
                keys = [k for k in settings.groq_api_keys if k]
            elif hasattr(settings, "groq_api_key") and settings.groq_api_key:
                keys = [settings.groq_api_key]
        elif target_provider in ["google", "gemini"]:
            if settings.gemini_api_keys:
                keys = [k for k in settings.gemini_api_keys if k]
                
        if not keys:
            keys = [None] # fallback to env variables

        llm = None
        response_text = None
        primary_err = None
        
        for i, api_key in enumerate(keys):
            try:
                llm = brain_router._create_langchain_model(target_provider, clean_model, settings, api_key=api_key)
                if not llm:
                    raise ValueError(f"Failed to initialize LangChain model for '{target_provider}/{clean_model}'")
                
                logger.info(f"🤖 [Loopie] Routing command request via LangChain brain_router: {target_provider}/{clean_model} (Key #{i})")
                response = llm.invoke(messages)
                response_text = response.content
                primary_err = None # Clear error on success
                break
            except Exception as e:
                primary_err = e
                logger.warning(f"⏳ [Loopie] Key #{i} failed with error: {e}. Rotating keys...")
                continue

        if primary_err:
            logger.warning(f"⚠️ Primary agent model ({target_provider}/{clean_model}) failed on all keys: {primary_err}. Falling back to Gemini...")
            try:
                fallback_llm = brain_router._create_langchain_model("google", "gemini-2.0-flash", settings)
                if not fallback_llm:
                    raise ValueError("Failed to initialize fallback Gemini model.")
                response = fallback_llm.invoke(messages)
                response_text = response.content
            except Exception as fallback_err:
                logger.error(f"❌ Fallback Gemini model also failed: {fallback_err}")
                raise Exception(f"Primary error: {primary_err}. Fallback error: {fallback_err}")
        
        # Try to parse as JSON first; otherwise treat as plain chat reply
        if isinstance(response_text, str):
            cleaned = response_text.replace("```json", "").replace("```", "").strip()
            try:
                data = json.loads(cleaned)
                return AgentResponse(actions=data.get("actions", []), message=data.get("message", cleaned))
            except json.JSONDecodeError:
                # Plain chat response - just return as message
                return AgentResponse(actions=[], message=cleaned)
            
        return AgentResponse(actions=[], message="응답을 처리하는 중 오류가 발생했습니다.")

    except Exception as e:
        logger.error(f"Agent Error: {e}")
        return AgentResponse(actions=[], message=f"Error: {str(e)}")
