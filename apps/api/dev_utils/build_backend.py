import os
import subprocess
import sys

def build():
    print("[Build] Compiling FastAPI backend with PyInstaller...")
    
    # 1. Define paths
    api_dir = os.path.dirname(os.path.abspath(__file__))
    entry_point = os.path.join(api_dir, "app", "main.py")
    output_dir = os.path.abspath(os.path.join(api_dir, "..", "..", "dist-backend"))
    
    # Ensure dist-backend directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # 2. PyInstaller flags
    cmd = [
        "pyinstaller",
        "--onefile",
        "--name=api_server",
        f"--distpath={output_dir}",
        "--clean",
        # Include hidden imports for FastAPI, SQLAlchemy, SQLite, and optional utilities
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=sqlalchemy.sql.default_comparator",
        "--hidden-import=sqlite3",
        "--hidden-import=pydantic_settings",
        "--hidden-import=jinja2",
        # Include static datasets / JSON resources
        "--add-data=app/services/persona/persona_library.json;app/services/persona",
        # Set main.py as the build target
        entry_point
    ]
    
    print(f"[Build] Command: {' '.join(cmd)}")
    
    # Use python environment's pyinstaller
    pyinstaller_bin = os.path.join(api_dir, "..", "..", "venv", "Scripts", "pyinstaller.exe")
    if os.path.exists(pyinstaller_bin):
        cmd[0] = pyinstaller_bin
        
    subprocess.check_call(cmd, cwd=api_dir)
    print(f"[Build] Standalone backend compiled successfully to: {os.path.join(output_dir, 'api_server.exe')}")

if __name__ == "__main__":
    build()
