import os
import asyncio
import json
import logging
import uuid

logger = logging.getLogger(__name__)

class RemotionRenderer:
    def __init__(self, frontend_dir: str, media_root: str = None, base_url: str = "http://127.0.0.1:8000"):
        self.frontend_dir = frontend_dir
        self.media_root = media_root
        self.base_url = base_url.rstrip('/')

    async def render_video(self, composition_id: str, props: dict, output_path: str) -> str:
        """
        [DELEGATED] Triggers Remotion render command inside the sovereign-swarm container.
        This avoids duplicating Node.js/Chrome dependencies in the API container.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Resolve all paths in props to be absolute for context
        sanitized_props = self._sanitize_props(props)
        
        # Unique props file per render to avoid collisions
        render_id = uuid.uuid4().hex[:8]
        temp_props_path = os.path.join(self.frontend_dir, f"props_{render_id}.json")
        
        # Write props to the shared volume so swarm can see it
        with open(temp_props_path, "w", encoding="utf-8") as f:
            json.dump(sanitized_props, f)

        # Construct Remote Command
        # Note: We use 'docker exec' to call npx inside the swarm container
        cmd = [
            "docker", "exec", "sovereign-swarm", "sh", "-c",
            f"cd {self.frontend_dir} && npx remotion render src/remotion/Root.tsx {composition_id} {output_path} --props={temp_props_path} --pixel-format=yuv420p --crf=18 --quality=100 --gl=angle --concurrency=4 --browser-executable=/usr/bin/google-chrome --no-sandbox"
        ]

        logger.info(f"[FALLBACK] [Remote Render] Delegating to swarm: {' '.join(cmd)}")
        
        try:
            # Execute asynchronously
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode()
                logger.error(f"[FAIL] Remote Remotion Failed ({process.returncode}): {error_msg}")
                raise RuntimeError(f"Remote Remotion Render Failed: {error_msg}")
                
            logger.info(f"[OK] Remote Remotion Render Success: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"[FAIL] Remote Remotion Execution Error: {e}")
            raise
        finally:
            # Cleanup temp props
            if os.path.exists(temp_props_path):
                try: os.remove(temp_props_path)
                except: pass

    def _sanitize_props(self, props: dict) -> dict:
        import copy
        p = copy.deepcopy(props)
        
        def fix_path(path: str) -> str:
            if not path or not isinstance(path, str): return path
            # Convert absolute host paths to file:// for Remotion
            if path.startswith('/') and not path.startswith('file://'):
                return f"file://{path}"
            return path
            
        # Standard SovereignShorts structure - Deep sanitation
        if 'backgroundVideo' in p: p['backgroundVideo'] = fix_path(p['backgroundVideo'])
        if 'syncVideo' in p: p['syncVideo'] = fix_path(p['syncVideo'])
        if 'audio_src' in p: p['audio_src'] = fix_path(p['audio_src'])
        if 'bgm_src' in p: p['bgm_src'] = fix_path(p['bgm_src'])
        
        # EliteSequence: sanitize beat media_url fields
        if 'beats' in p and isinstance(p['beats'], list):
            for beat in p['beats']:
                if isinstance(beat, dict):
                    if beat.get('media_url'):
                        beat['media_url'] = fix_path(beat['media_url'])
                    if beat.get('asset_url'):
                        beat['asset_url'] = fix_path(beat['asset_url'])
                    if beat.get('thumbnail_url'):
                        beat['thumbnail_url'] = fix_path(beat['thumbnail_url'])
        
        # Also sanitize any image paths in the images array if exists
        if 'images' in p and isinstance(p['images'], list):
            p['images'] = [fix_path(img) for img in p['images']]
            
        return p
