"""
업로드 규칙 엔진 서비스
"""
from sqlalchemy.orm import Session
from app import models
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class RuleEngine:
    """조건 기반 자동 설정 규칙 엔진"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def evaluate_rules(self, queue_item: models.WorkQueueItem) -> Dict[str, Any]:
        """
        작업 대기열 항목에 대해 모든 활성 규칙을 평가하고 적용
        
        Args:
            queue_item: 평가할 WorkQueueItem
            
        Returns:
            적용할 설정 딕셔너리
        """
        # 활성 규칙을 우선순위 순으로 조회
        # UploadRule 모델에 is_active/priority 컬럼이 없을 수 있어 안전하게 처리
        try:
            rules = self.db.query(models.UploadRule).filter(
                models.UploadRule.is_active == True
            ).order_by(
                models.UploadRule.priority.desc()
            ).all()
        except Exception:
            # is_active or priority column doesn't exist in this schema version — skip rules
            logger.warning("UploadRule schema mismatch (missing is_active/priority). Skipping rule evaluation.")
            return {}
        
        applied_actions = {}
        
        for rule in rules:
            if self._check_conditions(queue_item, rule.conditions):
                logger.info(f"Rule '{rule.name}' matched for item {queue_item.id}")
                
                # 규칙의 액션을 적용 (우선순위가 높은 규칙이 먼저 적용됨)
                if rule.actions:
                    for key, value in rule.actions.items():
                        if key not in applied_actions:  # 이미 적용된 설정은 덮어쓰지 않음
                            applied_actions[key] = value
        
        return applied_actions
    
    def _check_conditions(self, queue_item: models.WorkQueueItem, conditions: Dict) -> bool:
        """
        조건 검사
        
        Args:
            queue_item: 검사할 항목
            conditions: 조건 딕셔너리
            
        Returns:
            모든 조건이 만족되면 True
        """
        if not conditions:
            return True  # 조건이 없으면 항상 참
        
        # source_type 조건
        if 'source_type' in conditions:
            allowed_sources = conditions['source_type']
            if isinstance(allowed_sources, list):
                if queue_item.source_type not in allowed_sources:
                    return False
            elif queue_item.source_type != allowed_sources:
                return False
        
        # workflow_id 조건
        if 'workflow_id' in conditions:
            allowed_workflows = conditions['workflow_id']
            if isinstance(allowed_workflows, list):
                if queue_item.source_workflow_id not in allowed_workflows:
                    return False
            elif queue_item.source_workflow_id != allowed_workflows:
                return False
        
        # quality_score_min 조건
        if 'quality_score_min' in conditions:
            min_score = conditions['quality_score_min']
            if queue_item.quality_score is None or queue_item.quality_score < min_score:
                return False
        
        # quality_score_max 조건
        if 'quality_score_max' in conditions:
            max_score = conditions['quality_score_max']
            if queue_item.quality_score is None or queue_item.quality_score > max_score:
                return False
        
        # duration_min 조건 (초 단위)
        if 'duration_min' in conditions:
            min_duration = conditions['duration_min']
            if queue_item.duration is None or queue_item.duration < min_duration:
                return False
        
        # duration_max 조건
        if 'duration_max' in conditions:
            max_duration = conditions['duration_max']
            if queue_item.duration is None or queue_item.duration > max_duration:
                return False
        
        # tags_include 조건 (포함해야 할 태그)
        if 'tags_include' in conditions:
            required_tags = conditions['tags_include']
            if not queue_item.tags:
                return False
            if isinstance(required_tags, list):
                if not any(tag in queue_item.tags for tag in required_tags):
                    return False
        
        # tags_exclude 조건 (포함하면 안 되는 태그)
        if 'tags_exclude' in conditions:
            excluded_tags = conditions['tags_exclude']
            if queue_item.tags:
                if isinstance(excluded_tags, list):
                    if any(tag in queue_item.tags for tag in excluded_tags):
                        return False
        
        # channel_id 조건
        if 'channel_id' in conditions:
            allowed_channels = conditions['channel_id']
            platform_config = queue_item.platform_configs or {}
            youtube_config = platform_config.get('youtube', {})
            current_channel = youtube_config.get('channel_id')
            
            if isinstance(allowed_channels, list):
                if current_channel not in allowed_channels:
                    return False
            elif current_channel != allowed_channels:
                return False
        
        return True  # 모든 조건 통과
    
    def apply_actions(self, queue_item: models.WorkQueueItem, actions: Dict[str, Any]):
        """
        액션을 WorkQueueItem에 적용
        
        Args:
            queue_item: 적용할 항목
            actions: 액션 딕셔너리
        """
        if 'approval_required' in actions:
            queue_item.approval_required = actions['approval_required']
        
        if 'upload_method' in actions:
            queue_item.upload_method = actions['upload_method']
        
        if 'upload_priority' in actions:
            queue_item.upload_priority = actions['upload_priority']
        
        if 'target_platforms' in actions:
            queue_item.target_platforms = actions['target_platforms']
        
        if 'platform_configs' in actions:
            # 기존 설정과 병합
            current_configs = queue_item.platform_configs or {}
            new_configs = actions['platform_configs']
            
            for platform, config in new_configs.items():
                if platform not in current_configs:
                    current_configs[platform] = {}
                current_configs[platform].update(config)
            
            queue_item.platform_configs = current_configs
        
        if 'scheduled_delay_minutes' in actions:
            queue_item.upload_delay_minutes = actions['scheduled_delay_minutes']
        
        logger.info(f"Applied actions to item {queue_item.id}: {actions}")
