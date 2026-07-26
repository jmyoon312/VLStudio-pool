from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models
from app.services import report_generator

router = APIRouter(tags=["Reports"])

@router.get("/ping")
def ping():
    return {"status": "pong"}

@router.get("/")
def read_reports(skip: int = 0, limit: int = 30, db: Session = Depends(get_db)):
    """List daily reports."""
    return crud.get_daily_reports(db, skip=skip, limit=limit)

@router.get("/latest")
def get_latest_report(db: Session = Depends(get_db)):
    """Get the most recent report."""
    report = crud.get_latest_daily_report(db)
    if not report:
        raise HTTPException(status_code=404, detail="No reports found")
    return report

@router.post("/generate")
def generate_report_manually(db: Session = Depends(get_db)):
    """Manually trigger today's report generation."""
    success = report_generator.generate_daily_report(db)
    if not success:
         raise HTTPException(status_code=500, detail="Generation failed")
    
    # Return the newly created report
    return crud.get_latest_daily_report(db)

@router.put("/{report_id}/read")
def mark_as_read(report_id: int, db: Session = Depends(get_db)):
    """Mark report as read."""
    report = crud.mark_report_read(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

from typing import List
from fastapi import Query

@router.delete("/")
def delete_reports(ids: List[int] = Query(...), db: Session = Depends(get_db)):
    """Bulk delete reports."""
    print(f"DEBUG: Received DELETE request for IDs: {ids}")
    count = crud.delete_daily_reports(db, ids)
    print(f"DEBUG: Deleted {count} reports")
    print(f"DEBUG: Deleted {count} reports")
    return {"status": "success", "deleted": count}

@router.post("/{report_id}/fix")
def run_auto_fix_manual(report_id: int, db: Session = Depends(get_db)):
    """Manually trigger auto-fix for a specific report."""
    report = crud.get_daily_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    from app.services.auto_fixer import run_auto_fix
    
    # We pass the raw stats from the report to re-analyze
    # Or should we re-fetch current DB stats? 
    # Auto-fixer relies on report_stats['diagnostics'].
    # If the report is old, the diagnostics might be stale.
    # However, '0 views' is a persistent state until fixed.
    # So using the report diagnostics is a good starting point.
    # But if the user manually fixes it, re-running based on old report might be redundant but harmless.
    # Let's run it.
    
    run_auto_fix(db, report.id, report.raw_stats_json)
    
    # Refresh to return updated logs
    db.refresh(report)
    return report
