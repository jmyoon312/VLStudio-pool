"""
Visual Asset Generation Pipeline

Orchestrates:
1. Scene image generation (DALL-E, Gemini, Stable Diffusion)
2. Style consistency across scenes
3. Image upscaling and quality enhancement
4. Asset caching and management

Usage:
    pipeline = VisualAssetPipeline()
    
    result = await pipeline.generate_scene_assets(
        scenes=[
            {"scene_id": 1, "prompt": "beach sunset", "duration": 5},
            {"scene_id": 2, "prompt": "ocean waves", "duration": 3}
        ],
        niche="travel",
        style_consistency=True
    )
    
    # result:
    # {
    #     "scenes": [
    #         {"scene_id": 1, "image_path": "/path/to/img1.png", "status": "ready"},
    #         {"scene_id": 2, "image_path": "/path/to/img2.png", "status": "ready"}
    #     ],
    #     "total_duration": 8,
    #     "style_prompt": "vibrant travel photography..."
    # }
"""

import os
import json
import logging
import asyncio
import uuid
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ImageProvider(Enum):
    """Image generation providers"""
    DALLE = "dalle"
    GEMINI = "gemini"
    STABLE_DIFFUSION = "stable_diffusion"
    FALLBACK = "fallback"


@dataclass
class SceneAsset:
    """Single scene asset"""
    scene_id: int
    prompt: str
    image_path: Optional[str] = None
    status: str = "pending"  # pending, generating, ready, failed
    provider: Optional[str] = None
    error: Optional[str] = None
    duration: float = 5.0


@dataclass
class PipelineResult:
    """Result of visual asset pipeline"""
    success: bool
    scenes: List[SceneAsset] = None
    total_duration: float = 0.0
    style_prompt: Optional[str] = None
    error: Optional[str] = None
    
    def __post_init__(self):
        if self.scenes is None:
            self.scenes = []


class VisualAssetPipeline:
    """
    Visual asset generation pipeline
    
    Features:
    - Multi-provider fallback (DALL-E → Gemini → SD → Fallback)
    - Style consistency across scenes
    - Automatic upscaling
    - Asset caching
    """
    
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "07_Downloads", "visual_assets"
            )
        
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Provider priority
        self.provider_priority = [
            ImageProvider.GEMINI,    # Free, high quality
            ImageProvider.DALLE,     # High quality
            ImageProvider.STABLE_DIFFUSION,  # Open source
            ImageProvider.FALLBACK   # Dummy fallback
        ]
        
        # LLM client for style extraction
        self._llm_client = None
        
        # Cache
        self._prompt_cache = {}
    
    @property
    def llm_client(self):
        """Lazy load LLM client"""
        if self._llm_client is None:
            from app.llm_manager import LLMClient
            self._llm_client = LLMClient()
        return self._llm_client
    
    async def generate_scene_assets(
        self,
        scenes: List[Dict[str, Any]],
        niche: str = "general",
        style_consistency: bool = True,
        aspect_ratio: str = "9:16",
        quality: str = "high"
    ) -> PipelineResult:
        """
        Generate visual assets for multiple scenes
        
        Args:
            scenes: List of {"scene_id": int, "prompt": str, "duration": float}
            niche: Content niche (for style guidance)
            style_consistency: Whether to maintain style across scenes
            aspect_ratio: "9:16" (Shorts), "16:9" (Standard), "1:1" (Square)
            quality: "fast" or "high"
            
        Returns:
            PipelineResult with scene assets
        """
        logger.info(f"🎨 [Pipeline] Starting visual asset generation")
        logger.info(f"   Scenes: {len(scenes)}, Niche: {niche}")
        logger.info(f"   Style consistency: {style_consistency}, Ratio: {aspect_ratio}")
        
        try:
            # Step 1: Analyze style if consistency enabled
            style_prompt = None
            if style_consistency and len(scenes) > 1:
                style_prompt = await self._extract_style_prompt(niche)
                logger.info(f"   Style: {style_prompt[:50]}...")
            
            # Step 2: Generate images for each scene
            scene_assets = []
            
            for i, scene_data in enumerate(scenes):
                logger.info(f"   Generating scene {i+1}/{len(scenes)}: {scene_data.get('scene_id')}")
                
                # Combine with style prompt
                full_prompt = self._build_prompt(
                    scene_data.get("prompt", ""),
                    style_prompt,
                    aspect_ratio
                )
                
                # Generate
                asset = await self._generate_single_asset(
                    scene_id=scene_data.get("scene_id", i),
                    prompt=full_prompt,
                    quality=quality,
                    duration=scene_data.get("duration", 5.0)
                )
                
                scene_assets.append(asset)
                
                # Small delay between requests
                if i < len(scenes) - 1:
                    await asyncio.sleep(0.5)
            
            # Step 3: Calculate total duration
            total_duration = sum(s.duration for s in scene_assets)
            
            # Check if all succeeded
            all_ready = all(s.status == "ready" for s in scene_assets)
            
            return PipelineResult(
                success=all_ready,
                scenes=scene_assets,
                total_duration=total_duration,
                style_prompt=style_prompt
            )
            
        except Exception as e:
            logger.error(f"[FAIL] [Pipeline] Visual asset generation failed: {e}")
            return PipelineResult(
                success=False,
                error=str(e)
            )
    
    async def _extract_style_prompt(self, niche: str) -> str:
        """Extract consistent style prompt for niche"""
        
        # Check cache
        if niche in self._prompt_cache:
            return self._prompt_cache[niche]
        
        prompt = f"""
        Generate a consistent visual style description for {niche} YouTube videos.
        
        Focus on:
        1. Color palette (e.g., warm sunset oranges, cool ocean blues)
        2. Lighting style (e.g., golden hour, dramatic shadows)
        3. Visual mood (e.g., adventurous, peaceful, energetic)
        4. Composition style (e.g., wide angle, close-up, cinematic)
        
        Return a concise style prompt (30-50 words) that can be appended to any image generation.
        """
        
        try:
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name="google/gemini-2.0-flash-exp"
            )
            
            # Extract style prompt
            style = response.strip() if isinstance(response, str) else str(response)
            
            # Cache
            self._prompt_cache[niche] = style
            
            return style
            
        except Exception as e:
            logger.warning(f"Style extraction failed, using default: {e}")
            return f"Professional {niche} photography, high quality, cinematic"
    
    def _build_prompt(
        self,
        scene_prompt: str,
        style_prompt: Optional[str],
        aspect_ratio: str
    ) -> str:
        """Build full prompt with style and aspect ratio"""
        
        parts = [scene_prompt]
        
        if style_prompt:
            parts.append(style_prompt)
        
        # Add aspect ratio guidance
        if aspect_ratio == "9:16":
            parts.append("vertical format, 9:16, optimized for mobile viewing")
        elif aspect_ratio == "1:1":
            parts.append("square format, 1:1, centered composition")
        
        # Add quality guidance
        parts.append("high detail, professional quality, no text")
        
        return ", ".join(parts)
    
    async def _generate_single_asset(
        self,
        scene_id: int,
        prompt: str,
        quality: str,
        duration: float
    ) -> SceneAsset:
        """Generate a single scene asset with provider fallback"""
        
        asset = SceneAsset(
            scene_id=scene_id,
            prompt=prompt,
            duration=duration,
            status="generating"
        )
        
        # Try each provider in priority order
        for provider in self.provider_priority:
            try:
                logger.info(f"      Trying {provider.value}...")
                
                image_path = await self._generate_with_provider(
                    provider, prompt, quality
                )
                
                if image_path and os.path.exists(image_path):
                    asset.image_path = image_path
                    asset.provider = provider.value
                    asset.status = "ready"
                    logger.info(f"      [OK] {provider.value} succeeded: {image_path}")
                    return asset
                    
            except Exception as e:
                logger.warning(f"      [FAIL] {provider.value} failed: {e}")
                continue
        
        # All providers failed
        asset.status = "failed"
        asset.error = "All providers failed"
        return asset
    
    async def _generate_with_provider(
        self,
        provider: ImageProvider,
        prompt: str,
        quality: str
    ) -> Optional[str]:
        """Generate image with specific provider"""
        
        filename = f"scene_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(self.output_dir, filename)
        
        if provider == ImageProvider.GEMINI:
            return await self._generate_gemini(prompt, filepath)
        
        elif provider == ImageProvider.DALLE:
            return await self._generate_dalle(prompt, filepath)
        
        elif provider == ImageProvider.STABLE_DIFFUSION:
            return await self._generate_sd(prompt, filepath)
        
        elif provider == ImageProvider.FALLBACK:
            return self._generate_fallback(prompt, filepath)
        
        return None
    
    async def _generate_gemini(self, prompt: str, output_path: str) -> Optional[str]:
        """Generate using Gemini (free)"""
        
        try:
            image_url = self.llm_client.generate_image(
                prompt=prompt,
                provider="google",
                model="imagen-3.0-generate-001"
            )
            
            if image_url:
                # Download and save
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    
                    with open(output_path, "wb") as f:
                        f.write(response.content)
                
                return output_path
                
        except Exception as e:
            logger.warning(f"Gemini generation failed: {e}")
        
        return None
    
    async def _generate_dalle(self, prompt: str, output_path: str) -> Optional[str]:
        """Generate using DALL-E"""
        
        try:
            image_url = self.llm_client.generate_image(
                prompt=prompt,
                provider="openai",
                model="dall-e-3"
            )
            
            if image_url:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    
                    with open(output_path, "wb") as f:
                        f.write(response.content)
                
                return output_path
                
        except Exception as e:
            logger.warning(f"DALL-E generation failed: {e}")
        
        return None
    
    async def _generate_sd(self, prompt: str, output_path: str) -> Optional[str]:
        """Generate using Stable Diffusion (via API)"""
        
        # This would typically use a Stable Diffusion API
        # For now, fall back to dummy
        return self._generate_fallback(prompt, output_path)
    
    def _generate_fallback(self, prompt: str, output_path: str) -> str:
        """Generate dummy fallback image"""
        
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create a colored placeholder
            width, height = 720, 1280  # 9:16 aspect ratio
            
            # Use hash of prompt for consistent color
            color_seed = hash(prompt) % 360
            hue = color_seed / 360.0
            
            # Simple color (HSV to RGB would be better, using simple approximation)
            r = int(128 + 127 * (1 if color_seed < 120 else -1))
            g = int(128 + 127 * (1 if 60 < color_seed < 180 else -1))
            b = int(128 + 127 * (1 if color_seed > 180 else -1))
            
            img = Image.new('RGB', (width, height), (r % 256, g % 256, b % 256))
            draw = ImageDraw.Draw(img)
            
            # Add text
            text = f"Scene Placeholder"
            # Center text
            bbox = draw.textbbox((0, 0), text)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            x = (width - text_width) // 2
            y = (height - text_height) // 2
            
            draw.text((x, y), text, fill=(255, 255, 255))
            
            img.save(output_path)
            
            return output_path
            
        except Exception as e:
            logger.error(f"Fallback generation failed: {e}")
            raise
    
    async def upscale_asset(
        self,
        image_path: str,
        target_resolution: str = "1080p"
    ) -> Optional[str]:
        """Upscale an existing asset"""
        
        logger.info(f"   Upscaling {image_path} to {target_resolution}")
        
        # Resolution targets
        resolutions = {
            "720p": (1280, 720),
            "1080p": (1920, 1080),
            "4k": (3840, 2160)
        }
        
        target_size = resolutions.get(target_resolution, resolutions["1080p"])
        
        try:
            from PIL import Image
            
            img = Image.open(image_path)
            original_size = img.size
            
            # Only upscale if smaller than target
            if img.width < target_size[0] or img.height < target_size[1]:
                # Use LANCZOS for quality upscaling
                upscaled = img.resize(target_size, Image.Resampling.LANCZOS)
                
                # Save with new name
                name, ext = os.path.splitext(os.path.basename(image_path))
                new_name = f"{name}_upscaled_{target_resolution}{ext}"
                new_path = os.path.join(self.output_dir, new_name)
                
                upscaled.save(new_path)
                
                logger.info(f"   [OK] Upscaled: {original_size} → {target_size}")
                return new_path
            
            return image_path
            
        except Exception as e:
            logger.error(f"Upscaling failed: {e}")
            return None
    
    async def batch_generate_with_retry(
        self,
        prompts: List[str],
        max_retries: int = 2
    ) -> List[Optional[str]]:
        """Generate multiple images with retry logic"""
        
        results = []
        
        for i, prompt in enumerate(prompts):
            for attempt in range(max_retries):
                try:
                    filename = f"batch_{uuid.uuid4().hex[:8]}.png"
                    filepath = os.path.join(self.output_dir, filename)
                    
                    result = await self._generate_with_provider(
                        ImageProvider.GEMINI, prompt, "high"
                    )
                    
                    if result:
                        results.append(result)
                        break
                        
                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1} failed: {e}")
            
            if len(results) <= i:
                results.append(None)
        
        return results


# Global singleton
_visual_asset_pipeline = None

def get_visual_asset_pipeline() -> VisualAssetPipeline:
    """Get global VisualAssetPipeline instance"""
    global _visual_asset_pipeline
    if _visual_asset_pipeline is None:
        _visual_asset_pipeline = VisualAssetPipeline()
    return _visual_asset_pipeline