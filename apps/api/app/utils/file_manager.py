import os
import shutil
import glob
from .path_utils import get_absolute_path

def delete_video_files(file_path: str, thumbnail_path: str = None):
    """
    Safely delete video and all related sidecar files (srt, json, etc.).
    Supports relative paths stored in DB.
    """
    if not file_path:
        return

    # --- Smart Path Resolution ---
    path = get_absolute_path(file_path)
    
    print(f"[Cleanup] Resolved path for deletion: {file_path} -> {path}")

    # 1. Delete all files matching the video base name (video.*, video.en.srt, etc.)
    try:
        directory = os.path.dirname(path)
        if os.path.exists(directory):
            # Base name without extension
            base_name = os.path.splitext(os.path.basename(path))[0]
            
            # Use glob to find ALL matching files starting with base_name in that directory
            pattern = os.path.join(directory, f"{glob.escape(base_name)}*")
            
            for f in glob.glob(pattern):
                try:
                    if os.path.isfile(f):
                        os.remove(f)
                        print(f"Deleted file: {f}")
                except Exception as e:
                    print(f"Failed to delete {f}: {e}")
            
            # --- Empty Folder Cleanup ---
            # If the directory is now empty, delete it too (if it's not a root folder)
            try:
                # Get backend root to prevent deleting system folders
                backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                downloads_root = os.path.join(backend_root, "downloads")
                
                # Check if it's a subfolder of downloads and not downloads itself
                if directory.startswith(downloads_root) and directory != downloads_root:
                    if not os.listdir(directory):
                        os.rmdir(directory)
                        print(f"🧹 Deleted empty directory: {directory}")
            except Exception as folder_e:
                print(f"Warning: Could not cleanup directory {directory}: {folder_e}")
                
        else:
            print(f"Directory not found for deletion: {directory}")
    except Exception as e:
        print(f"Error in delete_video_files logic: {e}")

    # 2. Explicitly delete thumbnail if provided
    if thumbnail_path:
        # [FIX] Use get_absolute_path for thumbnail as well
        t_path = get_absolute_path(thumbnail_path)
        
        if os.path.exists(t_path):
            try:
                os.remove(t_path)
                print(f"Deleted thumbnail file: {t_path}")
            except Exception as e:
                print(f"Error deleting thumbnail {t_path}: {e}")
