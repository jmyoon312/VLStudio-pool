"""
Health & Deployment API Router

Endpoints:
- GET /api/health - Overall health check
- GET /api/health/{service} - Service health
- GET /api/health/resources - Resource metrics
- GET /api/health/alerts - Health alerts
- GET /api/health/summary - Health summary

- GET /api/deploy/config/{env} - Get deployment config
- GET /api/deploy/manifests/{env} - Get K8s manifests
- POST /api/deploy/validate - Validate deployment
- POST /api/deploy/secrets - Manage secrets

- GET /api/cicd/pipelines - List pipelines
- POST /api/cicd/run - Run pipeline
- GET /api/cicd/status/{run_id} - Get run status
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api", tags=["health_deployment"])

# ==================== Health ====================

def get_health_monitor():
    from app.services.system_health_monitor import get_health_monitor
    return get_health_monitor()

@router.get("/health")
async def health_check():
    """Overall health check"""
    health = get_health_monitor()
    return await health.check_system_health()

@router.get("/health/{service_name}")
async def service_health(service_name: str):
    """Service specific health"""
    health = get_health_monitor()
    return await health.check_service_health(service_name)

@router.get("/health/resources")
async def get_resources(hours: int = 1):
    """Get resource metrics"""
    health = get_health_monitor()
    return await health.get_resource_metrics(hours)

@router.get("/health/alerts")
async def get_health_alerts(severity: Optional[str] = None):
    """Get health alerts"""
    from app.services.system_health_monitor import AlertSeverity
    
    health = get_health_monitor()
    alert_severity = AlertSeverity(severity) if severity else None
    alerts = health.get_active_alerts(alert_severity)
    return {"data": alerts}

@router.get("/health/summary")
async def health_summary():
    """Get health summary"""
    health = get_health_monitor()
    return health.get_health_summary()

# ==================== Deployment ====================

def get_deployment_config():
    from app.services.deployment_config import get_deployment_config
    return get_deployment_config()

@router.get("/deploy/config/{environment}")
async def get_deploy_config(environment: str):
    """Get deployment configuration"""
    deploy = get_deployment_config()
    config = await deploy.get_config(environment)
    return config

@router.get("/deploy/manifests/{environment}")
async def get_manifests(environment: str = "production"):
    """Get Kubernetes manifests"""
    deploy = get_deployment_config()
    manifests = await deploy.get_k8s_manifests(environment)
    return {"manifests": manifests}

@router.post("/deploy/validate")
async def validate_deployment(environment: str):
    """Validate deployment configuration"""
    deploy = get_deployment_config()
    result = await deploy.validate_deployment(environment)
    return result

@router.get("/deploy/secrets")
async def list_secrets():
    """List secret keys (not values)"""
    deploy = get_deployment_config()
    return {"secrets": deploy.list_secrets()}

@router.post("/deploy/secrets/{key}")
async def set_secret(key: str, value: str):
    """Set a secret"""
    deploy = get_deployment_config()
    await deploy.set_secret(key, value)
    return {"status": "set"}

# ==================== CI/CD ====================

def get_cicd():
    from app.services.cicd_pipeline import get_cicd_pipeline
    return get_cicd_pipeline()

@router.get("/cicd/pipelines")
async def list_pipelines():
    """List available pipelines"""
    cicd = get_cicd()
    return {"pipelines": list(cicd._pipelines.keys())}

@router.post("/cicd/run")
async def run_pipeline(
    pipeline_name: str,
    environment: str = None,
    commit_sha: str = "",
    triggered_by: str = "api"
):
    """Run a pipeline"""
    cicd = get_cicd()
    run_id = await cicd.run_pipeline(pipeline_name, environment, commit_sha, triggered_by)
    return {"run_id": run_id, "status": "started"}

@router.get("/cicd/status/{run_id}")
async def get_pipeline_status(run_id: str):
    """Get pipeline run status"""
    cicd = get_cicd()
    status = await cicd.get_pipeline_status(run_id)
    if not status:
        raise HTTPException(status_code=404, message="Run not found")
    return status

@router.get("/cicd/history")
async def get_pipeline_history(pipeline_name: str = None, limit: int = 10):
    """Get pipeline history"""
    cicd = get_cicd()
    history = cicd.get_pipeline_history(pipeline_name, limit)
    return {"data": history}

@router.post("/cicd/cancel/{run_id}")
async def cancel_pipeline(run_id: str):
    """Cancel a pipeline run"""
    cicd = get_cicd()
    result = await cicd.cancel_pipeline(run_id)
    return {"status": "cancelled" if result else "not_found"}