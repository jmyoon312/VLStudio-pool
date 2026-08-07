"""
Captain Data Collection Scheduler

Integrates CaptainDataCollector with APScheduler
"""
import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.services.captain_data_collector import CaptainDataCollector

logger = logging.getLogger(__name__)


class CaptainScheduler:
    """Captain 데이터 수집 스케줄러"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
    
    def start_scheduler(self):
        """스케줄러 시작 (비활성화 - 수동 새로고침만 사용)"""
        if self.is_running:
            logger.warning("Captain scheduler already running")
            return
        
        logger.info("Captain scheduler disabled - manual refresh only")
        
        # 모든 자동 스케줄 비활성화
        # 사용자가 수동으로 새로고침 버튼을 눌렀을 때만 데이터 갱신
        
        # # 1. 채널 기본 통계 (1시간마다) - DISABLED
        # self.scheduler.add_job(
        #     self._run_channel_stats_collection,
        #     trigger=IntervalTrigger(hours=1),
        #     id="captain_channel_stats",
        #     name="Captain Channel Stats Collection",
        #     replace_existing=True
        # )
        
        # # 2. 신규 영상 감지 (5분마다) - DISABLED
        # self.scheduler.add_job(
        #     self._run_new_video_detection,
        #     trigger=IntervalTrigger(minutes=5),
        #     id="captain_new_videos",
        #     name="Captain New Video Detection",
        #     replace_existing=True
        # )
        
        # # 3. 일일 메타데이터 업데이트 (자정) - DISABLED
        # self.scheduler.add_job(
        #     self._run_daily_metadata_update,
        #     trigger=CronTrigger(hour=0, minute=0),
        #     id="captain_daily_metadata",
        #     name="Captain Daily Metadata Update",
        #     replace_existing=True
        # )
        
        # # 4. 주간 아카이브 업데이트 (일요일 자정) - DISABLED
        # self.scheduler.add_job(
        #     self._run_weekly_archive_update,
        #     trigger=CronTrigger(day_of_week='sun', hour=0, minute=0),
        #     id="captain_weekly_archive",
        #     name="Captain Weekly Archive Update",
        #     replace_existing=True
        # )
        
        # # 5. 일일 통계 집계 (자정 10분) - DISABLED
        # self.scheduler.add_job(
        #     self._run_daily_stats_aggregation,
        #     trigger=CronTrigger(hour=0, minute=10),
        #     id="captain_daily_aggregation",
        #     name="Captain Daily Stats Aggregation",
        #     replace_existing=True
        # )
        
        # # 초기 실행 (10초 후) - DISABLED
        # self.scheduler.add_job(
        #     self._run_initial_collection,
        #     trigger='date',
        #     run_date=datetime.now() + timedelta(seconds=10),
        #     id="captain_initial_collection",
        #     name="Captain Initial Collection"
        # )
        
        # 스케줄러는 시작하지만 작업이 없음
        self.scheduler.start()
        self.is_running = True
        logger.info("[OK] Captain scheduler started (manual mode)")
    
    def stop_scheduler(self):
        """스케줄러 중지"""
        if not self.is_running:
            return
        
        self.scheduler.shutdown(wait=False)
        self.is_running = False
        logger.info("Captain data collection scheduler stopped")
    
    async def _run_channel_stats_collection(self):
        """채널 통계 수집 작업"""
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            await collector.collect_channel_stats()
        except Exception as e:
            logger.error(f"Channel stats collection failed: {e}")
        finally:
            db.close()
    
    async def _run_new_video_detection(self):
        """신규 영상 감지 작업"""
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            await collector.detect_new_videos()
        except Exception as e:
            logger.error(f"New video detection failed: {e}")
        finally:
            db.close()
    
    async def _run_daily_metadata_update(self):
        """일일 메타데이터 업데이트 작업"""
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            await collector.daily_metadata_update()
        except Exception as e:
            logger.error(f"Daily metadata update failed: {e}")
        finally:
            db.close()
    
    async def _run_weekly_archive_update(self):
        """주간 아카이브 업데이트 작업"""
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            await collector.weekly_archive_update()
        except Exception as e:
            logger.error(f"Weekly archive update failed: {e}")
        finally:
            db.close()
    
    async def _run_daily_stats_aggregation(self):
        """일일 통계 집계 작업"""
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            await collector.aggregate_daily_stats()
        except Exception as e:
            logger.error(f"Daily stats aggregation failed: {e}")
        finally:
            db.close()
    
    async def _run_initial_collection(self):
        """초기 데이터 수집 (앱 시작 시)"""
        logger.info("Running initial Captain data collection...")
        db = SessionLocal()
        try:
            collector = CaptainDataCollector(db)
            # 채널 통계만 수집 (빠른 초기화)
            await collector.collect_channel_stats()
        except Exception as e:
            logger.error(f"Initial collection failed: {e}")
        finally:
            db.close()


# Global instance
captain_scheduler = CaptainScheduler()
