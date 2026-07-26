import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Users, Eye, Video, TrendingUp, RefreshCw, AlertTriangle, Loader2
} from 'lucide-react';
import axios from 'axios';

// Import dashboard components
import { MetricCard } from '@/components/dashboard/MetricCard';
import { EngagementChart } from '@/components/dashboard/EngagementChart';
import { WatchTimeTrendChart } from '@/components/dashboard/WatchTimeTrendChart';
import { TrafficSourceChart } from '@/components/dashboard/TrafficSourceChart';
import { DemographicsChart } from '@/components/dashboard/DemographicsChart';
import { CTRScatterChart } from '@/components/dashboard/CTRScatterChart';
import { GrowthMomentumChart } from '@/components/dashboard/GrowthMomentumChart';
import { WatchQualityGauge } from '@/components/dashboard/WatchQualityGauge';
import { VideoPerformanceTable } from '@/components/dashboard/VideoPerformanceTable';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface DashboardData {
    total_stats: {
        total_subscribers: number;
        total_views: number;
        total_videos: number;
        channel_count: number;
    };
    warnings: Array<{
        level: string;
        channel_id: string;
        channel_name: string;
        type: string;
        message: string;
    }>;
    channels: Array<{
        channel_id: string;
        channel_name: string;
        subscriber_count: number;
        view_count: number;
        video_count: number;
        health_score: number;
        needs_refresh?: boolean;
    }>;
}

const CaptainDashboard: React.FC<{ profileId?: string | null }> = ({ profileId }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState(30);

    // Advanced analytics data
    const [engagementData, setEngagementData] = useState<any[]>([]);
    const [watchTimeData, setWatchTimeData] = useState<any[]>([]);
    const [trafficSourceData, setTrafficSourceData] = useState<any[]>([]);
    const [demographicsData, setDemographicsData] = useState<any>({ age_groups: [], gender: [] });
    const [topVideos, setTopVideos] = useState<any[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            // Use overview endpoint if no profileId, otherwise use specific Captain endpoint
            const endpoint = profileId
                ? `${API_BASE}/captain/${profileId}/dashboard?period=${period}`
                : `${API_BASE}/youtube/captain/dashboard/overview?period=${period}`;
            const response = await axios.get(endpoint);
            setData(response.data);
        } catch (error) {
            console.error("Failed to fetch dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdvancedAnalytics = async () => {
        // Skip analytics for "All Captains" view (analytics endpoints require specific profileId)
        if (!profileId) {
            setAnalyticsLoading(false);
            return;
        }

        try {
            setAnalyticsLoading(true);

            // Fetch all analytics data in parallel
            const [engagement, watchTime, trafficSources, demographics, topVideos] = await Promise.all([
                axios.get(`${API_BASE}/captain/${profileId}/analytics/engagement?days=${period}`),
                axios.get(`${API_BASE}/captain/${profileId}/analytics/watch-time?days=${period}`),
                axios.get(`${API_BASE}/captain/${profileId}/analytics/traffic-sources?days=${period}`),
                axios.get(`${API_BASE}/captain/${profileId}/analytics/demographics?days=${period}`),
                axios.get(`${API_BASE}/captain/${profileId}/analytics/top-videos?limit=10`)
            ]);

            setEngagementData(engagement.data.daily_data || []);
            setWatchTimeData(watchTime.data || []);
            setTrafficSourceData(trafficSources.data || []);
            setDemographicsData(demographics.data || { age_groups: [], gender: [] });
            setTopVideos(topVideos.data.videos || []);

        } catch (error) {
            console.error("Failed to fetch advanced analytics:", error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            // Use collect-now endpoint to trigger full data collection (including yt-dlp)
            await axios.post(`${API_BASE}/captain/${profileId}/collect-now`);
            // Wait a bit for async tasks to start population
            await new Promise(resolve => setTimeout(resolve, 2000));
            await Promise.all([fetchDashboard(), fetchAdvancedAnalytics()]);
        } catch (error) {
            console.error("Failed to refresh:", error);
            // Fallback to basic refresh if collect-now fails
            try {
                await axios.post(`${API_BASE}/captain/${profileId}/refresh?force=true`);
                await Promise.all([fetchDashboard(), fetchAdvancedAnalytics()]);
            } catch (retryError) {
                console.error("Retry failed:", retryError);
            }
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        fetchAdvancedAnalytics();
        const interval = setInterval(() => {
            fetchDashboard();
            fetchAdvancedAnalytics();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [profileId, period]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>알림</AlertTitle>
                <AlertDescription>대시보드 데이터가 아직 수집되지 않았습니다. 잠시 후 '새로고침'을 눌러주세요.</AlertDescription>
            </Alert>
        );
    }

    const { total_stats, warnings, channels } = data;

    // Calculate average engagement rate from real data
    const avgEngagementRate = engagementData.length > 0
        ? engagementData.reduce((sum, d) => sum + (d.engagement_rate || 0), 0) / engagementData.length
        : 0;

    // Calculate watch quality score components from real data
    const avgViewPercentage = watchTimeData.length > 0
        ? watchTimeData.reduce((sum, d) => {
            const duration = d.avg_view_duration || 0;
            // Assuming average video length of 10 minutes (600 seconds)
            const percentage = (duration / 600) * 100;
            return sum + Math.min(100, percentage);
        }, 0) / watchTimeData.length
        : 0;

    const avgCTR = 0.05; // Default CTR estimate (MANAGER role can't access this directly)

    // Calculate watch quality score
    const watchQualityScore = (avgViewPercentage * 0.4) + (avgCTR * 100 * 0.3) + (avgEngagementRate * 0.3);

    // Check if we have any real analytics data
    const hasAnalyticsData = engagementData.length > 0 || watchTimeData.length > 0 || trafficSourceData.length > 0;

    return (
        <div className="space-y-6 p-6">
            {/* Controls */}
            <div className="flex items-center justify-end gap-3">
                <select
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="px-4 py-2 border border-border bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value={7}>최근 7일</option>
                    <option value={30}>최근 30일</option>
                    <option value={90}>최근 90일</option>
                </select>
                <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                    {refreshing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    새로고침
                </Button>
            </div>

            {/* Warnings */}
            {warnings && warnings.length > 0 && (
                <div className="space-y-2">
                    {warnings.map((warning, index) => (
                        <Alert key={index} variant={warning.level === 'critical' ? 'destructive' : 'default'}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{warning.channel_name}</AlertTitle>
                            <AlertDescription>{warning.message}</AlertDescription>
                        </Alert>
                    ))}
                </div>
            )}

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="총 구독자"
                    value={total_stats.total_subscribers.toLocaleString()}
                    subtitle={`${total_stats.channel_count}개 채널`}
                    icon={<Users className="w-4 h-4" />}
                    color="blue"
                />
                <MetricCard
                    title="총 조회수"
                    value={total_stats.total_views.toLocaleString()}
                    subtitle="전체 채널"
                    icon={<Eye className="w-4 h-4" />}
                    color="purple"
                />
                <MetricCard
                    title="총 동영상"
                    value={total_stats.total_videos.toLocaleString()}
                    subtitle="전체 채널"
                    icon={<Video className="w-4 h-4" />}
                    color="purple"
                />
                <MetricCard
                    title="평균 참여율"
                    value={avgEngagementRate > 0 ? `${avgEngagementRate.toFixed(2)}%` : "데이터 수집 전"}
                    subtitle={avgEngagementRate >= 3.5 ? "우수" : avgEngagementRate >= 2 ? "양호" : avgEngagementRate > 0 ? "보통" : "데이터 수집 후 산출"}
                    icon={<TrendingUp className="w-4 h-4" />}
                    color={avgEngagementRate > 0 ? "green" : "slate"}
                />
            </div>

            {/* Advanced Charts Grid - 3x3 */}
            {/* Advanced Charts Grid - 3x3 */}
            {
                analyticsLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-3 text-muted-foreground">고급 분석 데이터 로딩 중...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Row 1 */}
                        {/* Always ensure charts are rendered if possible, even if empty (handled by component or show placeholder) */}
                        {watchTimeData && <WatchTimeTrendChart data={watchTimeData} />}
                        {engagementData && <EngagementChart data={engagementData} />}
                        {channels.length > 0 && (
                            <div className="bg-card rounded-lg border border-border p-4">
                                <h3 className="text-sm font-semibold text-foreground mb-2">채널 개요</h3>
                                <div className="space-y-2">
                                    {channels.slice(0, 5).map((channel, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="truncate">{channel.channel_name}</span>
                                            <span className="text-muted-foreground">{(channel.subscriber_count || 0).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Row 2 */}
                        {trafficSourceData && <TrafficSourceChart data={trafficSourceData} />}
                        {demographicsData && <DemographicsChart data={demographicsData} />}
                        {engagementData && <GrowthMomentumChart data={engagementData} />}

                        {/* Row 3 */}
                        <WatchQualityGauge
                            score={watchQualityScore || 0}
                            avgViewPercentage={avgViewPercentage || 0}
                            ctr={avgCTR || 0}
                            engagementRate={avgEngagementRate || 0}
                        />

                        {/* Row 4: Top Videos Table */}
                        <div className="col-span-full mt-6">
                            <VideoPerformanceTable videos={topVideos} isLoading={analyticsLoading} />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default CaptainDashboard;
