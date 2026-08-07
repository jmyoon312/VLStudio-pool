"""
Enhanced Automation Utilities for Security Operations

Provides:
- Enhanced logging with screenshot capture on failure
- Improved retry logic with multiple selector strategies
- Error tracking and reporting
"""

import logging
import os
import time
import asyncio
import json
from datetime import datetime
from typing import Callable, Any, List, Optional, Dict
from pathlib import Path
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SelectorAttempt:
    """Record of a selector attempt"""
    selector: str
    strategy: str  # primary, fallback_1, fallback_2, etc.
    success: bool
    error: Optional[str] = None
    duration_ms: float = 0


@dataclass
class AutomationError:
    """Detailed error information"""
    error_type: str
    message: str
    selectors_tried: List[SelectorAttempt] = field(default_factory=list)
    screenshot_path: Optional[str] = None
    page_url: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class EnhancedSelector:
    """
    Enhanced selector with multiple fallback strategies and logging
    
    Usage:
        selector = EnhancedSelector(page)
        
        # Multiple strategies
        element = await selector.find(
            "settings-button",
            strategies=[
                {"type": "id", "value": "settings-button"},
                {"type": "xpath", "value": "//yt-icon-button[@id='settings-button']"},
                {"type": "aria", "value": "Settings"},
                {"type": "text", "value": "설정"}
            ]
        )
    """
    
    def __init__(self, page, screenshot_dir: str = "/tmp/automation_errors"):
        self.page = page
        self.screenshot_dir = screenshot_dir
        self.attempts: List[SelectorAttempt] = []
        self.max_attempts = 3
        
        # Ensure screenshot directory exists
        os.makedirs(screenshot_dir, exist_ok=True)
    
    def _take_screenshot(self, context: str = "error") -> str:
        """Take screenshot on error"""
        try:
            timestamp = int(time.time() * 1000)
            filename = f"screenshot_{context}_{timestamp}.png"
            filepath = os.path.join(self.screenshot_dir, filename)
            
            # Try to take screenshot
            if hasattr(self.page, 'screenshot'):
                self.page.screenshot(path=filepath)
                logger.info(f"📸 Screenshot saved: {filepath}")
                return filepath
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
        
        return None
    
    async def find(
        self,
        name: str,
        strategies: List[Dict[str, str]],
        timeout: int = 10000
    ) -> Optional[Any]:
        """
        Find element with multiple selector strategies
        
        Args:
            name: Element name for logging
            strategies: List of selector strategies to try
            timeout: Timeout in milliseconds
            
        Returns:
            Element if found, None otherwise
        """
        self.attempts = []
        
        for i, strategy in enumerate(strategies):
            selector_type = strategy.get("type", "unknown")
            selector_value = strategy.get("value", "")
            strategy_name = f"fallback_{i}" if i > 0 else "primary"
            
            start_time = time.time()
            
            try:
                element = await self._try_selector(selector_type, selector_value, timeout)
                duration_ms = (time.time() - start_time) * 1000
                
                # Record attempt
                attempt = SelectorAttempt(
                    selector=selector_value,
                    strategy=strategy_name,
                    success=True,
                    duration_ms=duration_ms
                )
                self.attempts.append(attempt)
                
                if element:
                    logger.info(f"[OK] Found {name} using {strategy_name}: {selector_value}")
                    return element
                    
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                
                # Record failed attempt
                attempt = SelectorAttempt(
                    selector=selector_value,
                    strategy=strategy_name,
                    success=False,
                    error=str(e),
                    duration_ms=duration_ms
                )
                self.attempts.append(attempt)
                
                logger.warning(f"[FAIL] {name} not found with {strategy_name}: {selector_value} - {e}")
        
        # All strategies failed - take screenshot
        screenshot_path = self._take_screenshot(name.replace(" ", "_"))
        
        # Log error details
        error_info = AutomationError(
            error_type="SELECTOR_NOT_FOUND",
            message=f"Could not find {name} after {len(strategies)} attempts",
            selectors_tried=self.attempts,
            screenshot_path=screenshot_path,
            page_url=self.page.url if hasattr(self.page, 'url') else None
        )
        
        logger.error(f"[FAIL] Automation error: {error_info}")
        
        return None
    
    async def _try_selector(self, selector_type: str, value: str, timeout: int) -> Any:
        """Try a specific selector type"""
        
        if selector_type == "id":
            return self.page.ele(f'@{value}', timeout=timeout/1000)
        
        elif selector_type == "xpath":
            return self.page.ele(f'xpath://{value}', timeout=timeout/1000)
        
        elif selector_type == "aria":
            return self.page.ele(f'@aria-label:{value}', timeout=timeout/1000)
        
        elif selector_type == "text":
            return self.page.ele(f'@@text:{value}', timeout=timeout/1000)
        
        elif selector_type == "css":
            return self.page.ele(value, timeout=timeout/1000)
        
        else:
            raise ValueError(f"Unknown selector type: {selector_type}")
    
    async def safe_click_with_logging(self, element, context: str) -> bool:
        """Click element with enhanced logging"""
        try:
            element.click()
            logger.info(f"[OK] Clicked: {context}")
            return True
        except Exception as e:
            screenshot = self._take_screenshot(f"click_failed_{context}")
            
            logger.error(f"[FAIL] Click failed: {context} - {e}")
            logger.error(f"📸 Screenshot: {screenshot}")
            
            raise
    
    async def safe_type_with_logging(self, element, text: str, context: str) -> bool:
        """Type text with enhanced logging"""
        try:
            element.input(text)
            logger.info(f"[OK] Typed: {context} - '{text[:20]}...'")
            return True
        except Exception as e:
            screenshot = self._take_screenshot(f"type_failed_{context}")
            
            logger.error(f"[FAIL] Type failed: {context} - {e}")
            logger.error(f"📸 Screenshot: {screenshot}")
            
            raise


class RetryHandler:
    """
    Improved retry handler with exponential backoff, jitter, and circuit breaker
    
    Features:
    - Exponential backoff with jitter
    - Circuit breaker for failing operations
    - Per-operation type retry configuration
    - Retry budget system
    
    Usage:
        retry = RetryHandler(max_retries=3, base_delay=2)
        
        async def operation():
            return await retry.execute(my_function, arg1, arg2)
    """
    
    def __init__(self, max_retries: int = 3, base_delay: float = 2.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.attempt_history: List[Dict] = []
        
        # Circuit breaker state
        self._failure_count = 0
        self._circuit_open_time = None
        self._circuit_timeout = 60  # seconds
        self._failure_threshold = 5  # Open circuit after this many failures
        
        # Retry budget
        self._budget_remaining = 100
        self._budget_per_operation = 10
    
    def _calculate_delay(self, attempt: int, jitter: bool = True) -> float:
        """Calculate delay with optional jitter"""
        delay = self.base_delay * (2 ** attempt)
        
        if jitter:
            import random
            # Add random jitter (0.5x to 1.5x)
            jitter_factor = 0.5 + random.random()
            delay *= jitter_factor
        
        return delay
    
    def _check_circuit_breaker(self, operation_name: str) -> bool:
        """Check if circuit breaker allows operation"""
        if self._circuit_open_time is None:
            return True
        
        # Check if circuit should close
        elapsed = time.time() - self._circuit_open_time
        if elapsed > self._circuit_timeout:
            logger.info(f"[REFRESH] Circuit breaker reset for {operation_name}")
            self._circuit_open_time = None
            self._failure_count = 0
            return True
        
        logger.warning(f"[WARN] Circuit breaker OPEN for {operation_name}. Retry after {self._circuit_timeout - elapsed:.0f}s")
        return False
    
    def _record_failure(self):
        """Record failure for circuit breaker"""
        self._failure_count += 1
        
        if self._failure_count >= self._failure_threshold:
            self._circuit_open_time = time.time()
            logger.error(f"🔴 Circuit breaker OPENED after {self._failure_count} failures")
    
    async def execute(
        self,
        func: Callable,
        *args,
        operation_name: str = "operation",
        operation_type: str = "default",
        **kwargs
    ) -> Any:
        """
        Execute function with retry logic
        
        Args:
            func: Async function to execute
            *args: Positional arguments for func
            operation_name: Name for logging
            operation_type: Type for retry budget tracking
            **kwargs: Keyword arguments for func
            
        Returns:
            Result of func
            
        Raises:
            Last exception if all retries fail
        """
        last_exception = None
        
        # Check circuit breaker
        if not self._check_circuit_breaker(operation_name):
            raise Exception(f"Circuit breaker open for {operation_name}")
        
        # Check retry budget
        if self._budget_remaining < self._budget_per_operation:
            logger.warning(f"[WARN] Retry budget exhausted for {operation_name}")
            raise Exception(f"Retry budget exhausted for {operation_name}")
        
        for attempt in range(self.max_retries):
            try:
                result = await func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"[OK] {operation_name} succeeded on attempt {attempt + 1}")
                
                # Record success
                self.attempt_history.append({
                    "operation": operation_name,
                    "operation_type": operation_type,
                    "attempt": attempt + 1,
                    "success": True,
                    "error": None
                })
                
                # Reset circuit breaker on success
                self._failure_count = 0
                
                return result
                
            except Exception as e:
                last_exception = e
                
                # Record failure
                self.attempt_history.append({
                    "operation": operation_name,
                    "operation_type": operation_type,
                    "attempt": attempt + 1,
                    "success": False,
                    "error": str(e)
                })
                
                # Update circuit breaker
                self._record_failure()
                
                # Deduct budget
                self._budget_remaining -= 1
                
                if attempt < self.max_retries - 1:
                    # Calculate delay with exponential backoff + jitter
                    delay = self._calculate_delay(attempt)
                    logger.warning(f"[WARN] {operation_name} failed (attempt {attempt + 1}/{self.max_retries}): {e}")
                    logger.info(f"[WAIT] Retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"[FAIL] {operation_name} failed after {self.max_retries} attempts: {e}")
        
        # All retries failed
        raise last_exception
    
    def get_history(self) -> List[Dict]:
        """Get retry history"""
        return self.attempt_history
    
    def get_stats(self) -> Dict:
        """Get retry statistics"""
        total = len(self.attempt_history)
        success = sum(1 for h in self.attempt_history if h["success"])
        failed = total - success
        
        return {
            "total_attempts": total,
            "successes": success,
            "failures": failed,
            "success_rate": success / total if total > 0 else 0,
            "budget_remaining": self._budget_remaining,
            "circuit_open": self._circuit_open_time is not None
        }
    
    def reset_budget(self, amount: int = 100):
        """Reset retry budget"""
        self._budget_remaining = amount
        logger.info(f"[REFRESH] Retry budget reset to {amount}")


def create_enhanced_selector(page) -> EnhancedSelector:
    """Factory function to create enhanced selector"""
    return EnhancedSelector(page)


def create_retry_handler(max_retries: int = 3, base_delay: float = 2.0) -> RetryHandler:
    """Factory function to create retry handler"""
    return RetryHandler(max_retries, base_delay)