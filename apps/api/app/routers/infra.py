from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import docker
import os
import logging
from .. import schemas

logger = logging.getLogger(__name__)

# --- Helpers ---
def get_docker_client():
    """Returns a Docker client if the socket is accessible, else None."""
    try:
        client = docker.from_env()
        client.ping()
        return client
    except Exception as e:
        logger.warning(f"Docker client unavailable: {e}")
        return None

router = APIRouter(tags=["infrastructure"])

@router.get("/status", response_model=schemas.InfraStatusResponse)
def get_infra_status():
    """
    Returns real-time status of all managed Docker containers.
    """
    client = get_docker_client()
    if not client:
        return schemas.InfraStatusResponse(
            services=[],
            docker_available=False,
            error="Docker socket (/var/run/docker.sock) not mounted or accessible."
        )
    
    services = []
    try:
        containers = client.containers.list(all=True)
        import concurrent.futures
        import json

        def fetch_container_stats(c):
            image_name = c.attrs.get('Config', {}).get('Image', 'unknown')
            uptime = c.attrs.get('State', {}).get('StartedAt', 'unknown')
            
            cpu_pct_str = "N/A"
            mem_usage_str = "N/A"
            
            if c.status == 'running':
                try:
                    # stream=False 버그를 우회하기 위해 스트림을 열고 두 번째 청크를 낚아채는 히트앤런 기법
                    gen = c.stats(stream=True)
                    next(gen) # 첫 번째 청크는 버림
                    stats = json.loads(next(gen).decode('utf-8'))
                    
                    cpu_stats = stats.get('cpu_stats', {})
                    precpu_stats = stats.get('precpu_stats', {})
                    cpu_usage_dict = cpu_stats.get('cpu_usage', {})
                    precpu_usage_dict = precpu_stats.get('cpu_usage', {})
                    
                    cpu_delta = cpu_usage_dict.get('total_usage', 0) - precpu_usage_dict.get('total_usage', 0)
                    system_delta = cpu_stats.get('system_cpu_usage', 0) - precpu_stats.get('system_cpu_usage', 0)
                    
                    if system_delta > 0 and cpu_delta >= 0:
                        online_cpus = cpu_stats.get('online_cpus', len(cpu_usage_dict.get('percpu_usage', [1])))
                        val = (cpu_delta / system_delta) * online_cpus * 100.0
                        cpu_pct_str = f"{val:.1f}%"
                    
                    mem_val = stats.get('memory_stats', {}).get('usage', 0) / (1024 * 1024)
                    mem_usage_str = f"{mem_val:.1f} MB"
                except Exception as e:
                    cpu_pct_str = f"ERR: {type(e).__name__}"
                    mem_usage_str = "ERR"
            
            return schemas.ContainerStatus(
                name=c.name,
                status=c.status,
                image=image_name,
                uptime=uptime,
                cpu_usage=cpu_pct_str,
                mem_usage=mem_usage_str
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            services = list(executor.map(fetch_container_stats, containers))
        
        return schemas.InfraStatusResponse(services=services, docker_available=True)
    except Exception as e:
        return schemas.InfraStatusResponse(services=[], docker_available=True, error=str(e))

@router.post("/restart/{container_name}")
def restart_container(container_name: str):
    """
    Performs a hard restart of a specific Docker container.
    """
    client = get_docker_client()
    if not client:
        raise HTTPException(status_code=503, detail="Docker management unavailable.")
    
    try:
        container = client.containers.get(container_name)
        container.restart()
        return {"status": "success", "message": f"Container {container_name} restarted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/{container_name}")
def get_container_logs(container_name: str, lines: int = 100):
    """
    Retrieves the last N lines of logs from a specific container.
    """
    client = get_docker_client()
    if not client:
        raise HTTPException(status_code=503, detail="Docker management unavailable.")
    
    try:
        container = client.containers.get(container_name)
        logs = container.logs(tail=lines).decode('utf-8')
        return {"container": container_name, "logs": logs.splitlines()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
