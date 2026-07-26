from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
import os
import mimetypes

router = APIRouter(tags=["files"])

@router.get("/stream")
async def stream_file(path: str = Query(..., description="Absolute path to the file")):
    """
    Streams a local file.
    """
    import urllib.parse
    
    # [DEBUG] Log entry
    print(f"DEBUG: /files/stream called with path: '{path}'")

    # Robustness: Strip quotes (browser/curl sometimes add them)
    path = path.strip("\"'")
    
    # Normalize Windows paths
    path = os.path.normpath(path)
    
    if not os.path.exists(path):
        # Fallback: Try unquoting (in case of double encoding)
        decoded_path = urllib.parse.unquote(path)
        decoded_path = os.path.normpath(decoded_path)
        
        if os.path.exists(decoded_path):
            path = decoded_path
        else:
            print(f"DEBUG: Stream 404 - File not found: '{path}' (Original) / '{decoded_path}' (Decoded)")
            print(f"DEBUG: Path repr: {repr(path)}")
            # Raise 404
            raise HTTPException(status_code=404, detail=f"File not found: {path} (repr: {repr(path)})")

    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail="Path is not a file")

    # Guess media type
    media_type, _ = mimetypes.guess_type(path)
    if not media_type:
        media_type = "application/octet-stream"

    return FileResponse(path, media_type=media_type)
