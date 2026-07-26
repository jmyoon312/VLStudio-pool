
import os
import uuid
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class VisualDeduplicator:
    """
    Generates dynamic visual elements (SVG charts, infographics) 
    to ensure visual uniqueness and provide high-value data overlays.
    """

    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        os.makedirs(self.temp_dir, exist_ok=True)

    def generate_growth_chart(self, title: str, data_points: List[float], labels: List[str], color: str = "#00ffcc") -> str:
        """
        Generates a line chart SVG.
        Returns the local path to the .svg file.
        """
        logger.info(f"📊 Generating growth chart: {title}")
        
        width = 800
        height = 400
        padding = 50
        
        if not data_points:
            data_points = [10, 25, 45, 80, 100]
        
        max_val = max(data_points) if data_points else 100
        min_val = min(data_points) if data_points else 0
        val_range = max_val - min_val if max_val != min_val else 100
        
        # Calculate points
        points = []
        step_x = (width - 2 * padding) / (len(data_points) - 1) if len(data_points) > 1 else 0
        for i, val in enumerate(data_points):
            x = padding + i * step_x
            y = height - padding - ((val - min_val) / val_range) * (height - 2 * padding)
            points.append(f"{x},{y}")
        
        polyline_points = " ".join(points)
        
        svg_content = f"""<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:{color};stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:{color};stop-opacity:0" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="none" />
            <path d="M {points[0]} L {" L ".join(points)} L {points[-1].split(',')[0]},{height-padding} L {points[0].split(',')[0]},{height-padding} Z" fill="url(#grad)" />
            <polyline fill="none" stroke="{color}" stroke-width="4" points="{polyline_points}" stroke-linecap="round" stroke-linejoin="round" />
            <text x="{width/2}" y="30" fill="white" font-family="Arial" font-size="24" text-anchor="middle" font-weight="bold">{title}</text>
        </svg>"""
        
        filename = f"chart_{uuid.uuid4().hex[:8]}.svg"
        path = os.path.join(self.temp_dir, filename)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg_content)
            
        return path

    def generate_buzzword_cloud(self, keywords: List[str]) -> str:
        """
        Generates a stylized keyword cloud SVG.
        """
        # Placeholder for complex cloud logic
        width = 600
        height = 600
        
        svg_content = f"""<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .kw {{ font-family: 'Arial'; font-weight: bold; fill: white; }}
            </style>
            <rect width="100%" height="100%" fill="none" />
        """
        
        for i, kw in enumerate(keywords[:10]):
            x = 100 + (i % 3) * 150 + random.randint(-20, 20)
            y = 100 + (i // 3) * 120 + random.randint(-20, 20)
            size = 20 + random.randint(10, 30)
            opacity = 0.5 + random.random() * 0.5
            svg_content += f'<text x="{x}" y="{y}" class="kw" font-size="{size}" style="opacity:{opacity}">{kw}</text>\n'
            
        svg_content += "</svg>"
        
        filename = f"cloud_{uuid.uuid4().hex[:8]}.svg"
        path = os.path.join(self.temp_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        return path

import random
