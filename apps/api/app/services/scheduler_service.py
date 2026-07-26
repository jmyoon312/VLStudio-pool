import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class WorkflowScheduler:
    """
    워크플로우 스케줄링 서비스
    APScheduler를 사용하여 Cron 기반 워크플로우 자동 실행
    """
    
    def __init__(self):
        # Job store 설정
        jobstores = {
            'default': MemoryJobStore()
        }
        
        # Scheduler 초기화
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            timezone='Asia/Seoul'
        )
        
        self.running = False
        logger.info("WorkflowScheduler initialized")
    
    def start(self):
        """스케줄러 시작"""
        if not self.running:
            self.scheduler.start()
            self.running = True
            logger.info("✅ WorkflowScheduler started")
    
    def shutdown(self):
        """스케줄러 종료"""
        if self.running:
            self.scheduler.shutdown()
            self.running = False
            logger.info("🛑 WorkflowScheduler stopped")
    
    def add_workflow_schedule(
        self,
        workflow_id: int,
        cron_expression: str,
        callback: Callable,
        **callback_kwargs
    ) -> str:
        """
        워크플로우 스케줄 추가
        
        Args:
            workflow_id: 워크플로우 ID
            cron_expression: Cron 표현식 (예: "0 9 * * *")
            callback: 실행할 함수
            **callback_kwargs: 콜백 함수에 전달할 인자
        
        Returns:
            job_id: 생성된 Job ID
        """
        job_id = f"workflow_{workflow_id}"
        
        try:
            # Cron 트리거 생성
            trigger = CronTrigger.from_crontab(cron_expression)
            
            # Job 추가
            self.scheduler.add_job(
                func=callback,
                trigger=trigger,
                id=job_id,
                name=f"Workflow {workflow_id}",
                replace_existing=True,
                kwargs=callback_kwargs
            )
            
            # 다음 실행 시간 계산
            next_run = self.get_next_run_time(job_id)
            
            logger.info(f"✅ Schedule added: Workflow {workflow_id}")
            logger.info(f"   Cron: {cron_expression}")
            logger.info(f"   Next run: {next_run}")
            
            return job_id
            
        except Exception as e:
            logger.error(f"❌ Failed to add schedule for workflow {workflow_id}: {e}")
            raise
    
    def remove_schedule(self, workflow_id: int) -> bool:
        """
        워크플로우 스케줄 제거
        
        Args:
            workflow_id: 워크플로우 ID
        
        Returns:
            성공 여부
        """
        job_id = f"workflow_{workflow_id}"
        
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"✅ Schedule removed: Workflow {workflow_id}")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Failed to remove schedule for workflow {workflow_id}: {e}")
            return False
    
    def pause_schedule(self, workflow_id: int) -> bool:
        """스케줄 일시 중지"""
        job_id = f"workflow_{workflow_id}"
        
        try:
            self.scheduler.pause_job(job_id)
            logger.info(f"⏸️ Schedule paused: Workflow {workflow_id}")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Failed to pause schedule for workflow {workflow_id}: {e}")
            return False
    
    def resume_schedule(self, workflow_id: int) -> bool:
        """스케줄 재개"""
        job_id = f"workflow_{workflow_id}"
        
        try:
            self.scheduler.resume_job(job_id)
            logger.info(f"▶️ Schedule resumed: Workflow {workflow_id}")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Failed to resume schedule for workflow {workflow_id}: {e}")
            return False
    
    def get_next_run_time(self, job_id: str) -> Optional[datetime]:
        """다음 실행 시간 조회"""
        try:
            job = self.scheduler.get_job(job_id)
            if job and job.next_run_time:
                return job.next_run_time
        except Exception as e:
            logger.warning(f"⚠️ Failed to get next run time for {job_id}: {e}")
        return None
    
    def get_schedule_info(self, workflow_id: int) -> Optional[Dict[str, Any]]:
        """스케줄 정보 조회"""
        job_id = f"workflow_{workflow_id}"
        
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                return {
                    "job_id": job.id,
                    "name": job.name,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger),
                    "pending": job.pending
                }
        except Exception as e:
            logger.warning(f"⚠️ Failed to get schedule info for workflow {workflow_id}: {e}")
        return None
    
    def list_all_schedules(self) -> list:
        """모든 스케줄 목록 조회"""
        jobs = self.scheduler.get_jobs()
        return [
            {
                "job_id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            for job in jobs
        ]


# Global scheduler instance
_scheduler_instance: Optional[WorkflowScheduler] = None

def get_scheduler() -> WorkflowScheduler:
    """싱글톤 스케줄러 인스턴스 반환"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = WorkflowScheduler()
    return _scheduler_instance
