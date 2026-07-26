"""
Deployment Config Manager

Provides:
1. Environment configuration management
2. Secret management
3. Config templates
4. Kubernetes manifests
5. Health check definitions
6. Deployment verification

Usage:
    deploy = DeploymentConfigManager()
    
    # Get config
    config = await deploy.get_config("production")
    
    # Validate deployment
    result = await deploy.validate_deployment("staging")
    
    # Get k8s manifests
    manifests = await deploy.get_k8s_manifests()
"""

import os
import asyncio
import logging
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class EnvType(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class HealthCheckProtocol(Enum):
    HTTP = "http"
    TCP = "tcp"
    COMMAND = "command"


@dataclass
class HealthCheck:
    path: str = "/health"
    port: int = 8000
    protocol: str = "http"
    interval_seconds: int = 30
    timeout_seconds: int = 5
    healthy_threshold: int = 2
    unhealthy_threshold: int = 3


@dataclass
class DeploymentConfig:
    environment: str
    replicas: int = 1
    resources: Dict[str, Any] = None
    environment_vars: Dict[str, str] = None
    secrets: List[str] = None
    health_check: HealthCheck = None
    autoscaling: Dict = None


class DeploymentConfigManager:
    def __init__(self):
        self._configs: Dict[str, DeploymentConfig] = {}
        self._secrets: Dict[str, str] = {}
        
        self._setup_default_configs()
        
        logger.info("DeploymentConfigManager initialized")
    
    def _setup_default_configs(self):
        self._configs = {
            "development": DeploymentConfig(
                environment="development",
                replicas=1,
                resources={
                    "cpu": "500m",
                    "memory": "512Mi"
                },
                environment_vars={
                    "ENV": "development",
                    "LOG_LEVEL": "debug",
                    "DEBUG": "true"
                },
                health_check=HealthCheck(path="/health", port=8000)
            ),
            "staging": DeploymentConfig(
                environment="staging",
                replicas=2,
                resources={
                    "cpu": "1000m",
                    "memory": "1Gi"
                },
                environment_vars={
                    "ENV": "staging",
                    "LOG_LEVEL": "info",
                    "DEBUG": "false"
                },
                health_check=HealthCheck(path="/health", port=8000),
                autoscaling={
                    "enabled": True,
                    "min_replicas": 2,
                    "max_replicas": 5,
                    "target_cpu_percent": 70
                }
            ),
            "production": DeploymentConfig(
                environment="production",
                replicas=3,
                resources={
                    "cpu": "2000m",
                    "memory": "2Gi"
                },
                environment_vars={
                    "ENV": "production",
                    "LOG_LEVEL": "warning",
                    "DEBUG": "false"
                },
                health_check=HealthCheck(
                    path="/health",
                    port=8000,
                    interval_seconds=15,
                    healthy_threshold=3,
                    unhealthy_threshold=5
                ),
                autoscaling={
                    "enabled": True,
                    "min_replicas": 3,
                    "max_replicas": 10,
                    "target_cpu_percent": 60
                }
            )
        }
        
        self._secrets = {
            "DATABASE_URL": "postgres://xxx",
            "REDIS_URL": "redis://xxx",
            "YOUTUBE_API_KEY": "xxx",
            "OPENROUTER_API_KEY": "xxx"
        }
    
    async def get_config(self, environment: str) -> Optional[Dict]:
        config = self._configs.get(environment)
        if not config:
            return None
        
        return {
            "environment": config.environment,
            "replicas": config.replicas,
            "resources": config.resources,
            "environment_vars": config.environment_vars,
            "health_check": {
                "path": config.health_check.path,
                "port": config.health_check.port,
                "protocol": config.health_check.protocol,
                "interval_seconds": config.health_check.interval_seconds
            },
            "autoscaling": config.autoscaling
        }
    
    async def get_secret(self, key: str) -> Optional[str]:
        return self._secrets.get(key)
    
    async def set_secret(self, key: str, value: str):
        self._secrets[key] = value
        logger.info(f"🔐 Secret updated: {key}")
    
    def list_secrets(self) -> List[str]:
        return list(self._secrets.keys())
    
    async def get_k8s_manifests(self, environment: str = "production") -> Dict[str, str]:
        config = self._configs.get(environment)
        if not config:
            return {}
        
        manifests = {}
        
        manifests["deployment"] = self._generate_deployment(config)
        manifests["service"] = self._generate_service(config)
        manifests["ingress"] = self._generate_ingress(config)
        manifests["configmap"] = self._generate_configmap(config)
        
        if environment != "development":
            manifests["hpa"] = self._generate_hpa(config)
        
        return manifests
    
    def _generate_deployment(self, config: DeploymentConfig) -> str:
        deployment = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": f"viraloop-{config.environment}",
                "labels": {
                    "app": "viraloop",
                    "env": config.environment
                }
            },
            "spec": {
                "replicas": config.replicas,
                "selector": {
                    "matchLabels": {
                        "app": "viraloop"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "app": "viraloop",
                            "env": config.environment
                        }
                    },
                    "spec": {
                        "containers": [{
                            "name": "api",
                            "image": f"viraloop/api:{config.environment}",
                            "ports": [{"containerPort": 8000}],
                            "resources": {
                                "requests": {
                                    "cpu": config.resources["cpu"],
                                    "memory": config.resources["memory"]
                                }
                            },
                            "env": [
                                {"name": k, "value": v}
                                for k, v in (config.environment_vars or {}).items()
                            ],
                            "livenessProbe": {
                                "httpGet": {
                                    "path": config.health_check.path,
                                    "port": config.health_check.port
                                },
                                "initialDelaySeconds": 30,
                                "periodSeconds": config.health_check.interval_seconds
                            }
                        }]
                    }
                }
            }
        }
        
        return json.dumps(deployment, indent=2)
    
    def _generate_service(self, config: DeploymentConfig) -> str:
        service = {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": f"viraloop-{config.environment}"
            },
            "spec": {
                "selector": {"app": "viraloop"},
                "ports": [
                    {"port": 80, "targetPort": 8000}
                ],
                "type": "ClusterIP"
            }
        }
        
        return json.dumps(service, indent=2)
    
    def _generate_ingress(self, config: DeploymentConfig) -> str:
        host = f"{config.environment}.viraloop.io"
        if config.environment == "production":
            host = "viraloop.io"
        
        ingress = {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "Ingress",
            "metadata": {
                "name": f"viraloop-{config.environment}",
                "annotations": {
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true"
                }
            },
            "spec": {
                "rules": [{
                    "host": host,
                    "http": {
                        "paths": [{
                            "path": "/",
                            "pathType": "Prefix",
                            "backend": {
                                "service": {
                                    "name": f"viraloop-{config.environment}",
                                    "port": {"number": 80}
                                }
                            }
                        }]
                    }
                }]
            }
        }
        
        return json.dumps(ingress, indent=2)
    
    def _generate_configmap(self, config: DeploymentConfig) -> str:
        cm = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {
                "name": f"viraloop-{config.environment}"
            },
            "data": config.environment_vars or {}
        }
        
        return json.dumps(cm, indent=2)
    
    def _generate_hpa(self, config: DeploymentConfig) -> str:
        if not config.autoscaling:
            return "{}"
        
        autoscaling = config.autoscaling
        
        hpa = {
            "apiVersion": "autoscaling/v2",
            "kind": "HorizontalPodAutoscaler",
            "metadata": {
                "name": f"viraloop-{config.environment}"
            },
            "spec": {
                "scaleTargetRef": {
                    "apiVersion": "apps/v1",
                    "kind": "Deployment",
                    "name": f"viraloop-{config.environment}"
                },
                "minReplicas": autoscaling.get("min_replicas", 1),
                "maxReplicas": autoscaling.get("max_replicas", 10),
                "metrics": [{
                    "type": "Resource",
                    "resource": {
                        "name": "cpu",
                        "target": {
                            "type": "Utilization",
                            "averageUtilization": autoscaling.get("target_cpu_percent", 70)
                        }
                    }
                }]
            }
        }
        
        return json.dumps(hpa, indent=2)
    
    async def validate_deployment(self, environment: str) -> Dict:
        config = self._configs.get(environment)
        if not config:
            return {"valid": False, "errors": [f"Environment not found: {environment}"]}
        
        errors = []
        warnings = []
        
        if config.replicas < 1:
            errors.append("Replicas must be at least 1")
        
        if not config.resources:
            warnings.append("No resource limits defined")
        
        if not config.health_check:
            warnings.append("No health check configured")
        
        if environment == "production":
            if config.replicas < 2:
                errors.append("Production should have at least 2 replicas")
            
            if not config.autoscaling:
                warnings.append("Production should have autoscaling enabled")
        
        return {
            "valid": len(errors) == 0,
            "environment": environment,
            "errors": errors,
            "warnings": warnings
        }
    
    async def create_environment(
        self,
        name: str,
        config: Dict
    ) -> bool:
        health_check = HealthCheck(
            path=config.get("health_path", "/health"),
            port=config.get("port", 8000)
        )
        
        new_config = DeploymentConfig(
            environment=name,
            replicas=config.get("replicas", 1),
            resources=config.get("resources", {}),
            environment_vars=config.get("environment_vars", {}),
            health_check=health_check,
            autoscaling=config.get("autoscaling")
        )
        
        self._configs[name] = new_config
        
        logger.info(f"✅ Created environment: {name}")
        
        return True


_deployment_config = None

def get_deployment_config() -> DeploymentConfigManager:
    global _deployment_config
    if _deployment_config is None:
        _deployment_config = DeploymentConfigManager()
    return _deployment_config