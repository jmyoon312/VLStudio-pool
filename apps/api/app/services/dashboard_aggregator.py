"""
Dashboard Aggregator Service

Provides:
1. Unified view of all service statuses
2. Real-time system health monitoring
3. Quick stats across all components
4. Alert aggregation

Usage:
    dashboard = DashboardAggregator()
    
    # Get unified status
    status = await dashboard.get_system_status()
    
    # Get quick stats
    stats = await dashboard.get_quick_stats()
"""

import os
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class SystemStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


@dataclass
class ServiceStatus:
    name: str
    status: SystemStatus
    last_check: datetime
    message: str = ""
    metrics: Dict[str, Any] = None


class DashboardAggregator:
    def __init__(self):
        self._service_health: Dict[str, ServiceStatus] = {}
        self._last_full_update: Optional[datetime] = None
        
        logger.info("DashboardAggregator initialized")
    
    async def register_service(
        self,
        service_name: str,
        status: str = "healthy",
        message: str = ""
    ):
        self._service_health[service_name] = ServiceStatus(
            name=service_name,
            status=SystemStatus(status.lower()),
            last_check=datetime.now(),
            message=message
        )
    
    async def update_service_status(
        self,
        service_name: str,
        status: str,
        message: str = "",
        metrics: Dict = None
    ):
        if service_name not in self._service_health:
            await self.register_service(service_name, status, message)
            return
        
        self._service_health[service_name].status = SystemStatus(status.lower())
        self._service_health[service_name].last_check = datetime.now()
        self._service_health[service_name].message = message
        self._service_health[service_name].metrics = metrics or {}
    
    async def get_system_status(self) -> Dict:
        services = list(self._service_health.values())
        
        if not services:
            return {
                "overall_status": SystemStatus.UNKNOWN.value,
                "services": {},
                "last_update": None
            }
        
        status_counts = {}
        for s in services:
            status_counts[s.status.value] = status_counts.get(s.status.value, 0) + 1
        
        if status_counts.get(SystemStatus.CRITICAL.value, 0) > 0:
            overall = SystemStatus.CRITICAL.value
        elif status_counts.get(SystemStatus.DEGRADED.value, 0) > 0:
            overall = SystemStatus.DEGRADED.value
        else:
            overall = SystemStatus.HEALTHY.value
        
        service_list = {
            s.name: {
                "status": s.status.value,
                "last_check": s.last_check.isoformat(),
                "message": s.message,
                "metrics": s.metrics or {}
            }
            for s in services
        }
        
        return {
            "overall_status": overall,
            "status_counts": status_counts,
            "services": service_list,
            "last_update": datetime.now().isoformat()
        }
    
    async def get_quick_stats(self) -> Dict:
        stats = {
            "timestamp": datetime.now().isoformat(),
            "services_registered": len(self._service_health),
            "healthy_services": 0,
            "degraded_services": 0,
            "critical_services": 0
        }
        
        for service in self._service_health.values():
            if service.status == SystemStatus.HEALTHY:
                stats["healthy_services"] += 1
            elif service.status == SystemStatus.DEGRADED:
                stats["degraded_services"] += 1
            elif service.status == SystemStatus.CRITICAL:
                stats["critical_services"] += 1
        
        return stats
    
    async def get_service_details(self, service_name: str) -> Optional[Dict]:
        service = self._service_health.get(service_name)
        if not service:
            return None
        
        return {
            "name": service.name,
            "status": service.status.value,
            "last_check": service.last_check.isoformat(),
            "message": service.message,
            "metrics": service.metrics or {}
        }
    
    def get_all_services(self) -> list:
        return list(self._service_health.keys())


_dashboard_aggregator = None

def get_dashboard_aggregator() -> DashboardAggregator:
    global _dashboard_aggregator
    if _dashboard_aggregator is None:
        _dashboard_aggregator = DashboardAggregator()
    return _dashboard_aggregator