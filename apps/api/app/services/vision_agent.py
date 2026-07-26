"""
AI Vision Agent for ViraLoop

Provides computer vision capabilities for:
- Screenshot analysis for automation debugging
- UI element detection
- Video frame quality verification
- Thumbnail quality checking
"""

import logging
import base64
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class VisionTaskType(Enum):
    """Types of vision analysis tasks"""
    UI_ELEMENT_DETECTION = "ui_element_detection"
    SCREENSHOT_ANALYSIS = "screenshot_analysis"
    VIDEO_FRAME_QA = "video_frame_qa"
    THUMBNAIL_QUALITY = "thumbnail_quality"
    TEXT_EXTRACTION = "text_extraction"
    COLOR_CONSISTENCY = "color_consistency"


@dataclass
class VisionResult:
    """Result of vision analysis"""
    task_type: VisionTaskType
    success: bool
    analysis: Dict[str, Any]
    confidence: float = 0.0
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class AIVisionAgent:
    """
    AI-powered Vision Agent for automation and quality verification
    
    Uses Gemini Vision API for image analysis.
    Can analyze screenshots, detect UI elements, verify video quality.
    
    Usage:
        vision_agent = AIVisionAgent(llm_client)
        
        # Analyze screenshot
        result = await vision_agent.analyze_screenshot(
            screenshot_bytes,
            task="debug_automation"
        )
        
        # Check thumbnail quality
        result = await vision_agent.check_thumbnail_quality(
            thumbnail_bytes,
            niche="travel"
        )
    """
    
    def __init__(self, llm_client, model: str = "gemini-2.0-flash-exp"):
        self.llm_client = llm_client
        self.model = model
        
        # Predefined prompts for different tasks
        self._prompts = {
            VisionTaskType.SCREENSHOT_ANALYSIS: """
                Analyze this screenshot from an automated browser session.
                
                Provide:
                1. Page type identification (YouTube, Google, etc.)
                2. Visible UI elements (buttons, menus, inputs)
                3. Any error messages or warnings
                4. Overall page load status (success/loading/error)
                
                Output JSON:
                {
                    "page_type": "string",
                    "ui_elements": [{"type": "string", "text": "string", "visible": boolean}],
                    "errors": ["string"],
                    "status": "success|loading|error",
                    "confidence": 0.0-1.0
                }
            """,
            
            VisionTaskType.UI_ELEMENT_DETECTION: """
                Identify and locate UI elements in this screenshot.
                
                For automation purposes, find:
                1. Buttons (especially: settings, menu, upload, publish)
                2. Input fields
                3. Navigation elements
                4. Error/success indicators
                
                Output JSON:
                {
                    "elements": [
                        {"description": "string", "likely_selector": "string", "priority": "high|medium|low"}
                    ],
                    "automation_hints": ["string"],
                    "confidence": 0.0-1.0
                }
            """,
            
            VisionTaskType.THUMBNAIL_QUALITY: """
                Analyze this YouTube thumbnail for quality and effectiveness.
                
                Consider niche: {niche}
                
                Evaluate:
                1. Visual appeal (1-10)
                2. Text readability (1-10)
                3. Color contrast (1-10)
                4. Emotional impact (1-10)
                5. Click-through potential (1-10)
                
                Also check:
                - Is there face(s) in thumbnail?
                - Is there text overlay?
                - Is it eye-catching?
                
                Output JSON:
                {
                    "scores": {"visual": 1-10, "readability": 1-10, "contrast": 1-10, "emotion": 1-10, "ctr_potential": 1-10},
                    "has_face": boolean,
                    "has_text": boolean,
                    "is_eye_catching": boolean,
                    "issues": ["string"],
                    "improvements": ["string"],
                    "overall_score": 1-10,
                    "confidence": 0.0-1.0
                }
            """,
            
            VisionTaskType.VIDEO_FRAME_QA: """
                Analyze this video frame for quality issues.
                
                Check for:
                1. Blur or motion blur
                2. Artifacts or compression issues
                3. Lighting problems (overexposed/underexposed)
                4. Color grading issues
                5. Audio-visual sync indicators
                
                Output JSON:
                {
                    "quality_issues": [{"type": "string", "severity": "low|medium|high", "description": "string"}],
                    "is_acceptable": boolean,
                    "frame_timestamp": "string if known",
                    "confidence": 0.0-1.0
                }
            """,
            
            VisionTaskType.TEXT_EXTRACTION: """
                Extract all visible text from this image.
                
                Output JSON:
                {
                    "text": "extracted text",
                    "language": "detected language",
                    "text_regions": [{"text": "string", "position": "string"}],
                    "confidence": 0.0-1.0
                }
            """,
            
            VisionTaskType.COLOR_CONSISTENCY: """
                Analyze color consistency across this image or video frame.
                
                Check for:
                1. Color palette consistency
                2. White balance
                3. Saturation uniformity
                4. Brand color adherence if applicable
                
                Output JSON:
                {
                    "palette": ["color hex codes"],
                    "consistency_score": 0.0-1.0,
                    "issues": ["string"],
                    "recommendations": ["string"],
                    "confidence": 0.0-1.0
                }
            """
        }
    
    async def analyze_screenshot(
        self,
        image_data: bytes,
        task: str = "debug_automation",
        context: Optional[Dict] = None
    ) -> VisionResult:
        """
        Analyze a screenshot for debugging automation issues
        
        Args:
            image_data: Screenshot as bytes
            task: Type of analysis (debug_automation, ui_detection, general)
            context: Additional context (URL, expected elements, etc.)
            
        Returns:
            VisionResult with analysis
        """
        try:
            if task == "ui_detection":
                task_type = VisionTaskType.UI_ELEMENT_DETECTION
            else:
                task_type = VisionTaskType.SCREENSHOT_ANALYSIS
            
            prompt = self._prompts[task_type]
            
            # Add context if provided
            if context:
                prompt += f"\n\nAdditional Context: {json.dumps(context)}"
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=self.model,
                images=[image_data],
                full_response=False
            )
            
            # Parse JSON response
            analysis = self._parse_json_response(response)
            
            return VisionResult(
                task_type=task_type,
                success=True,
                analysis=analysis,
                confidence=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            logger.error(f"Screenshot analysis failed: {e}")
            return VisionResult(
                task_type=VisionTaskType.SCREENSHOT_ANALYSIS,
                success=False,
                analysis={},
                errors=[str(e)]
            )
    
    async def check_thumbnail_quality(
        self,
        thumbnail_data: bytes,
        niche: str = "general"
    ) -> VisionResult:
        """
        Check YouTube thumbnail quality
        
        Args:
            thumbnail_data: Thumbnail image as bytes
            niche: Content niche (travel, tech, etc.) for context
            
        Returns:
            VisionResult with quality scores
        """
        try:
            prompt = self._prompts[VisionTaskType.THUMBNAIL_QUALITY].format(
                niche=niche
            )
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=self.model,
                images=[thumbnail_data],
                full_response=False
            )
            
            analysis = self._parse_json_response(response)
            
            return VisionResult(
                task_type=VisionTaskType.THUMBNAIL_QUALITY,
                success=True,
                analysis=analysis,
                confidence=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            logger.error(f"Thumbnail quality check failed: {e}")
            return VisionResult(
                task_type=VisionTaskType.THUMBNAIL_QUALITY,
                success=False,
                analysis={},
                errors=[str(e)]
            )
    
    async def analyze_video_frame(
        self,
        frame_data: bytes,
        timestamp: Optional[str] = None
    ) -> VisionResult:
        """
        Analyze a video frame for quality issues
        
        Args:
            frame_data: Video frame as bytes
            timestamp: Optional timestamp in video
            
        Returns:
            VisionResult with quality assessment
        """
        try:
            prompt = self._prompts[VisionTaskType.VIDEO_FRAME_QA]
            
            if timestamp:
                prompt += f"\n\nFrame timestamp: {timestamp}"
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=self.model,
                images=[frame_data],
                full_response=False
            )
            
            analysis = self._parse_json_response(response)
            
            return VisionResult(
                task_type=VisionTaskType.VIDEO_FRAME_QA,
                success=True,
                analysis=analysis,
                confidence=analysis.get("confidence", 0.7)
            )
            
        except Exception as e:
            logger.error(f"Video frame analysis failed: {e}")
            return VisionResult(
                task_type=VisionTaskType.VIDEO_FRAME_QA,
                success=False,
                analysis={},
                errors=[str(e)]
            )
    
    async def extract_text(
        self,
        image_data: bytes,
        language: Optional[str] = None
    ) -> VisionResult:
        """
        Extract text from image (OCR alternative)
        
        Args:
            image_data: Image as bytes
            language: Expected language (optional)
            
        Returns:
            VisionResult with extracted text
        """
        try:
            prompt = self._prompts[VisionTaskType.TEXT_EXTRACTION]
            
            if language:
                prompt += f"\n\nExpected language: {language}"
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=self.model,
                images=[image_data],
                full_response=False
            )
            
            analysis = self._parse_json_response(response)
            
            return VisionResult(
                task_type=VisionTaskType.TEXT_EXTRACTION,
                success=True,
                analysis=analysis,
                confidence=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return VisionResult(
                task_type=VisionTaskType.TEXT_EXTRACTION,
                success=False,
                analysis={},
                errors=[str(e)]
            )
    
    async def check_color_consistency(
        self,
        images: List[bytes]
    ) -> VisionResult:
        """
        Check color consistency across multiple images
        
        Args:
            images: List of images to compare
            
        Returns:
            VisionResult with consistency analysis
        """
        try:
            prompt = self._prompts[VisionTaskType.COLOR_CONSISTENCY]
            
            response = self.llm_client.generate_content(
                prompt=prompt,
                model_name=self.model,
                images=images,
                full_response=False
            )
            
            analysis = self._parse_json_response(response)
            
            return VisionResult(
                task_type=VisionTaskType.COLOR_CONSISTENCY,
                success=True,
                analysis=analysis,
                confidence=analysis.get("confidence", 0.7)
            )
            
        except Exception as e:
            logger.error(f"Color consistency check failed: {e}")
            return VisionResult(
                task_type=VisionTaskType.COLOR_CONSISTENCY,
                success=False,
                analysis={},
                errors=[str(e)]
            )
    
    def _parse_json_response(self, response) -> Dict[str, Any]:
        """Parse JSON from LLM response"""
        if isinstance(response, dict):
            return response
        
        if isinstance(response, str):
            # Try to extract JSON from response
            import re
            
            # Look for JSON block
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            
            # Try parsing whole response as JSON
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                pass
        
        logger.warning(f"Could not parse JSON from response: {response}")
        return {"raw_response": str(response)}
    
    async def batch_analyze(
        self,
        images: List[bytes],
        task_type: VisionTaskType
    ) -> List[VisionResult]:
        """
        Analyze multiple images in batch
        
        Args:
            images: List of images
            task_type: Type of analysis
            
        Returns:
            List of VisionResults
        """
        results = []
        
        for i, img in enumerate(images):
            try:
                if task_type == VisionTaskType.THUMBNAIL_QUALITY:
                    result = await self.check_thumbnail_quality(img)
                elif task_type == VisionTaskType.VIDEO_FRAME_QA:
                    result = await self.analyze_video_frame(img)
                elif task_type == VisionTaskType.TEXT_EXTRACTION:
                    result = await self.extract_text(img)
                else:
                    result = await self.analyze_screenshot(img)
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Batch analysis item {i} failed: {e}")
                results.append(VisionResult(
                    task_type=task_type,
                    success=False,
                    analysis={},
                    errors=[str(e)]
                ))
        
        return results