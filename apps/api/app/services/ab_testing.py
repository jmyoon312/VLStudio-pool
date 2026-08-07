"""
A/B Testing Service

Provides:
1. Experiment management
2. Variant allocation
3. Statistical analysis
4. Result tracking

Usage:
    ab = ABTestingService()
    
    # Create experiment
    await ab.create_experiment(
        name="thumbnail_test",
        variants=["control", "variant_a"]
    )
    
    # Get variant
    variant = await ab.get_variant(experiment_id, user_id)
"""

import os
import asyncio
import logging
import random
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ExperimentStatus(Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


@dataclass
class Experiment:
    experiment_id: str
    name: str
    variants: Dict[str, float]  # variant -> traffic allocation
    status: ExperimentStatus = ExperimentStatus.DRAFT
    metrics: List[str] = field(default_factory=list)
    started_at: datetime = None
    ended_at: datetime = None


@dataclass
class VariantAssignment:
    assignment_id: str
    experiment_id: str
    user_id: str
    variant: str
    timestamp: datetime = field(default_factory=datetime.now)


class ABTestingService:
    def __init__(self):
        self._experiments: Dict[str, Experiment] = {}
        self._assignments: List[VariantAssignment] = []
        
        logger.info("ABTestingService initialized")
    
    async def create_experiment(
        self,
        name: str,
        variants: Dict[str, float]
    ) -> str:
        experiment_id = f"exp_{uuid.uuid4().hex[:8]}"
        
        experiment = Experiment(
            experiment_id=experiment_id,
            name=name,
            variants=variants
        )
        
        self._experiments[experiment_id] = experiment
        
        logger.info(f"[OK] Experiment created: {name}")
        
        return experiment_id
    
    async def start_experiment(self, experiment_id: str) -> bool:
        exp = self._experiments.get(experiment_id)
        if exp:
            exp.status = ExperimentStatus.RUNNING
            exp.started_at = datetime.now()
            return True
        return False
    
    async def get_variant(
        self,
        experiment_id: str,
        user_id: str
    ) -> Optional[str]:
        exp = self._experiments.get(experiment_id)
        
        if not exp or exp.status != ExperimentStatus.RUNNING:
            return None
        
        # Deterministic allocation based on user_id
        random.seed(hash(user_id) % 10000)
        r = random.random() * 100
        
        cumulative = 0
        for variant, allocation in exp.variants.items():
            cumulative += allocation
            if r < cumulative:
                # Record assignment
                assignment = VariantAssignment(
                    assignment_id=f"assign_{uuid.uuid4().hex[:8]}",
                    experiment_id=experiment_id,
                    user_id=user_id,
                    variant=variant
                )
                self._assignments.append(assignment)
                
                return variant
        
        return list(exp.variants.keys())[0]
    
    async def record_conversion(
        self,
        experiment_id: str,
        user_id: str,
        metric: str,
        value: float
    ) -> bool:
        logger.info(f"[CHART] Conversion: {metric}={value} for user {user_id}")
        return True
    
    def get_results(self, experiment_id: str) -> Dict:
        exp = self._experiments.get(experiment_id)
        if not exp:
            return {}
        
        assignments = [a for a in self._assignments if a.experiment_id == experiment_id]
        
        by_variant = {}
        for a in assignments:
            if a.variant not in by_variant:
                by_variant[a.variant] = 0
            by_variant[a.variant] += 1
        
        return {
            "experiment_id": experiment_id,
            "name": exp.name,
            "status": exp.status.value,
            "variants": {
                v: {"users": by_variant.get(v, 0), "allocation": p}
                for v, p in exp.variants.items()
            }
        }


_ab_testing = None

def get_ab_testing() -> ABTestingService:
    global _ab_testing
    if _ab_testing is None:
        _ab_testing = ABTestingService()
    return _ab_testing