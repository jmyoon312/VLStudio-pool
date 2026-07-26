import logging
import json
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from app import models

# Redis Client (Optional - graceful fallback if not installed/running)
redis_client = None
try:
    import redis as _redis_lib
    redis_client = _redis_lib.Redis(host='localhost', port=6379, db=0, decode_responses=True, socket_connect_timeout=1)
except ImportError:
    pass  # redis not installed - progress publishing disabled
except Exception:
    pass  # redis not running - progress publishing disabled
logger = logging.getLogger(__name__)


class UploadOrchestrator:
    """
    Central Logic for processing WorkQueueItems.
    Can be called by Celery Worker OR synchronously via BackgroundTasks.
    """
    
    def process_item(self, db: Session, queue_item_id: int, task_instance=None, force_ip_rotation: bool = False):
        """
        Main execution flow.
        task_instance: Optional Celery task instance for update_state calls.
        force_ip_rotation: If True, forces IP rotation before launch (Smart Batching Strategy).
        """
        try:
            # 1. 항목 조회 (Reusable)
            item = db.query(models.WorkQueueItem).filter(
                models.WorkQueueItem.id == queue_item_id
            ).first()
            
            if not item:
                logger.error(f"Queue item {queue_item_id} not found")
                return {"status": "error", "message": "Item not found"}
            
            # 2. 승인 확인
            if item.approval_status not in ["APPROVED", "AUTO_APPROVED"]:
                logger.warning(f"Item {queue_item_id} not approved, skipping")
                return {"status": "skipped", "message": "Not approved"}
            
            # 3. 상태 업데이트: UPLOADING
            item.status = "UPLOADING"
            item.upload_started_at = datetime.now()
            item.upload_progress = 0
            db.commit()
            
            self._publish_progress(queue_item_id, 0, "업로드 시작", task_instance)
            
            # Anti-Association Shield Configs
            platform_configs = item.platform_configs or {}
            yt_config = platform_configs.get('youtube', {})
            shield_cfg = yt_config.get('anti_association', {})
            shield_enabled = shield_cfg.get('enabled', False)
            
            # 3.4 Jitter Jumps
            if shield_enabled and shield_cfg.get('jitter_jumps', False):
                import random
                import time
                jitter_secs = random.randint(30, 900)
                self._publish_progress(queue_item_id, 2, f"🛡️ Jitter Jumps: {jitter_secs}초 지연 대기 중...", task_instance)
                logger.info(f"Jitter jumps enabled. Sleeping for {jitter_secs}s")
                time.sleep(jitter_secs)
            
            # 3.5 Apply Mutation (Sovereign Shield) [NEW]
            try:
                from app.services.video.mutation_engine import mutation_engine
                import os
                
                original_video_path = item.video_file_path
                if original_video_path and os.path.exists(original_video_path):
                    mutated_video_path = original_video_path.replace(".mp4", "_v65_shield.mp4")
                    channel_id = yt_config.get('channel_id', 'unknown_channel')
                    
                    intensity_str = shield_cfg.get('mutation_intensity', '0.5') if shield_enabled else '0.5'
                    intensity = float(intensity_str)
                    
                    if shield_enabled and intensity > 0.0:
                        self._publish_progress(queue_item_id, 5, f"🛡️ 알고리즘 교란 엔진 (강도 {intensity}) 적용 중...", task_instance)
                        success = mutation_engine.apply_mutation(original_video_path, mutated_video_path, channel_id=channel_id, intensity=intensity)
                        if success:
                            item.video_file_path = mutated_video_path
                            if item.video:
                                meta = dict(item.video.metadata_json) if item.video.metadata_json else {}
                                meta["saif_mutated"] = True
                                meta["mutated_at"] = datetime.now().isoformat()
                                item.video.metadata_json = meta
                            db.commit()
                            logger.info(f"🛡️ Sovereign Shield applied and flagged for item {queue_item_id}")
                        else:
                            logger.warning(f"Mutation failed for item {queue_item_id}, proceeding with original.")
                    elif shield_enabled and shield_cfg.get('metadata_scrub', False):
                        self._publish_progress(queue_item_id, 5, "🛡️ 메타데이터 파괴 중...", task_instance)
                        import subprocess
                        subprocess.run([
                            mutation_engine.ffmpeg, "-y", "-i", original_video_path, 
                            "-map_metadata", "-1", "-c", "copy", mutated_video_path
                        ], check=False, capture_output=True)
                        if os.path.exists(mutated_video_path):
                            item.video_file_path = mutated_video_path
                            db.commit()
            except Exception as mutation_err:
                logger.error(f"Mutation process error: {mutation_err}")

            # 3.7 [NEW] Dynamic SEO Optimization (Stage 9)
            try:
                if shield_enabled and shield_cfg.get('dynamic_seo', False):
                    from app.config.feature_flags import get_llm_client
                    llm = get_llm_client()
                    self._publish_progress(queue_item_id, 8, "✍️ 단계 9: AI 동적 SEO 최적화 중...", task_instance)
                    seo_prompt = f"Optimize this niche '{item.category}' for a viral video. Title, Description, and 5 hashtags. JSON format. Base Title: {item.title}"
                    seo_data = llm.generate_structured_response(seo_prompt)
                    if seo_data:
                        item.title = seo_data.get("title", item.title)
                        item.description = seo_data.get("description", item.description)
                        item.hashtags = seo_data.get("hashtags", item.hashtags)
                        db.commit()
                        logger.info(f"✨ SEO Optimized for item {queue_item_id}")
                elif not item.title or "Sovereign" in item.title:
                    from app.config.feature_flags import get_llm_client
                    llm = get_llm_client()
                    self._publish_progress(queue_item_id, 8, "✍️ 단계 9: 기본 제목 최적화 중...", task_instance)
                    seo_prompt = f"Optimize this niche '{item.category}' for a viral video. Title, Description, and 5 hashtags. JSON format."
                    seo_data = llm.generate_structured_response(seo_prompt)
                    if seo_data:
                        item.title = seo_data.get("title", item.title)
                        item.description = seo_data.get("description", item.description)
                        item.hashtags = seo_data.get("hashtags", item.hashtags)
                        db.commit()
            except Exception as seo_err:
                logger.error(f"SEO process error: {seo_err}")

            if shield_enabled and shield_cfg.get('smart_routing', False):
                force_ip_rotation = True

            # 4. 플랫폼별 업로드 실행
            results = {}
            total_platforms = len(item.target_platforms or ["youtube"])
            
            for idx, platform in enumerate(item.target_platforms or ["youtube"]):
                try:
                    # 진행률 계산 (각 플랫폼당 균등 분배)
                    base_progress = int((idx / total_platforms) * 100)
                    
                    logger.info(f"Uploading to {platform} for item {queue_item_id}")
                    
                    result = None
                    if platform == "youtube":
                        result = self._upload_to_youtube(item, db, task_instance, base_progress, force_ip_rotation)
                    elif platform == "tiktok":
                        result = self._upload_to_tiktok(item, db, task_instance, base_progress)
                    elif platform == "instagram":
                        result = self._upload_to_instagram(item, db, task_instance, base_progress)
                    else:
                        result = {"status": "error", "message": f"Unknown platform: {platform}"}
                    
                    results[platform] = result
                    
                    # 플랫폼 완료 진행률
                    platform_complete_progress = int(((idx + 1) / total_platforms) * 100)
                    item.upload_progress = platform_complete_progress
                    db.commit()
                    self._publish_progress(queue_item_id, platform_complete_progress, f"{platform} 업로드 완료", task_instance)
                    
                except Exception as e:
                    logger.error(f"Upload to {platform} failed: {e}")
                    results[platform] = {"status": "error", "message": str(e)}
            
            # 5. 결과 저장
            item.uploaded_urls = {k: v.get("url") for k, v in results.items() if v.get("url")}
            
            # 6. 최종 상태 결정
            if all(r.get("status") == "success" for r in results.values()):
                item.status = "COMPLETED"
                item.upload_progress = 100
                self._publish_progress(queue_item_id, 100, "업로드 완료", task_instance)
            else:
                item.status = "FAILED"
                item.failure_reason = json.dumps(results)
                self._publish_progress(queue_item_id, item.upload_progress, "업로드 실패", task_instance)
            
            item.upload_completed_at = datetime.now()
            db.commit()
            return {"status": "completed", "results": results}
            
        except Exception as e:
            logger.error(f"Orchestrator failed: {e}")
            if item:
                item.status = "FAILED"
                item.failure_reason = str(e)
                item.upload_completed_at = datetime.now()
                db.commit()
                self._publish_progress(queue_item_id, 0, f"시스템 오류: {str(e)}", task_instance)
            return {"status": "error", "message": str(e)}

    def _publish_progress(self, item_id, progress, message, task_instance=None):
        """Safe status update via Redis + Celery"""
        # 1. Update Celery State if exists
        if task_instance:
            try:
                task_instance.update_state(state='PROGRESS', meta={'current': progress, 'status': message})
            except: pass
            
        # 2. Publish to Redis (Best Effort)
        try:
            data = {
                "queue_item_id": item_id,
                "progress": progress,
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
            redis_client.publish(f"queue:{item_id}:progress", json.dumps(data))
        except Exception:
            # Redis down? Just ignore.
            pass

    def _upload_to_youtube(self, item, db, task_instance, base_progress, force_rotation=False):
        self._publish_progress(item.id, base_progress + 10, "YouTube 업로드 준비 중...", task_instance)
        
        try:
            if item.upload_method == 'BROWSER_AUTO':
                # Browser Automation
                logger.info("Executing BROWSER_AUTO upload strategy")
                from app.services.browser_uploader import browser_uploader
                
                # Pass force_rotation flag
                browser_uploader.upload_video(db, item.id, force_ip_rotation=force_rotation)
                
                db.refresh(item)
                if item.status in ('COMPLETED', 'VERIFYING'):
                    return {
                        "status": "success", 
                        "url": item.uploaded_urls.get('youtube') if item.uploaded_urls else "",
                        "message": "Browser Upload Success" if item.status == 'COMPLETED' else "Video uploaded as PRIVATE, awaiting verification before publishing"
                    }
                else:
                    return {"status": "error", "message": item.failure_reason or "Browser Upload Failed"}
            else:
                # API
                from app.services.youtube_uploader import youtube_uploader
                youtube_uploader.upload_video(db, item.id)
                
                db.refresh(item)
                if item.status == 'COMPLETED':
                    return {
                        "status": "success",
                        "url": item.uploaded_urls.get('youtube') if item.uploaded_urls else "",
                        "message": "API Upload Success"
                    }
                else:
                    return {"status": "error", "message": item.failure_reason or "API Upload Failed"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ... Helper implementations for TikTok/Instagram (Simplified copies from tasks.py) ...
    def _upload_to_tiktok(self, item, db, task_instance, base_progress):
        self._publish_progress(item.id, base_progress + 5, "TikTok 업로드 준비 중...", task_instance)
        try:
            from app.services.browser_session_manager import session_manager
            
            # Config extraction
            config = item.platform_configs.get("tiktok", {})
            account_id = config.get("account_id")
            
            if not account_id:
                return {"status": "error", "message": "TikTok Account ID not specified"}
                
            # Resolve Profile ID
            channel = db.query(models.TikTokChannel).filter(models.TikTokChannel.id == account_id).first()
            if not channel or not channel.browser_profile_id:
                 return {"status": "error", "message": "TikTok Channel not found or not linked to profile"}
            
            # Use Description as Caption + Hashtags
            caption = item.description or item.title
            hashtags = item.hashtags or []
            
            # Launch Upload
            self._publish_progress(item.id, base_progress + 20, "TikTok 브라우저 실행 중...", task_instance)
            result = session_manager.launch_tiktok_upload(
                profile_id=channel.browser_profile_id,
                db=db,
                video_path=item.video_file_path,
                caption=caption,
                hashtags=hashtags,
                privacy=config.get("privacy", "PUBLIC").upper()
            )
            
            return result
            
        except Exception as e:
            logger.error(f"TikTok Logic Failed: {e}")
            return {"status": "error", "message": str(e)}

    def _upload_to_instagram(self, item, db, task_instance, base_progress):
        self._publish_progress(item.id, base_progress + 5, "Instagram 업로드 준비 중...", task_instance)
        try:
            from app.services.browser_session_manager import session_manager
             
            # Config extraction
            config = item.platform_configs.get("instagram", {})
            account_id = config.get("account_id")
            
            if not account_id:
                return {"status": "error", "message": "Instagram Account ID not specified"}
                
            # Resolve Profile ID
            channel = db.query(models.InstagramChannel).filter(models.InstagramChannel.id == account_id).first()
            if not channel or not channel.browser_profile_id:
                 return {"status": "error", "message": "Instagram Channel not found or not linked to profile"}
            
            # Caption construction
            caption = config.get("caption") or item.description or item.title
            
            # Add hashtags to caption if Instagram usually puts them in caption
            if item.hashtags:
                tags_str = ' '.join([f'#{t}' for t in item.hashtags])
                caption = f"{caption}\n\n{tags_str}"
            
            # Launch Upload
            self._publish_progress(item.id, base_progress + 20, "Instagram 브라우저 실행 중...", task_instance)
            result = session_manager.launch_instagram_upload(
                profile_id=channel.browser_profile_id,
                db=db,
                video_path=item.video_file_path,
                caption=caption
            )
            
            return result

        except Exception as e:
            logger.error(f"Instagram Logic Failed: {e}")
            return {"status": "error", "message": str(e)}

upload_orchestrator = UploadOrchestrator()
