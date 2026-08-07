import logging
import httpx
import asyncio
from typing import Optional
from app.schemas.bridge_config import BridgeConfig # Example for getting config

logger = logging.getLogger(__name__)

class TelegramNotifier:
    """
    ViraLoop 통합 알림 서비스
    - 승인 대기 (HITL) 알림
    - 시스템 에러 및 보안 경고 (IP 갱신 실패 등)
    - 업로드 완료 보고
    """
    
    def __init__(self, token: Optional[str] = None, chat_id: Optional[str] = None):
        # 실제 운영시 환경 변수나 DB 설정에서 로드
        self.token = token or "YOUR_BOT_TOKEN" 
        self.chat_id = chat_id or "YOUR_CHAT_ID"
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage"

    async def send_message(self, text: str):
        if not self.token or "YOUR_BOT_TOKEN" in self.token:
            logger.warning("[WARN] Telegram Token이 설정되지 않아 알림을 보낼 수 없습니다.")
            return False
            
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": "HTML"
                }
                response = await client.post(self.api_url, json=payload)
                if response.status_code == 200:
                    logger.info("[OK] 텔레그램 알림 발송 성공")
                    return True
                else:
                    logger.error(f"[FAIL] 텔레그램 발송 실패: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"[FAIL] 텔레그램 알림 중 에러 발생: {e}")
            return False

    async def notify_approval_required(self, mission_id: str, node_label: str):
        """승인 대기 알림 발송"""
        msg = (
            f"[FALLBACK] <b>ViraLoop 승인 요청</b>\n\n"
            f"📍 <b>미션:</b> {mission_id}\n"
            f"🚧 <b>단계:</b> {node_label}\n\n"
            f"에이전트가 작업을 준비했습니다. 대시보드에서 검토 후 <b>승인</b>해주세요!"
        )
        return await self.send_message(msg)

    async def notify_security_alert(self, message: str):
        """보안 알림 (IP 갱신 실패 등)"""
        msg = f"🛡️ <b>보안 경고 (ViraLoop)</b>\n\n{message}"
        return await self.send_message(msg)

telegram_notifier = TelegramNotifier()
