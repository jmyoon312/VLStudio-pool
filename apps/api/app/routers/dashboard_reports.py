"""
Dashboard, Reports & Metrics API Router

Endpoints:
- GET /api/dashboard/status - System status
- GET /api/dashboard/stats - Quick stats
- POST /api/dashboard/services - Register service
- PUT /api/dashboard/services/{name} - Update service

- GET /api/reports/daily - Daily report
- GET /api/reports/weekly - Weekly report  
- GET /api/reports/monthly - Monthly report
- GET /api/reports - Report list

- GET /api/metrics/{name} - Get metric data
- GET /api/metrics/kpi/{name} - Get KPI
- GET /api/metrics/kpis - Get all KPIs
- GET /api/metrics/trends/{name} - Get trends
- GET /api/metrics/dashboard - Dashboard metrics
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api", tags=["dashboard_reports"])

# ==================== Dashboard ====================

def get_dashboard():
    from app.services.dashboard_aggregator import get_dashboard_aggregator
    return get_dashboard_aggregator()

@router.get("/dashboard/status")
async def get_system_status():
    """Get overall system status"""
    dashboard = get_dashboard()
    return await dashboard.get_system_status()

@router.get("/dashboard/stats")
async def get_quick_stats():
    """Get quick statistics"""
    dashboard = get_dashboard()
    return await dashboard.get_quick_stats()

@router.post("/dashboard/services")
async def register_service(name: str, status: str, message: str = ""):
    """Register a service"""
    dashboard = get_dashboard()
    await dashboard.register_service(name, status, message)
    return {"status": "registered"}

@router.put("/dashboard/services/{service_name}")
async def update_service(service_name: str, status: str, message: str = "", metrics: dict = None):
    """Update service status"""
    dashboard = get_dashboard()
    await dashboard.update_service_status(service_name, status, message, metrics)
    return {"status": "updated"}

# ==================== Reports ====================

def get_report_generator():
    from app.services.report_generator import get_report_generator
    return get_report_generator()

@router.get("/reports/daily")
async def get_daily_report(date: Optional[str] = None):
    """Get daily report"""
    from datetime import datetime
    
    report_gen = get_report_generator()
    
    if date:
        try:
            dt = datetime.fromisoformat(date)
        except:
            dt = datetime.now()
    else:
        dt = datetime.now()
    
    report = await report_gen.generate_daily_report(dt)
    return report

@router.get("/reports/weekly")
async def get_weekly_report(week_start: Optional[str] = None):
    """Get weekly report"""
    from datetime import datetime, timedelta
    
    report_gen = get_report_generator()
    
    if week_start:
        try:
            dt = datetime.fromisoformat(week_start)
        except:
            dt = datetime.now() - timedelta(days=7)
    else:
        dt = None
    
    report = await report_gen.generate_weekly_report(dt)
    return report

@router.get("/reports/monthly")
async def get_monthly_report(year: Optional[int] = None, month: Optional[int] = None):
    """Get monthly report"""
    report_gen = get_report_generator()
    report = await report_gen.generate_monthly_report(year, month)
    return report

@router.get("/reports")
async def get_report_list(limit: int = 10):
    """Get report list"""
    report_gen = get_report_generator()
    reports = report_gen.get_report_list(limit=limit)
    return {"data": reports}

@router.get("/reports/{report_id}/export")
async def export_report(report_id: str, format: str = "json"):
    """Export report"""
    report_gen = get_report_generator()
    data = await report_gen.export_report(report_id, format)
    return {"data": data}

# ==================== Metrics ====================

def get_metrics_aggregator():
    from app.services.metrics_aggregator import get_metrics_aggregator
    return get_metrics_aggregator()

@router.post("/metrics")
async def record_metric(name: str, value: float, tags: dict = None):
    """Record a metric"""
    metrics = get_metrics_aggregator()
    await metrics.record(name, value, tags)
    return {"status": "recorded"}

@router.get("/metrics/{name}")
async def get_metric(name: str, hours: int = 24, tags: dict = None):
    """Get metric data"""
    metrics = get_metrics_aggregator()
    data = await metrics.get_metric(name, hours, tags)
    return {"data": data}

@router.get("/metrics/kpi/{name}")
async def get_kpi(name: str):
    """Get KPI value"""
    metrics = get_metrics_aggregator()
    kpi = await metrics.get_kpi(name)
    return kpi

@router.get("/metrics/kpis")
async def get_all_kpis():
    """Get all KPIs"""
    metrics = get_metrics_aggregator()
    kpis = await metrics.get_all_kpis()
    return {"kpis": kpis}

@router.get("/metrics/trends/{name}")
async def get_trends(name: str, days: int = 7, interval: str = "1d"):
    """Get metric trends"""
    metrics = get_metrics_aggregator()
    trends = await metrics.get_trends(name, days, interval)
    return {"data": trends}

@router.get("/metrics/dashboard")
async def get_metrics_dashboard():
    """Get dashboard metrics"""
    metrics = get_metrics_aggregator()
    return await metrics.get_dashboard_metrics()