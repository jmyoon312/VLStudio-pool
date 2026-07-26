import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import RetentionHeatmap from '../components/captain/RetentionHeatmap';
import HealthScoreGauge from '../components/captain/HealthScoreGauge';
import EnhancedVideoPerformanceTable from '../components/captain/EnhancedVideoPerformanceTable';

interface EnhancedAnalytics {
    summary: {
        total_videos: number;
        total_views: number;
        total_likes: number;
        total_comments: number;
        avg_engagement_rate: number;
    };
    health_score: {
        upload_consistency: number;
        engagement_quality: number;
        growth_momentum: number;
        content_diversity: number;
        total: number;
    };
    video_performance: any[];
    category_distribution: Record<string, any>;
    retention_data: any[];
}

const EnhancedCaptainDashboard: React.FC = () => {
    const { profileId } = useParams<{ profileId: string }>();
    const [data, setData] = useState<EnhancedAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(
                `/api/captain/${profileId}/analytics/ytdlp-enhanced?days=${days}`
            );

            setData(response.data);
        } catch (err: any) {
            console.error('Failed to fetch enhanced analytics:', err);
            setError(err.response?.data?.detail || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const triggerCollection = async () => {
        try {
            setLoading(true);

            await axios.post(`/api/captain/${profileId}/collect-now`);

            // Wait a bit for collection to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Refresh data
            await fetchData();
        } catch (err: any) {
            console.error('Failed to trigger collection:', err);
            setError(err.response?.data?.detail || 'Failed to collect data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (profileId) {
            fetchData();
        }
    }, [profileId, days]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center">
                    <p className="text-destructive">Error: {error}</p>
                    <button
                        onClick={fetchData}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <p className="text-muted-foreground">데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    {/* Advanced Controls Only */}
                    <div />
                    <div className="flex items-center gap-4">
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="px-3 py-2 bg-card border border-border text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value={7}>최근 7일</option>
                            <option value={30}>최근 30일</option>
                            <option value={90}>최근 90일</option>
                        </select>
                        {data.summary.total_videos === 0 && (
                            <button
                                onClick={triggerCollection}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                            >
                                데이터 수집
                            </button>
                        )}
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            새로고침
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground font-medium">총 영상</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">{data.summary.total_videos}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground font-medium">총 조회수</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">
                            {(data.summary.total_views / 1000000).toFixed(1)}M
                        </p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground font-medium">총 좋아요</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">
                            {(data.summary.total_likes / 1000).toFixed(1)}K
                        </p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground font-medium">총 댓글</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">
                            {(data.summary.total_comments / 1000).toFixed(1)}K
                        </p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground font-medium">평균 참여율</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">
                            {data.summary.avg_engagement_rate.toFixed(2)}%
                        </p>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Health Score */}
                    <div>
                        <HealthScoreGauge score={data.health_score} />
                    </div>

                    {/* Retention Heatmap */}
                    <div className="lg:col-span-2">
                        <RetentionHeatmap data={data.retention_data} />
                    </div>
                </div>

                {/* Video Performance Table */}
                <EnhancedVideoPerformanceTable videos={data.video_performance} />

                {/* Category Distribution */}
                {Object.keys(data.category_distribution).length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-4">
                        <h3 className="text-sm font-semibold mb-4 text-foreground">카테고리별 분포</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(data.category_distribution).map(([category, stats]: [string, any]) => (
                                <div key={category} className="border border-border bg-muted/30 rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground font-medium">{category}</p>
                                    <p className="text-lg font-bold mt-1 text-foreground">{stats.video_count}개</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {(stats.total_views / 1000).toFixed(1)}K views
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedCaptainDashboard;
