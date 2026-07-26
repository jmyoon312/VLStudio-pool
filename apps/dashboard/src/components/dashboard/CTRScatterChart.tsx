import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, Cell } from 'recharts';
import { ChartCard } from './ChartCard';

interface VideoData {
    title: string;
    ctr: number;
    avg_view_percentage: number;
    views: number;
}

interface CTRScatterChartProps {
    videos: VideoData[];
}

export const CTRScatterChart: React.FC<CTRScatterChartProps> = ({ videos }) => {
    // Transform data for scatter chart
    const scatterData = videos.map(video => ({
        x: video.ctr * 100, // Convert to percentage
        y: video.avg_view_percentage,
        z: video.views,
        name: video.title
    }));

    // Color based on performance (high CTR + high retention = green)
    const getColor = (ctr: number, retention: number) => {
        const score = (ctr + retention) / 2;
        if (score >= 60) return '#10b981'; // Green
        if (score >= 40) return '#6366f1'; // Blue
        if (score >= 20) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    };

    return (
        <ChartCard title="CTR vs 시청률" subtitle="영상별 성과 분석" height={320}>
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        type="number"
                        dataKey="x"
                        name="CTR"
                        unit="%"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        label={{ value: 'CTR (%)', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#64748b' } }}
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        name="시청률"
                        unit="%"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        label={{ value: '평균 시청률 (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                    />
                    <ZAxis type="number" dataKey="z" range={[50, 400]} name="조회수" />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number, name: string) => {
                            if (name === 'CTR') return [`${value.toFixed(2)}%`, 'CTR'];
                            if (name === '시청률') return [`${value.toFixed(1)}%`, '평균 시청률'];
                            if (name === '조회수') return [value.toLocaleString(), '조회수'];
                            return [value, name];
                        }}
                    />
                    <Scatter name="영상" data={scatterData} shape="circle">
                        {scatterData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getColor(entry.x, entry.y)}
                                fillOpacity={0.8}
                            />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};
