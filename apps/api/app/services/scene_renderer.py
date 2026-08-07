"""
Scene Renderer Service
Captures Live Studio scenes using Puppeteer for full rendering including text, widgets, and animations.
"""

import asyncio
import os
import subprocess
import tempfile
from typing import Optional
from pyppeteer import launch


async def capture_scene_clip(
    scene_url: str,
    duration_seconds: int = 10,
    output_path: str = "scene_clip.mp4",
    width: int = 1280,
    height: int = 720,
    fps: int = 30,
    scene_data: Optional[dict] = None
) -> str:
    """
    Capture a Live Studio scene clip using Puppeteer.
    
    Args:
        scene_url: URL to the Live Studio scene
        duration_seconds: Duration
        output_path: Path to MP4
        width: Width
        height: Height
        fps: FPS
        scene_data: Optional dict of scene data to inject via store
    """
    print(f"[VIDEO] Starting scene capture: {scene_url}")
    print(f"📐 Resolution: {width}x{height} @ {fps}fps")
    print(f"[TIME]  Duration: {duration_seconds}s")
    
    browser = None
    temp_webm = None
    
    try:
        # Find System Chrome (Cross-platform support)
        executable_path = None
        import platform
        system = platform.system()
        
        if system == "Windows":
            possible_paths = [
                os.getenv("CHROME_PATH"),
                os.getenv("EDGE_PATH"),
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            ]
        else:  # Linux/WSL2
            possible_paths = [
                os.getenv("CHROME_PATH"),
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/snap/bin/chromium",
                # WSL Mounts
                "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
                "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
                "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
            ]
        
        # Filter None values from env vars
        possible_paths = [p for p in possible_paths if p]
        
        for path in possible_paths:
            if os.path.exists(path):
                executable_path = path
                print(f"[OK] Found system browser: {path}")
                break
        
        if not executable_path:
            print("[WARN] No system browser found. Will use default (puppeteer/chromium).")
        
        launch_args = {
            'headless': True,
            'handleSIGINT': False,
            'handleSIGTERM': False,
            'handleSIGHUP': False,
            'args': [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--ignore-gpu-blocklist',  # Force GPU
                '--disable-web-security',  # Allow local file access
                f'--window-size={width},{height}',
                '--autoplay-policy=no-user-gesture-required'
            ]
        }

        if executable_path:
            launch_args['executablePath'] = executable_path
            
        # Launch headless browser
        browser = await launch(**launch_args)
        
        page = await browser.newPage()
        await page.setViewport({'width': width, 'height': height})
        
        print(f"[WEB] Loading page: {scene_url}")
        # Load Live Studio page
        await page.goto(scene_url, {'waitUntil': 'networkidle0', 'timeout': 120000})  # 2min timeout
        
        # Inject Scene Data if provided (Hydrate Store)
        if scene_data:
            import json
            print("💉 Injecting scene data into Puppeteer...")
            scene_json = json.dumps(scene_data)
            injection_script = f"""
            (function() {{
                try {{
                    const store = window.lofiStudioStore;
                    if (store) {{
                        const scene = {scene_json};
                        // Use loadFromStation to hydrate scene + playlist
                        store.getState().loadFromStation({{ scene: scene, playlist: scene.playlist || [] }});
                        console.log("[OK] Scene injected successfully via Puppeteer");
                        // Force setActiveScene just in case
                        store.getState().setActiveScene(scene.id);
                        return true;
                    }} else {{
                        console.error("[FAIL] window.lofiStudioStore not found");
                        return false;
                    }}
                }} catch (e) {{
                    console.error("[FAIL] Scene injection failed:", e);
                    return false;
                }}
            }})();
            """
            await page.evaluate(injection_script)
            # Short sleep to allow React state to settle
            await asyncio.sleep(2)
        
        # Wait for canvas to be ready
        await page.waitForSelector('canvas', {'timeout': 60000})
        print("[OK] Canvas found")
        
        # Create temporary file for WebM
        temp_webm = tempfile.NamedTemporaryFile(suffix='.webm', delete=False).name
        
        # Start recording using MediaRecorder API
        print(f"🎥 Starting recording for {duration_seconds}s...")
        
        recording_script = f"""
        async () => {{
            const canvas = document.querySelector('canvas');
            if (!canvas) throw new Error('Canvas not found');
            
            const stream = canvas.captureStream({fps});
            const recorder = new MediaRecorder(stream, {{
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 8000000
            }});
            
            const chunks = [];
            
            return new Promise((resolve, reject) => {{
                recorder.ondataavailable = e => {{
                    if (e.data.size > 0) {{
                        chunks.push(e.data);
                    }}
                }};
                
                recorder.onstop = async () => {{
                    const blob = new Blob(chunks, {{type: 'video/webm'}});
                    const reader = new FileReader();
                    reader.onloadend = () => {{
                        resolve(reader.result.split(',')[1]); // Base64 data
                    }};
                    reader.readAsDataURL(blob);
                }};
                
                recorder.onerror = e => reject(e);
                
                recorder.start();
                
                // Stop after duration
                setTimeout(() => {{
                    recorder.stop();
                }}, {duration_seconds * 1000});
            }});
        }}
        """
        
        # Execute recording
        base64_data = await page.evaluate(recording_script)
        
        # Save WebM file
        import base64
        webm_data = base64.b64decode(base64_data)
        with open(temp_webm, 'wb') as f:
            f.write(webm_data)
        
        print(f"[OK] Recording saved to: {temp_webm}")
        
        # Close browser
        await browser.close()
        browser = None
        
        # Convert WebM to MP4 using FFmpeg
        print(f"[REFRESH] Converting WebM to MP4...")
        
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-i', temp_webm,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',  # Compatibility
            output_path
        ]
        
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg conversion failed: {result.stderr}")
        
        print(f"[OK] MP4 saved to: {output_path}")
        
        return output_path
        
    except Exception as e:
        print(f"[FAIL] Scene capture failed: {e}")
        raise
        
    finally:
        # Cleanup
        if browser:
            await browser.close()
        if temp_webm and os.path.exists(temp_webm):
            try:
                os.remove(temp_webm)
            except:
                pass


def capture_scene_sync(
    scene_url: str,
    duration_seconds: int = 10,
    output_path: str = "scene_clip.mp4",
    width: int = 1280,
    height: int = 720,
    fps: int = 30,
    scene_data: Optional[dict] = None
) -> str:
    """
    Synchronous wrapper for capture_scene_clip.
    """
    return asyncio.run(capture_scene_clip(
        scene_url=scene_url,
        duration_seconds=duration_seconds,
        output_path=output_path,
        width=width,
        height=height,
        fps=fps,
        scene_data=scene_data
    ))
