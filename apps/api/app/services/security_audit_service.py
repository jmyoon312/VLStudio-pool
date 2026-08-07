"""
Security and Audit Service

Provides:
1. Security event logging
2. Audit trail
3. Threat detection
4. Access control
5. Compliance reporting

Usage:
    security = SecurityService()
    
    # Log security event
    await security.log_event(
        event_type="LOGIN_FAILED",
        severity="warning",
        user_id=123,
        details={"ip": "1.2.3.4", "reason": "wrong password"}
    )
    
    # Get audit trail
    audit = await security.get_audit_trail(
        user_id=123,
        start_date=datetime.now() - timedelta(days=7)
    )
"""

import os
import asyncio
import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class SecurityEventType(Enum):
    """Security event types"""
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    LOGOUT_FAILED = "logout_failed"
    ACCESS_DENIED = "access_denied"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    CONFIGURATION_CHANGE = "configuration_change"
    API_REQUEST = "api_request"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class SecuritySeverity(Enum):
    """Security severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ThreatLevel(Enum):
    """Threat levels"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityEvent:
    """Security event"""
    event_id: str
    event_type: SecurityEventType
    severity: SecuritySeverity
    user_id: Optional[int]
    username: Optional[str]
    ip_address: str
    user_agent: str
    resource: str
    action: str
    details: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    threat_level: ThreatLevel = ThreatLevel.NONE


@dataclass
class AuditEntry:
    """Audit trail entry"""
    entry_id: str
    user_id: int
    username: str
    action: str
    resource: str
    result: str  # success, failure
    ip_address: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)


class SecurityService:
    """
    Security and Audit Service
    
    Features:
    - Security event logging
    - Audit trail management
    - Threat detection
    - Access control
    - Compliance reporting
    """
    
    def __init__(self):
        self._events: List[SecurityEvent] = []
        self._audit_entries: List[AuditEntry] = []
        self._max_events = 100000
        self._max_audit_entries = 100000
        
        # Threat detection rules
        self._threat_rules = self._init_threat_rules()
        
        # IP blocking
        self._blocked_ips: Dict[str, datetime] = {}
        self._failed_login_attempts: Dict[str, List[datetime]] = defaultdict(list)
        
        logger.info("SecurityService initialized")
    
    def _init_threat_rules(self) -> Dict[str, Any]:
        """Initialize threat detection rules"""
        return {
            "failed_logins_threshold": 5,
            "failed_logins_window": 300,  # 5 minutes
            "suspicious_ips": [],  # List of known suspicious IPs
            "rate_limit_threshold": 100,
            "rate_limit_window": 60
        }
    
    async def log_event(
        self,
        event_type: SecurityEventType,
        severity: SecuritySeverity,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        ip_address: str = "",
        user_agent: str = "",
        resource: str = "",
        action: str = "",
        details: Dict[str, Any] = None
    ) -> str:
        """
        Log security event
        
        Returns:
            Event ID
        """
        import uuid
        
        event_id = f"sec_{uuid.uuid4().hex[:12]}"
        
        # Detect threat level
        threat_level = self._detect_threat(
            event_type, ip_address, details or {}
        )
        
        event = SecurityEvent(
            event_id=event_id,
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            resource=resource,
            action=action,
            details=details or {},
            threat_level=threat_level
        )
        
        self._events.append(event)
        
        # Enforce max size
        if len(self._events) > self._max_events:
            self._events = self._events[-self._max_events:]
        
        # Log based on severity
        log_msg = f"[{severity.value.upper()}] {event_type.value}: {action} on {resource}"
        
        if severity == SecuritySeverity.CRITICAL or threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
            logger.critical(log_msg)
        elif severity == SecuritySeverity.ERROR:
            logger.error(log_msg)
        elif severity == SecuritySeverity.WARNING:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
        
        # Check if should block IP
        if event_type == SecurityEventType.LOGIN_FAILED:
            await self._check_failed_login(ip_address)
        
        return event_id
    
    def _detect_threat(
        self,
        event_type: SecurityEventType,
        ip_address: str,
        details: Dict[str, Any]
    ) -> ThreatLevel:
        """Detect threat level"""
        # Check blocked IPs
        if ip_address in self._blocked_ips:
            return ThreatLevel.CRITICAL
        
        # Check suspicious IPs
        if ip_address in self._threat_rules["suspicious_ips"]:
            return ThreatLevel.HIGH
        
        # Check for suspicious activity patterns
        if event_type == SecurityEventType.SUSPICIOUS_ACTIVITY:
            return ThreatLevel.MEDIUM
        
        if event_type == SecurityEventType.RATE_LIMIT_EXCEEDED:
            return ThreatLevel.MEDIUM
        
        if event_type == SecurityEventType.ACCESS_DENIED:
            return ThreatLevel.LOW
        
        return ThreatLevel.NONE
    
    async def _check_failed_login(self, ip_address: str):
        """Check and handle failed login attempts"""
        now = datetime.now()
        cutoff = now - timedelta(
            seconds=self._threat_rules["failed_logins_window"]
        )
        
        # Clean old attempts
        self._failed_login_attempts[ip_address] = [
            t for t in self._failed_login_attempts[ip_address]
            if t > cutoff
        ]
        
        # Add current attempt
        self._failed_login_attempts[ip_address].append(now)
        
        # Check threshold
        if len(self._failed_login_attempts[ip_address]) >= \
           self._threat_rules["failed_logins_threshold"]:
            
            # Block IP
            self._blocked_ips[ip_address] = now
            
            await self.log_event(
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity=SecuritySeverity.CRITICAL,
                ip_address=ip_address,
                action="BLOCK_IP",
                details={"reason": "Too many failed login attempts"}
            )
            
            logger.warning(f"🚫 IP blocked due to failed logins: {ip_address}")
    
    def is_ip_blocked(self, ip_address: str) -> bool:
        """Check if IP is blocked"""
        if ip_address not in self._blocked_ips:
            return False
        
        # Check if block expired (24 hours)
        blocked_time = self._blocked_ips[ip_address]
        if datetime.now() - blocked_time > timedelta(hours=24):
            del self._blocked_ips[ip_address]
            return False
        
        return True
    
    def block_ip(self, ip_address: str, reason: str = ""):
        """Manually block IP"""
        self._blocked_ips[ip_address] = datetime.now()
        
        logger.warning(f"🚫 IP manually blocked: {ip_address} - {reason}")
    
    def unblock_ip(self, ip_address: str) -> bool:
        """Unblock IP"""
        if ip_address in self._blocked_ips:
            del self._blocked_ips[ip_address]
            logger.info(f"[OK] IP unblocked: {ip_address}")
            return True
        return False
    
    async def log_audit(
        self,
        user_id: int,
        username: str,
        action: str,
        resource: str,
        result: str,
        ip_address: str,
        details: Dict[str, Any] = None
    ):
        """Log audit entry"""
        import uuid
        
        entry = AuditEntry(
            entry_id=f"audit_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            username=username,
            action=action,
            resource=resource,
            result=result,
            ip_address=ip_address,
            details=details or {}
        )
        
        self._audit_entries.append(entry)
        
        # Enforce max size
        if len(self._audit_entries) > self._max_audit_entries:
            self._audit_entries = self._audit_entries[-self._max_audit_entries:]
    
    async def get_audit_trail(
        self,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        action: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get audit trail"""
        entries = self._audit_entries
        
        if user_id:
            entries = [e for e in entries if e.user_id == user_id]
        
        if start_date:
            entries = [e for e in entries if e.timestamp >= start_date]
        
        if end_date:
            entries = [e for e in entries if e.timestamp <= end_date]
        
        if action:
            entries = [e for e in entries if e.action == action]
        
        # Sort by timestamp descending
        entries = sorted(entries, key=lambda x: x.timestamp, reverse=True)
        
        return [
            {
                "entry_id": e.entry_id,
                "user_id": e.user_id,
                "username": e.username,
                "action": e.action,
                "resource": e.resource,
                "result": e.result,
                "ip_address": e.ip_address,
                "timestamp": e.timestamp.isoformat(),
                "details": e.details
            }
            for e in entries[:limit]
        ]
    
    def get_security_events(
        self,
        severity: Optional[SecuritySeverity] = None,
        threat_level: Optional[ThreatLevel] = None,
        start_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get security events"""
        events = self._events
        
        if severity:
            events = [e for e in events if e.severity == severity]
        
        if threat_level:
            events = [e for e in events if e.threat_level == threat_level]
        
        if start_date:
            events = [e for e in events if e.timestamp >= start_date]
        
        events = sorted(events, key=lambda x: x.timestamp, reverse=True)
        
        return [
            {
                "event_id": e.event_id,
                "event_type": e.event_type.value,
                "severity": e.severity.value,
                "user_id": e.user_id,
                "username": e.username,
                "ip_address": e.ip_address,
                "resource": e.resource,
                "action": e.action,
                "threat_level": e.threat_level.value,
                "timestamp": e.timestamp.isoformat(),
                "details": e.details
            }
            for e in events[:limit]
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get security statistics"""
        total_events = len(self._events)
        
        by_severity = defaultdict(int)
        by_threat = defaultdict(int)
        
        for event in self._events:
            by_severity[event.severity.value] += 1
            by_threat[event.threat_level.value] += 1
        
        return {
            "total_events": total_events,
            "by_severity": dict(by_severity),
            "by_threat_level": dict(by_threat),
            "blocked_ips": len(self._blocked_ips),
            "total_audit_entries": len(self._audit_entries)
        }
    
    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate compliance report"""
        
        # Filter events in date range
        events = [
            e for e in self._events
            if start_date <= e.timestamp <= end_date
        ]
        
        audit_entries = [
            e for e in self._audit_entries
            if start_date <= e.timestamp <= end_date
        ]
        
        # Group by user
        user_activity = defaultdict(list)
        for entry in audit_entries:
            user_activity[entry.user_id].append(entry)
        
        return {
            "report_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "summary": {
                "total_events": len(events),
                "total_audit_entries": len(audit_entries),
                "unique_users": len(user_activity),
                "critical_events": sum(
                    1 for e in events
                    if e.severity == SecuritySeverity.CRITICAL
                )
            },
            "by_event_type": {
                event_type.value: sum(1 for e in events if e.event_type == event_type)
                for event_type in SecurityEventType
            },
            "top_users": sorted(
                [
                    {"user_id": uid, "actions": len(entries)}
                    for uid, entries in user_activity.items()
                ],
                key=lambda x: x["actions"],
                reverse=True
            )[:10]
        }


# Global singleton
_security_service = None

def get_security_service() -> SecurityService:
    """Get global SecurityService instance"""
    global _security_service
    if _security_service is None:
        _security_service = SecurityService()
    return _security_service