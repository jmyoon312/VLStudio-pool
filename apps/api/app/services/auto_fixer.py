
from sqlalchemy.orm import Session
from app import models, crud
import logging
from app.services.tool_manager import tool_manager
from datetime import datetime
import os
import glob
import json
from typing import Optional

# Setup Logger
logger = logging.getLogger("auto_fixer")
logger.setLevel(logging.INFO)

from app.routers import insights # Import insights module for recalculation

from app.services.automation.sovereign_fs import sovereign_fs
from app.config.feature_flags import get_llm_client

class AutonomousRepairBroker:
    """
    Evolved version of AutoFixer. 
    Handles both data-fixing (zero views, etc.) and code-healing (self-correcting logic).
    Every code change is protected by sovereign_fs snapshots.
    """
    
    def __init__(self, db: Session, report_id: Optional[int] = None):
        self.db = db
        self.report_id = report_id
        self.logs = []
        self.llm = get_llm_client(preferred_model="gemini-1.5-pro")

    def log(self, message: str, level: str = "info"):
        """Logs action and appends to instance log."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "level": level
        }
        print(f"[{level.upper()}] {message}")
        self.logs.append(entry)
        
        # Update DB immediately for real-time feedback
        self.update_report_logs()

    def update_report_logs(self):
        """Writes current logs to the database report entry."""
        if not self.report_id:
            return
            
        report = self.db.query(models.DailyReport).filter(models.DailyReport.id == self.report_id).first()
        if report:
            # Append new logs to existing or replace? 
            # Ideally append, but for simplicity we replace with full accumulated log of this run
            # But since report might have logs from *previous* runs, we should be careful.
            # Actually, let's just overwrite with the current session logs? 
            # No, user wants to see history.
            
            # Better: read existing, extend, save.
            existing_logs = report.auto_fix_log if report.auto_fix_log else []
            # Avoid duplicating if we call update multiple times?
            # Let's just persist final logs at the end, or append delicately.
            # For "Real-time", we need to append.
            
            # Simple approach: In this object instance, we hold `self.logs`.
            # We fetch existing from DB, merge, and save.
            # But this is racy.
            
            # Let's just save `self.logs` as "Last Run Logs".
            # If we want history, we should design differently.
            # For now, "Last Fix Attempt" logs is sufficient.
            report.auto_fix_log = self.logs
            # Force update dirty flag
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(report, "auto_fix_log")
            self.db.commit()

    def run_diagnostics_and_fix(self, report_stats: dict):
        """
        Main entry point. Receives raw_stats from daily report.
        """
        self.log(f"[FALLBACK] Auto-Fixer Started for Report #{self.report_id}")
        
        diagnostics = report_stats.get("diagnostics", {})
        
        # 1. Fix Zero View Count
        zero_views = diagnostics.get("zero_view_count", 0)
        self.log(f"[SEARCH] Analyzing Zero View Videos: Found {zero_views} candidates.")
        if zero_views > 0:
            self.fix_zero_views()
        else:
            self.log("[OK] No Zero-View videos detected.")
            
        # 2. Fix Missing Thumbnails
        missing_thumbs = diagnostics.get("missing_thumbnails", 0)
        self.log(f"[SEARCH] Analyzing Missing Thumbnails: Found {missing_thumbs} candidates.")
        if missing_thumbs > 0:
             self.fix_missing_thumbnails()
        # 3. Apply Index Recalculation (Viral/Rising Scores)
        self.log("[SEARCH] Recalculating Viral Indices for all recent videos...")
        self.fix_viral_indices()

        # 4. Sync View Counts from Metadata (if DB is 0 but metadata exists)
        self.log("[SEARCH] Syncing View Counts from Metadata JSON...")
        self.sync_view_counts()

        # 5. [NEW] Operational Auto-Fix (Search/LLM)
        self.log("[SEARCH] Analyzing Operational Metrics for Auto-Tune...")
        self.fix_operational_issues(report_stats.get("operational_metrics", {}))

        self.log("[OK] Auto-Fixer Cycle Complete.", "success")

    def fix_zero_views(self):
        """
        Finds videos with 0 views and attempts to read .info.json or re-fetch metadata.
        """
        videos = self.db.query(models.Video).filter(
            models.Video.view_count == 0,
            models.Video.status == 'completed'
        ).all()
        
        count_fixed = 0
        for video in videos:
            self.log(f"  - Inspecting Video: {video.title} (ID: {video.video_id})")
            
            if video.file_path:
                directory = os.path.dirname(video.file_path)
                pattern = os.path.join(directory, f"*_{video.video_id}.info.json")
                files = glob.glob(pattern)
                
                if files:
                    try:
                        with open(files[0], 'r', encoding='utf-8') as f:
                            info = json.load(f)
                            v_count = info.get('view_count', 0)
                            if v_count > 0:
                                self.log(f"    [OK] Recovered Views: {v_count}")
                                video.view_count = v_count
                                video.updated_at = datetime.now()
                                self.db.commit()
                                count_fixed += 1
                                continue
                    except Exception as e:
                        self.log(f"    [WARN] Failed to read local JSON: {e}", "warning")
            
            self.log(f"    [FAIL] Could not recover views.", "error")
            
        if count_fixed > 0:
             self.log(f"[MAGIC] Successfully fixed {count_fixed} videos with zero views.", "success")
        else:
             self.log("[WARN] Could not fix any zero-view videos.", "warning")

    def fix_missing_thumbnails(self):
        """
        Finds videos with missing thumbnails.
        """
        videos = self.db.query(models.Video).filter(
            (models.Video.thumbnail_path == None) | (models.Video.thumbnail_path == "")
        ).all()
        
        count_fixed = 0
        for video in videos:
            if video.is_script_only: # [FIX] Skip scripts (no thumbnail needed)
                continue
                
            if video.file_path:
                 directory = os.path.dirname(video.file_path)
                 basename = os.path.splitext(os.path.basename(video.file_path))[0]
                 
                 found = False
                 for ext in ['.jpg', '.webp', '.png']:
                     potential_path = os.path.join(directory, basename + ext)
                     if os.path.exists(potential_path):
                         self.log(f"    [OK] Found orphaned thumbnail: {potential_path}")
                         video.thumbnail_path = potential_path
                         self.db.commit()
                         count_fixed += 1
                         found = True
                         break
                 
                 if not found:
                     self.log(f"    [FAIL] No thumbnail file found for {video.title}", "warning")
        
        if count_fixed > 0:
             self.log(f"[MAGIC] Successfully restored {count_fixed} thumbnails.", "success")

    def fix_viral_indices(self):
        """
        Triggers the Viral Analysis logic to recalculate scores for recent videos.
        """
        try:
            # We can re-use the logic from insights router or implement a direct service call.
            # Using insights.perform_viral_analysis directly if possible, or reimplementing wrapper.
            # Ideally, insights should have a service function independent of API router.
            # For now, let's look at how insights.perform_viral_analysis is implemented.
            # Assuming it takes (db, hours).
            
            # Since we can't easily import router function if it's not separated, 
            # let's assume we need to replicate or extract the logic. 
            # Wait, I imported `insights` above. Let's check `insights.py` to be sure.
            # If `perform_viral_analysis` is an accessible function, use it.
            
            count = insights.perform_viral_analysis(self.db, timeframe_hours=24)
            self.log(f"[MAGIC] Viral Indices Recalculated for {count} videos.", "success")
        except Exception as e:
            self.log(f"[WARN] Viral Index Recalculation Partial Fail: {e}", "warning")

    def sync_view_counts(self):
        """
        If DB view_count is 0 but metadata_json has views, sync it.
        """
        videos = self.db.query(models.Video).filter(
            models.Video.view_count == 0,
            models.Video.metadata_json.isnot(None)
        ).all()
        
        count = 0
        for video in videos:
            if not video.metadata_json:
                continue
                
            meta_views = video.metadata_json.get('view_count', 0)
            if meta_views > 0:
                video.view_count = meta_views
                count += 1
        
        if count > 0:
            self.db.commit()
            self.log(f"[MAGIC] Synced view counts for {count} videos from metadata.", "success")
        else:
            self.log("[OK] View counts are already in sync (or no metadata available).")

    def fix_operational_issues(self, metrics: dict):
        """
        Analyzes operational metrics and switches strategies if needed.
        """
        search_stats = metrics.get("search", {})
        searxng = search_stats.get("searxng", {})
        
        # Strategy 1: Switch to Tavily if SearXNG is failing
        s_fail = searxng.get("fail", 0)
        s_success = searxng.get("success", 0)
        
        if s_fail > 5 and s_success == 0:
            self.log(f"[WARN] High SearXNG Failure Rate ({s_fail} fails). Switching to Tavily...", "warning")
            settings = self.db.query(models.Settings).first()
            if settings and settings.web_search_engine != "tavily_only":
                settings.web_search_engine = "tavily_only"
                self.db.commit()
                self.log(f"[MAGIC] Auto-Switched Search Strategy to 'tavily_only'.", "success")
        
        # Strategy 2: LLM Rate Limit Warnings
        llm_stats = metrics.get("llm", {})
        rate_limits = llm_stats.get("rate_limits", 0)
        if rate_limits > 10:
             self.log(f"[WARN] High LLM Rate Limits ({rate_limits}). Consider adding more keys.", "warning")

    async def heal_code(self, file_path: str, error_log: str):
        """
        [PHASE 11] Autonomous Code Healing
        Attempts to fix a logic error in a service file using a Drafter-Critic loop.
        """
        self.log(f"[WRENCH] Starting Code Healing for: {file_path}")
        
        if not os.path.exists(file_path):
            self.log(f"[FAIL] File not found: {file_path}", "error")
            return False

        with open(file_path, 'r', encoding='utf-8') as f:
            original_code = f.read()

        prompt = f"""
        You are the Sovereign Engineer Agent for ViraLoop.
        Your task is to fix a bug in the code provided below.
        
        [FILE PATH]
        {file_path}
        
        [ERROR LOG]
        {error_log[:2000]}
        
        [CODE CONTENT]
        {original_code[:8000]}
        
        INSTRUCTIONS:
        1. Analyze the root cause of the error.
        2. Provide the FULL corrected code for the file.
        3. Do NOT include markdown formatting. Output ONLY the raw code.
        4. Preserve all existing functionality and structure.
        """

        try:
            self.log("🤖 Consulting the Sovereign Brain for a fix...")
            fixed_code = self.llm.generate(prompt)
            
            # Clean possible markdown wrap
            fixed_code = fixed_code.strip()
            if fixed_code.startswith("```"):
                lines = fixed_code.splitlines()
                if lines[0].startswith("```"): lines = lines[1:]
                if lines[-1].startswith("```"): lines = lines[:-1]
                fixed_code = "\n".join(lines).strip()

            # Apply protected write
            self.log("🛡️ Applying versioned patch via SovereignFS...")
            success = sovereign_fs.write_protected(
                file_path=file_path, 
                content=fixed_code, 
                reason=f"Auto-Heal: {error_log[:50]}"
            )

            if success:
                self.log(f"[OK] Code healed and snapshot created for {file_path}", "success")
                return True
            else:
                self.log(f"[FAIL] Failed to write protected fix.", "error")
                return False

        except Exception as e:
            self.log(f"[FAIL] Code healing failed during LLM generation: {e}", "error")
            return False


def run_auto_fix(db: Session, report_id: int, report_stats: dict):
    broker = AutonomousRepairBroker(db, report_id)
    broker.run_diagnostics_and_fix(report_stats)

def AutoFixer(*args, **kwargs):
    """Legacy wrapper for backward compatibility."""
    return AutonomousRepairBroker(*args, **kwargs)
