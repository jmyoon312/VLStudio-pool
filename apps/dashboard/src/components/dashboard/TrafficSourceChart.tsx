import React from 'react';
import { DonutChart } from './DonutChart';
import { ChartCard } from './ChartCard';

interface TrafficSourceData {
    source: string;
    views: number;
}

interface TrafficSourceChartProps {
    data: TrafficSourceData[];
}

// Map YouTube traffic source types to friendly names
const SOURCE_NAMES: Record<string, string> = {
    'YT_SEARCH': 'YouTube 검색',
    'BROWSE': '추천',
    'SUGGESTED_VIDEO': '제안 동영상',
    'EXTERNAL_APP': '외부 앱',
    'EXTERNAL_URL': '외부 URL',
    'NOTIFICATION': '알림',
    'PLAYLIST': '재생목록',
    'SUBSCRIBER': '구독',
    'CHANNEL': '채널 페이지',
    'OTHER': '기타'
};

const SOURCE_COLORS: Record<string, string> = {
    'YT_SEARCH': '#6366f1',
    'BROWSE': '#8b5cf6',
    'SUGGESTED_VIDEO': '#ec4899',
    'EXTERNAL_APP': '#10b981',
    'EXTERNAL_URL': '#f59e0b',
    'NOTIFICATION': '#ef4444',
    'PLAYLIST': '#3b82f6',
    'SUBSCRIBER': '#14b8a6',
    'CHANNEL': '#8b5cf6',
    'OTHER': '#94a3b8'
};

export const TrafficSourceChart: React.FC<TrafficSourceChartProps> = ({ data }) => {
    // Handle empty data
    if (!data || data.length === 0) {
        return (
            <ChartCard title="트래픽 소스" subtitle="유입 경로 분석" height={320}>
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                    <p>데이터가 없습니다</p>
                    <p className="text-xs mt-1">(Manager 권한 제한)</p>
                </div>
            </ChartCard>
        );
    }

    // Transform data for DonutChart
    const chartData = data.map(item => ({
        name: SOURCE_NAMES[item.source] || item.source,
        value: item.views,
        color: SOURCE_COLORS[item.source] || '#94a3b8'
    }));

    // Calculate total views
    const totalViews = data.reduce((sum, item) => sum + item.views, 0);

    return (
        <ChartCard title="트래픽 소스" subtitle="유입 경로 분석" height={320}>
            <DonutChart
                data={chartData}
                centerLabel="총 조회수"
                centerValue={totalViews.toLocaleString()}
            />
        </ChartCard>
    );
};
