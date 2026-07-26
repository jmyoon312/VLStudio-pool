import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import { ChartCard } from './ChartCard';

interface WatchTimeData {
    date: string;
    watch_time: number;
    views: number;
    avg_view_duration: number;
}

interface WatchTimeTrendChartProps {
    data: WatchTimeData[];
}

export const WatchTimeTrendChart: React.FC<WatchTimeTrendChartProps> = ({ data }) => {
    return (
        <ChartCard title="시청 시간 트렌드" subtitle="최근 30일" height={320}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="watchTimeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        label={{ value: '분', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()}분`, '시청 시간']}
                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="watch_time"
                        stroke="#6366f1"
                        strokeWidth={3}
                        fill="url(#watchTimeGradient)"
                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};
