import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from .database import SessionLocal
from . import models
from .swarm_coordinator import SwarmCoordinator
from .config import settings

logger = logging.getLogger(__name__)

class GlobalSwarmMaster:
    """
    The Supreme Coordinator for massive multi-channel scale-up.
    Orchestrates 20-30 independent channel cells.
    """
    def __init__(self):
        self.coordinator = SwarmCoordinator(settings)
        self.mission_semaphore = asyncio.Semaphore(5) # Default: 5 concurrent missions
        self.is_running = False

    async def start_monitoring_loop(self):
        """
        Main loop that checks all channels for production needs.
        """
        # [NEW] Initial cool-down to allow backend to bind port 8000 safely
        logger.info("📡 [Global Swarm Master] Monitoring Loop Initialized. Waiting 60s for system stability...")
        await asyncio.sleep(60)
        
        logger.info("📡 [Global Swarm Master] Monitoring Loop Started.")
        self.is_running = True
        
        while self.is_running:
            try:
                await self.reconcile_all_channels()
            except Exception as e:
                logger.error(f"❌ [Global Master] Error in reconcile loop: {e}")
            
            # Check every hour
            await asyncio.sleep(3600)

    async def reconcile_all_channels(self):
        """
        Iterates through all channels and decides who needs a mission.
        """
        with SessionLocal() as db:
            # Check Global Kill Switch
            config = db.query(models.GlobalSwarmConfig).first()
            if config and config.global_kill_switch:
                logger.warning("🛑 [Global Master] GLOBAL KILL SWITCH ACTIVE. Missions suspended.")
                return

            # Update concurrency limit from DB
            if config:
                self.mission_semaphore = asyncio.Semaphore(config.max_concurrent_missions)

            # Get all active autonomous channels that are NOT in 'RETIRING' phase
            channels = db.query(models.BrandChannel).filter(
                models.BrandChannel.is_autonomous_enabled == True,
                models.BrandChannel.is_active == True,
                models.BrandChannel.growth_phase != 'RETIRING' 
            ).all()

            logger.info(f"📋 [Global Master] Reconciling {len(channels)} autonomous channels.")

            for channel in channels:
                # Determine production frequency based on Growth Phase
                phase = channel.growth_phase or 'INCUBATING'
                
                # Default production interval (hours)
                if phase == 'INCUBATING':
                    interval_hours = 48  # 주 3~4회
                elif phase == 'REFINING':
                    interval_hours = 24  # 매일 1편
                elif phase == 'SCALED':
                    interval_hours = 8   # 매일 2~3편 (8시간마다 1편)
                else:
                    interval_hours = 24  # 기본값

                # Check if production is due
                last_run = channel.warmup_last_run  # Using warmup_last_run as proxy for last_produced_at for now
                if not last_run or (datetime.now() - last_run) > timedelta(hours=interval_hours):
                    asyncio.create_task(self.spawn_mission_for_channel(channel.id, phase))

    async def spawn_mission_for_channel(self, channel_id: int, phase: str):
        """
        Spawns a mission with resource arbitration (Semaphore).
        """
        async with self.mission_semaphore:
            logger.info(f"🚀 [Global Master] Spawning dedicated CELL mission for Channel #{channel_id} (Phase: {phase})")
            
            # Trigger factory run via SwarmCoordinator
            success = await self.coordinator.execute_mission_factory_run(
                channel_id=channel_id,
                format="shorts",
                quality_mode="auto"
            )
            
            if success:
                with SessionLocal() as db:
                    channel = db.query(models.BrandChannel).filter(models.BrandChannel.id == channel_id).first()
                    channel.warmup_last_run = datetime.now()
                    db.commit()
            
            # Wait a bit between spawns to stabilize load
            await asyncio.sleep(60)

global_master = GlobalSwarmMaster()

if __name__ == "__main__":
    # Test run
    asyncio.run(global_master.reconcile_all_channels())
