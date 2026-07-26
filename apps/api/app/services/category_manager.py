import os
import csv
import random
from typing import List, Dict

class CategoryManager:
    _instance = None

    # Fallback Data (Hardcoded for stability)
    FALLBACK_TOPICS = {
        "Games": [
            "League of Legends", "Valorant", "Brawl Stars", "Roblox", "Minecraft", 
            "GTA 6", "Overwatch 2", "PUBG Mobile", "Elden Ring", "Genshin Impact",
            "Faker", "T1", "LCK", "MapleStory", "Lost Ark"
        ],
        "Tech": [
            "iPhone 16", "Galaxy S25", "ChatGPT 5", "NVIDIA RTX 5090", "Apple Vision Pro",
            "Tesla Cybertruck", "iOS 18", "Windows 12", "AI Agent", "Sora AI"
        ],
        "Music": [
            "NewJeans", "BTS", "BLACKPINK", "IVE", "LE SSERAFIM", 
            "Billboard Hot 100", "Spotify Viral", "TikTok Challenge Song", "J-Pop Trend"
        ],
        "Entertainment": [
            "Netflix Korea", "Squid Game 2", "Korean Variety Show", "K-Drama Trend",
            "Celebrity News", "Box Office Korea"
        ],
        "News": [
            "Korea Politics", "Economic Crisis", "Real Estate Trend", "Stock Market",
            "Bitcoin", "Global Warming", "Election 2025"
        ],
        "Travel": [
            "Japan Travel Guide", "Seoul Hidden Gems", "Jeju Island", "Cheap Flights",
            "Vietnam Travel", "Europe Backpacking"
        ]
    }
    
    # Generic Fallback
    GENERIC_TOPICS = ["Latest Trends", "Viral Topics", "Popular Now", "Hot Issues"]

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CategoryManager, cls).__new__(cls)
            cls._instance.data = cls._instance._load_data()
        return cls._instance

    def _load_data(self) -> Dict[str, List[str]]:
        """
        Attempts to load CSVs. Returns Fallback if failed.
        """
        # Placeholder for CSV loading logic
        # For now, we rely on the robust fallback to ensure immediate stability.
        return self.FALLBACK_TOPICS

    def get_random_micro_topics(self, category: str, count: int = 1) -> List[str]:
        """
        Returns 'count' random micro-topics for the given category.
        """
        # Normalize category name if needed (e.g. 'Gaming' -> 'Games')
        if category == "Gaming": category = "Games"
        
        topics = self.data.get(category, self.GENERIC_TOPICS)
        
        # If specific category not found, try to map to generic or random from all
        if topics == self.GENERIC_TOPICS and category != "All":
             # Try to find a partial match or default
             pass

        if category == "All":
            # Combine all topics
            all_topics = []
            for t_list in self.data.values():
                all_topics.extend(t_list)
            topics = all_topics

        # Return sample
        if len(topics) < count:
            return topics
        return random.sample(topics, count)

category_manager = CategoryManager()
