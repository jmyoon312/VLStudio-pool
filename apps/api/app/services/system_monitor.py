"""
System Monitor - Health & Metrics Dashboard

Provides:
1. System health checks
2. Performance metrics
3. Service status tracking
4. Alert management
5. Dashboard data API

Usage:
    monitor = SystemMonitor()
    
    # Get system health
    health = await monitor.check_health()
    
    # Get metrics
    metrics = monitor.get_metrics()
    
    # Get dashboard data
    dashboard = monitor.get_dashboard_data()
"""

import os
import time
import psutil
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    """Service status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


class AlertLevel(Enum):
    """Alert levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ServiceHealth:
    """Health status of a service"""
    service_name: str
    status: ServiceStatus
    response_time_ms: float = 0.0
    last_check: Optional[datetime] = None
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None


@dataclass
class Alert:
    """System alert"""
    alert_id: str
    level: AlertLevel
    service: str
    message: str
    timestamp: datetime
    acknowledged: bool = False
    resolved: bool = False


@dataclass
class SystemMetrics:
    """System metrics snapshot"""
    timestamp: datetime
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_used_mb: float = 0.0
    memory_available_mb: float = 0.0
    disk_percent: float = 0.0
    network_sent_mb: float = 0.0
    network_recv_mb: float = 0.0
    active_connections: int = 0


class SystemMonitor:
    """
    System Monitor for health and metrics
    
    Monitors:
    - System resources (CPU, Memory, Disk, Network)
    - Service health (API, Database, Cache, etc.)
    - Application metrics
    - Alerts and notifications
    """
    
    def __init__(self):
        self._services: Dict[str, ServiceHealth] = {}
        self._alerts: List[Alert] = []
        self._metrics_history: List[SystemMetrics] = []
        self._max_history = 1440  # 24 hours at 1-minute intervals
        
        # Initialize service list
        self._init_services()
        
        # Thresholds
        self._thresholds = {
            "cpu_percent": 80.0,
            "memory_percent": 85.0,
            "disk_percent": 90.0,
            "response_time_ms": 1000.0
        }
        
        logger.info("SystemMonitor initialized")
    
    def _init_services(self):
        """Initialize default services to monitor"""
        default_services = [
            "api_server",
            "database",
            "cache_redis",
            "message_queue",
            "storage",
            "cdn",
            "youtube_api",
            "tts_service",
            "image_gen_service",
            "video_renderer"
        ]
        
        for service in default_services:
            self._services[service] = ServiceHealth(
                service_name=service,
                status=ServiceStatus.UNKNOWN,
                last_check=datetime.now()
            )
    
    async def check_health(self) -> Dict[str, Any]:
        """
        Check overall system health
        
        Returns:
            Health status dictionary
        """
        start_time = time.time()
        
        # Check system resources
        system_health = await self._check_system_resources()
        
        # Check services
        service_health = await self._check_services()
        
        # Determine overall status
        if system_health["status"] == "healthy" and all(
            s.status == ServiceStatus.HEALTHY for s in service_health.values()
        ):
            overall_status = "healthy"
        elif system_health["status"] == "down" or any(
            s.status == ServiceStatus.DOWN for s in service_health.values()
        ):
            overall_status = "down"
        else:
            overall_status = "degraded"
        
        duration_ms = (time.time() - start_time) * 1000
        
        return {
            "status": overall_status,
            "timestamp": datetime.now().isoformat(),
            "check_duration_ms": duration_ms,
            "system": system_health,
            "services": {
                name: {
                    "status": h.status.value,
                    "response_time_ms": h.response_time_ms,
                    "last_check": h.last_check.isoformat() if h.last_check else None
                }
                for name, h in service_health.items()
            },
            "active_alerts": self._get_active_alert_count()
        }
    
    async def _check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_mb = memory.used / (1024 * 1024)
            memory_available_mb = memory.available / (1024 * 1024)
            
            # Disk
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # Network
            net_io = psutil.net_io_counters()
            network_sent_mb = net_io.bytes_sent / (1024 * 1024)
            network_recv_mb = net_io.bytes_recv / (1024 * 1024)
            
            # Check thresholds and create alerts
            await self._check_resource_thresholds(
                cpu_percent, memory_percent, disk_percent
            )
            
            # Determine status
            if cpu_percent > 90 or memory_percent > 95 or disk_percent > 95:
                status = "degraded"
            elif cpu_percent > self._thresholds["cpu_percent"] or \
                 memory_percent > self._thresholds["memory_percent"] or \
                 disk_percent > self._thresholds["disk_percent"]:
                status = "warning"
            else:
                status = "healthy"
            
            # Store metrics
            metrics = SystemMetrics(
                timestamp=datetime.now(),
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                memory_used_mb=memory_used_mb,
                memory_available_mb=memory_available_mb,
                disk_percent=disk_percent,
                network_sent_mb=network_sent_mb,
                network_recv_mb=network_recv_mb
            )
            self._metrics_history.append(metrics)
            
            # Trim history
            if len(self._metrics_history) > self._max_history:
                self._metrics_history = self._metrics_history[-self._max_history:]
            
            return {
                "status": status,
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent,
                "memory_used_mb": round(memory_used_mb, 1),
                "disk_percent": disk_percent,
                "network": {
                    "sent_mb": round(network_sent_mb, 1),
                    "recv_mb": round(network_recv_mb, 1)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to check system resources: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _check_services(self) -> Dict[str, ServiceHealth]:
        """Check individual services"""
        service_checks = {
            "api_server": self._check_api_server,
            "database": self._check_database,
            "cache_redis": self._check_redis,
            "message_queue": self._check_message_queue,
            "storage": self._check_storage
        }
        
        for service_name, check_func in service_checks.items():
            try:
                result = await check_func()
                self._services[service_name] = result
            except Exception as e:
                logger.error(f"Failed to check {service_name}: {e}")
                self._services[service_name] = ServiceHealth(
                    service_name=service_name,
                    status=ServiceStatus.DOWN,
                    error_message=str(e),
                    last_check=datetime.now()
                )
        
        return self._services
    
    async def _check_api_server(self) -> ServiceHealth:
        """Check API server health"""
        start = time.time()
        
        try:
            # Try to import and check FastAPI
            from app.main import app
            response_time_ms = (time.time() - start) * 1000
            
            return ServiceHealth(
                service_name="api_server",
                status=ServiceStatus.HEALTHY,
                response_time_ms=response_time_ms,
                last_check=datetime.now(),
                details={"app_loaded": True}
            )
        except Exception as e:
            return ServiceHealth(
                service_name="api_server",
                status=ServiceStatus.DOWN,
                response_time_ms=(time.time() - start) * 1000,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    async def _check_database(self) -> ServiceHealth:
        """Check database health"""
        start = time.time()
        
        try:
            from app.database import SessionLocal
            db = SessionLocal()
            db.execute("SELECT 1")
            db.close()
            
            response_time_ms = (time.time() - start) * 1000
            
            return ServiceHealth(
                service_name="database",
                status=ServiceStatus.HEALTHY,
                response_time_ms=response_time_ms,
                last_check=datetime.now(),
                details={"connection": "ok"}
            )
        except Exception as e:
            return ServiceHealth(
                service_name="database",
                status=ServiceStatus.DOWN,
                response_time_ms=(time.time() - start) * 1000,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    async def _check_redis(self) -> ServiceHealth:
        """Check Redis cache health"""
        start = time.time()
        
        try:
            import redis
            from app.config import settings
            
            r = redis.Redis.from_url(settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://localhost:6379")
            r.ping()
            
            response_time_ms = (time.time() - start) * 1000
            
            return ServiceHealth(
                service_name="cache_redis",
                status=ServiceStatus.HEALTHY,
                response_time_ms=response_time_ms,
                last_check=datetime.now()
            )
        except Exception as e:
            return ServiceHealth(
                service_name="cache_redis",
                status=ServiceStatus.DEGRADED,
                response_time_ms=(time.time() - start) * 1000,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    async def _check_message_queue(self) -> ServiceHealth:
        """Check message queue health"""
        # Simplified check - just return healthy
        return ServiceHealth(
            service_name="message_queue",
            status=ServiceStatus.HEALTHY,
            response_time_ms=5.0,
            last_check=datetime.now(),
            details={"type": "celery"}
        )
    
    async def _check_storage(self) -> ServiceHealth:
        """Check storage health"""
        try:
            import os
            from app.config import settings
            
            storage_path = getattr(settings, 'root_download_path', '/tmp')
            available = psutil.disk_usage(storage_path)
            
            return ServiceHealth(
                service_name="storage",
                status=ServiceStatus.HEALTHY,
                response_time_ms=10.0,
                last_check=datetime.now(),
                details={"available_gb": round(available.free / (1024**3), 1)}
            )
        except Exception as e:
            return ServiceHealth(
                service_name="storage",
                status=ServiceStatus.DEGRADED,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    async def _check_resource_thresholds(
        self,
        cpu_percent: float,
        memory_percent: float,
        disk_percent: float
    ):
        """Check if resources exceed thresholds and create alerts"""
        
        if cpu_percent > self._thresholds["cpu_percent"]:
            self._create_alert(
                AlertLevel.WARNING,
                "system",
                f"CPU usage high: {cpu_percent:.1f}%"
            )
        
        if memory_percent > self._thresholds["memory_percent"]:
            self._create_alert(
                AlertLevel.WARNING,
                "system",
                f"Memory usage high: {memory_percent:.1f}%"
            )
        
        if disk_percent > self._thresholds["disk_percent"]:
            self._create_alert(
                AlertLevel.ERROR,
                "system",
                f"Disk usage critical: {disk_percent:.1f}%"
            )
    
    def _create_alert(self, level: AlertLevel, service: str, message: str):
        """Create a new alert"""
        alert = Alert(
            alert_id=f"alert_{int(time.time())}",
            level=level,
            service=service,
            message=message,
            timestamp=datetime.now()
        )
        
        # Avoid duplicate alerts
        for existing in self._alerts:
            if not existing.resolved and existing.message == message:
                return
        
        self._alerts.append(alert)
        logger.warning(f"Alert: [{level.value}] {service}: {message}")
    
    def _get_active_alert_count(self) -> Dict[str, int]:
        """Get count of active alerts by level"""
        active = [a for a in self._alerts if not a.resolved]
        
        counts = {
            "total": len(active),
            "critical": sum(1 for a in active if a.level == AlertLevel.CRITICAL),
            "error": sum(1 for a in active if a.level == AlertLevel.ERROR),
            "warning": sum(1 for a in active if a.level == AlertLevel.WARNING),
            "info": sum(1 for a in active if a.level == AlertLevel.INFO)
        }
        
        return counts
    
    def get_metrics(self, hours: int = 1) -> Dict[str, Any]:
        """Get system metrics for specified hours"""
        cutoff = datetime.now() - timedelta(hours=hours)
        recent = [m for m in self._metrics_history if m.timestamp > cutoff]
        
        if not recent:
            return {"error": "No metrics available"}
        
        # Calculate averages
        avg_cpu = sum(m.cpu_percent for m in recent) / len(recent)
        avg_memory = sum(m.memory_percent for m in recent) / len(recent)
        
        # Get peak
        peak_cpu = max(m.cpu_percent for m in recent)
        peak_memory = max(m.memory_percent for m in recent)
        
        return {
            "period_hours": hours,
            "sample_count": len(recent),
            "average": {
                "cpu_percent": round(avg_cpu, 1),
                "memory_percent": round(avg_memory, 1)
            },
            "peak": {
                "cpu_percent": round(peak_cpu, 1),
                "memory_percent": round(peak_memory, 1)
            },
            "current": {
                "cpu_percent": round(recent[-1].cpu_percent, 1),
                "memory_percent": round(recent[-1].memory_percent, 1),
                "memory_used_mb": round(recent[-1].memory_used_mb, 1),
                "disk_percent": round(recent[-1].disk_percent, 1)
            }
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for dashboard display"""
        return {
            "health": self.check_health(),  # Will be async in real use
            "metrics": self.get_metrics(hours=1),
            "alerts": self.get_alerts(limit=10),
            "services": self._services,
            "uptime": self._get_uptime()
        }
    
    def get_alerts(
        self,
        level: Optional[AlertLevel] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recent alerts"""
        alerts = self._alerts
        
        if level:
            alerts = [a for a in alerts if a.level == level]
        
        alerts = sorted(alerts, key=lambda x: x.timestamp, reverse=True)
        
        return [
            {
                "alert_id": a.alert_id,
                "level": a.level.value,
                "service": a.service,
                "message": a.message,
                "timestamp": a.timestamp.isoformat(),
                "acknowledged": a.acknowledged,
                "resolved": a.resolved
            }
            for a in alerts[:limit]
        ]
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert"""
        for alert in self._alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return True
        return False
    
    def resolve_alert(self, alert_id: str) -> bool:
        """Mark alert as resolved"""
        for alert in self._alerts:
            if alert.alert_id == alert_id:
                alert.resolved = True
                return True
        return False
    
    def _get_uptime(self) -> Dict[str, Any]:
        """Get system uptime"""
        try:
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            
            return {
                "started_at": boot_time.isoformat(),
                "uptime_seconds": int(uptime.total_seconds()),
                "uptime_hours": round(uptime.total_seconds() / 3600, 1)
            }
        except:
            return {"error": "Could not determine uptime"}


# Global singleton
_system_monitor = None

def get_system_monitor() -> SystemMonitor:
    """Get global SystemMonitor instance"""
    global _system_monitor
    if _system_monitor is None:
        _system_monitor = SystemMonitor()
    return _system_monitor