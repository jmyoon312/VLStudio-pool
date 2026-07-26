from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os

router = APIRouter(tags=["studio"])

class CleanupRequest(BaseModel):
    file_paths: List[str]

@router.post("/cleanup")
def cleanup_files(request: CleanupRequest):
    """
    Delete files from studio_uploads folder.
    Only deletes files in studio_uploads for safety.
    """
    deleted = []
    errors = []
    
    for file_path in request.file_paths:
        if not file_path:
            continue
            
        # Safety check: only delete from studio_uploads
        if "studio_uploads" not in file_path:
            errors.append(f"Skipped (not in studio_uploads): {file_path}")
            continue
        
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                deleted.append(file_path)
                print(f"✓ Deleted: {os.path.basename(file_path)}")
            else:
                errors.append(f"File not found: {file_path}")
        except Exception as e:
            errors.append(f"Failed to delete {file_path}: {str(e)}")
    
    return {
        "deleted": deleted,
        "errors": errors,
        "deleted_count": len(deleted)
    }
