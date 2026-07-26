import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartCard } from './ChartCard';

interface GrowthData {
    date: string;
    subscribers_gained: number;
    subscribers_lost: number;
    net_growth: number;
}

interface GrowthMomentumChartProps {
    data: GrowthData[];
}

export const GrowthMomentumChart: React.FC<GrowthMomentumChartProps> = ({ data }) => {
    // Calculate net growth
    const chartData = data.map(item => ({
        ...item,
        net_growth: item.subscribers_gained - item.subscribers_lost
    }));

    return (
        <ChartCard title="구독자 증감" subtitle="성장 모멘텀" height={320}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
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
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number, name: string) => {
                            if (name === 'net_growth') return [value.toLocaleString(), '순증가'];
                            if (name === 'subscribers_gained') return [value.toLocaleString(), '증가'];
                            if (name === 'subscribers_lost') return [value.toLocaleString(), '감소'];
                            return [value, name];
                        }}
                        cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="net_growth"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="url(#growthGradient)"
                        dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};
