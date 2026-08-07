"""
Upload Priority Service

Manages upload method priority and fallback logic:
1. YouTube API (default, fastest)
2. Browser Automation (fallback when API fails)
3. Manual (last resort)

Also provides error handling and retry logic for uploads.
"""

import logging
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class UploadMethod(Enum):
    """Upload method types"""
    API = "API"
    BROWSER_AUTO = "BROWSER_AUTO"
    MANUAL = "MANUAL"


class UploadPriority(Enum):
    """Upload priority levels"""
    HIGH = 1      # API preferred
    MEDIUM = 2    # Browser automation
    LOW = 3       # Manual upload


@dataclass
class UploadAttempt:
    """Record of an upload attempt"""
    method: UploadMethod
    success: bool
    error: Optional[str] = None
    duration_seconds: float = 0.0


class UploadPriorityManager:
    """
    Manages upload priority and fallback logic
    
    Usage:
        manager = UploadPriorityManager()
        
        # Get preferred method
        method = manager.get_preferred_method(channel_id, video_type)
        
        # Handle fallback on failure
        fallback_method = manager.get_fallback_method(current_method, error)
        
        # Check if should switch to manual
        if manager.should_escalate_to_manual(error_history):
            # Notify admin
            pass
    """
    
    def __init__(self):
        # Priority configuration per channel/video type
        self._priority_config: Dict[str, Dict[str, Any]] = {}
        
        # Error tracking
        self._error_history: Dict[int, List[Dict]] = {}  # channel_id -> errors
        self._consecutive_failures: Dict[int, int] = {}
        
        # Thresholds
        self.max_consecutive_failures = 3
        self.fallback_delay_seconds = 30
    
    def configure_channel(
        self,
        channel_id: int,
        preferred_method: UploadMethod = UploadMethod.API,
        fallback_enabled: bool = True,
        browser_profile_id: Optional[int] = None
    ):
        """Configure upload priority for a channel"""
        self._priority_config[channel_id] = {
            "preferred": preferred_method,
            "fallback_enabled": fallback_enabled,
            "browser_profile_id": browser_profile_id
        }
        logger.info(f"📤 Upload priority configured for channel {channel_id}: {preferred_method.value}")
    
    def get_preferred_method(
        self,
        channel_id: int,
        video_type: str = "standard"
    ) -> UploadMethod:
        """
        Get preferred upload method for channel
        
        Args:
            channel_id: YouTube channel ID
            video_type: Type of video (shorts, live, standard)
            
        Returns:
            Preferred UploadMethod
        """
        config = self._priority_config.get(channel_id, {})
        
        # Check for consecutive failures - if too many, use browser
        if self._consecutive_failures.get(channel_id, 0) >= self.max_consecutive_failures:
            logger.warning(f"[WARN] Channel {channel_id} has {self._consecutive_failures[channel_id]} consecutive failures, switching to browser")
            return UploadMethod.BROWSER_AUTO
        
        # Check video type
        if video_type == "shorts":
            # Shorts often work better with browser (faster upload)
            config = self._priority_config.get(channel_id, {})
            if config.get("preferred") == UploadMethod.API:
                logger.info("📤 Using API for Shorts (can be slow, consider browser)")
        
        # Return configured preference or default to API
        return config.get("preferred", UploadMethod.API)
    
    def get_fallback_method(
        self,
        current_method: UploadMethod,
        error: Exception
    ) -> Optional[UploadMethod]:
        """
        Get fallback method when current method fails
        
        Args:
            current_method: The method that failed
            error: The exception that occurred
            
        Returns:
            Fallback method or None if should not retry
        """
        error_str = str(error).lower()
        
        # API-specific errors that should fall back to browser
        api_errors = [
            "quota",
            "rate limit",
            "authentication",
            "unauthorized",
            "not found",
            "bad request"
        ]
        
        if current_method == UploadMethod.API:
            # Check if error is retryable
            if any(e in error_str for e in api_errors):
                logger.warning(f"📤 API failed with retryable error: {error}. Falling back to browser.")
                return UploadMethod.BROWSER_AUTO
            
            # Check for non-retryable errors
            non_retryable = ["video not found", "invalid video"]
            if any(e in error_str for e in non_retryable):
                logger.error(f"[FAIL] API error is not retryable: {error}")
                return None
        
        elif current_method == UploadMethod.BROWSER_AUTO:
            # Browser failed - escalate to manual
            logger.error(f"[FAIL] Browser automation failed: {error}. Escalating to manual.")
            return UploadMethod.MANUAL
        
        return None
    
    def record_attempt(
        self,
        channel_id: int,
        method: UploadMethod,
        success: bool,
        error: Optional[str] = None
    ):
        """Record an upload attempt for analytics"""
        # Initialize if needed
        if channel_id not in self._error_history:
            self._error_history[channel_id] = []
        
        # Add to history
        self._error_history[channel_id].append({
            "method": method.value,
            "success": success,
            "error": error,
            "timestamp": __import__("datetime").datetime.now().isoformat()
        })
        
        # Keep only last 10 attempts
        if len(self._error_history[channel_id]) > 10:
            self._error_history[channel_id] = self._error_history[channel_id][-10:]
        
        # Update consecutive failures
        if success:
            self._consecutive_failures[channel_id] = 0
        else:
            self._consecutive_failures[channel_id] = self._consecutive_failures.get(channel_id, 0) + 1
        
        logger.info(f"[CHART] Upload attempt recorded: channel={channel_id}, method={method.value}, success={success}")
    
    def should_escalate_to_manual(self, channel_id: int) -> bool:
        """
        Check if should escalate to manual upload
        
        Args:
            channel_id: Channel ID to check
            
        Returns:
            True if should notify for manual upload
        """
        failures = self._consecutive_failures.get(channel_id, 0)
        history = self._error_history.get(channel_id, [])
        
        # Check if too many consecutive failures
        if failures >= self.max_consecutive_failures:
            return True
        
        # Check recent history - if all failed in last 5 attempts
        recent = history[-5:] if len(history) >= 5 else history
        if len(recent) >= 5 and all(not r["success"] for r in recent):
            return True
        
        return False
    
    def get_upload_stats(self, channel_id: int) -> Dict[str, Any]:
        """Get upload statistics for channel"""
        history = self._error_history.get(channel_id, [])
        
        total = len(history)
        successes = sum(1 for h in history if h["success"])
        
        # Group by method
        by_method = {}
        for h in history:
            method = h["method"]
            if method not in by_method:
                by_method[method] = {"total": 0, "success": 0}
            by_method[method]["total"] += 1
            if h["success"]:
                by_method[method]["success"] += 1
        
        return {
            "channel_id": channel_id,
            "total_attempts": total,
            "successes": successes,
            "success_rate": successes / total if total > 0 else 0,
            "consecutive_failures": self._consecutive_failures.get(channel_id, 0),
            "by_method": by_method,
            "should_escalate": self.should_escalate_to_manual(channel_id)
        }
    
    def reset_failures(self, channel_id: int):
        """Reset failure count after successful upload"""
        self._consecutive_failures[channel_id] = 0
        logger.info(f"[REFRESH] Failure count reset for channel {channel_id}")
    
    def get_recommended_method_for_error(self, error: Exception) -> UploadMethod:
        """
        Get recommended upload method based on error type
        
        This helps diagnose which method to try next based on error patterns.
        """
        error_str = str(error).lower()
        
        # Quota/rate limit -> Browser (different IP/rate limit)
        if "quota" in error_str or "rate limit" in error_str:
            logger.info("📤 Quota/rate limit detected - recommending browser automation")
            return UploadMethod.BROWSER_AUTO
        
        # Auth issues -> Check credentials, maybe browser
        if "auth" in error_str or "token" in error_str:
            logger.warning("📤 Auth error detected - may need browser with fresh cookies")
            return UploadMethod.BROWSER_AUTO
        
        # Network errors -> Try same method again
        if "network" in error_str or "connection" in error_str:
            logger.warning("📤 Network error - retry with same method")
            return UploadMethod.API
        
        # Unknown -> Default to API
        return UploadMethod.API


# Global singleton
_upload_priority_manager = None

def get_upload_priority_manager() -> UploadPriorityManager:
    """Get global UploadPriorityManager instance"""
    global _upload_priority_manager
    if _upload_priority_manager is None:
        _upload_priority_manager = UploadPriorityManager()
    return _upload_priority_manager