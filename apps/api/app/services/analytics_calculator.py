"""
Analytics Calculator Service
Calculates advanced metrics from YouTube Analytics data
"""

from typing import Dict, Any, Optional
from datetime import datetime


class AnalyticsCalculator:
    """
    고급 분석 메트릭 계산 서비스
    """
    
    @staticmethod
    def calculate_engagement_rate(likes: int, comments: int, shares: int, views: int) -> float:
        """
        참여율 계산
        
        참여율 = (좋아요 + 댓글 + 공유) / 조회수 * 100
        
        Args:
            likes: 좋아요 수
            comments: 댓글 수
            shares: 공유 수
            views: 조회수
            
        Returns:
            참여율 (%)
        """
        if views == 0:
            return 0.0
        
        total_engagement = likes + comments + shares
        engagement_rate = (total_engagement / views) * 100
        
        return round(engagement_rate, 2)
    
    @staticmethod
    def calculate_watch_quality_score(
        avg_view_percentage: float,
        ctr: float,
        engagement_rate: float
    ) -> float:
        """
        시청 품질 점수 계산
        
        시청 품질 점수 = (평균 시청 비율 * 0.4) + (CTR * 0.3) + (참여율 * 0.3)
        
        Args:
            avg_view_percentage: 평균 시청 비율 (%)
            ctr: 클릭률 (0-1 범위)
            engagement_rate: 참여율 (%)
            
        Returns:
            시청 품질 점수 (0-100)
        """
        # CTR을 퍼센트로 변환
        ctr_percentage = ctr * 100
        
        # 가중 평균 계산
        score = (
            (avg_view_percentage * 0.4) +
            (ctr_percentage * 0.3) +
            (engagement_rate * 0.3)
        )
        
        # 0-100 범위로 제한
        return round(min(100, max(0, score)), 1)
    
    @staticmethod
    def calculate_growth_momentum(
        current_period: Dict[str, Any],
        previous_period: Dict[str, Any]
    ) -> float:
        """
        성장 모멘텀 계산
        
        성장 모멘텀 = (구독자 증가율 + 조회수 증가율 + 시청시간 증가율) / 3
        
        Args:
            current_period: 현재 기간 데이터
            previous_period: 이전 기간 데이터
            
        Returns:
            성장 모멘텀 (%)
        """
        def calculate_growth_rate(current: float, previous: float) -> float:
            if previous == 0:
                return 0.0
            return ((current - previous) / previous) * 100
        
        # 구독자 증가율
        sub_growth = calculate_growth_rate(
            current_period.get('subscribers_gained', 0),
            previous_period.get('subscribers_gained', 0)
        )
        
        # 조회수 증가율
        view_growth = calculate_growth_rate(
            current_period.get('views', 0),
            previous_period.get('views', 0)
        )
        
        # 시청 시간 증가율
        watch_time_growth = calculate_growth_rate(
            current_period.get('watch_time', 0),
            previous_period.get('watch_time', 0)
        )
        
        # 평균 계산
        momentum = (sub_growth + view_growth + watch_time_growth) / 3
        
        return round(momentum, 2)
    
    @staticmethod
    def calculate_content_efficiency(
        total_watch_time: float,
        video_count: int,
        engagement_rate: float
    ) -> float:
        """
        콘텐츠 효율성 지수 계산
        
        콘텐츠 효율성 = (평균 시청 시간 / 영상) * (참여율 / 100)
        
        Args:
            total_watch_time: 총 시청 시간 (분)
            video_count: 영상 수
            engagement_rate: 참여율 (%)
            
        Returns:
            콘텐츠 효율성 지수
        """
        if video_count == 0:
            return 0.0
        
        avg_watch_time_per_video = total_watch_time / video_count
        efficiency = avg_watch_time_per_video * (engagement_rate / 100)
        
        return round(efficiency, 2)
    
    @staticmethod
    def get_engagement_benchmark(engagement_rate: float) -> str:
        """
        참여율 벤치마크 평가
        
        Args:
            engagement_rate: 참여율 (%)
            
        Returns:
            평가 등급
        """
        if engagement_rate >= 3.5:
            return "우수"
        elif engagement_rate >= 2.0:
            return "양호"
        elif engagement_rate >= 1.0:
            return "보통"
        else:
            return "개선 필요"
    
    @staticmethod
    def get_watch_quality_benchmark(score: float) -> str:
        """
        시청 품질 점수 벤치마크 평가
        
        Args:
            score: 시청 품질 점수 (0-100)
            
        Returns:
            평가 등급
        """
        if score >= 80:
            return "매우 우수"
        elif score >= 60:
            return "우수"
        elif score >= 40:
            return "보통"
        elif score >= 20:
            return "개선 필요"
        else:
            return "긴급 개선 필요"
