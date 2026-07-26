import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard } from './ChartCard';

interface EngagementData {
    date: string;
    likes: number;
    comments: number;
    shares: number;
}

interface EngagementChartProps {
    data: EngagementData[];
}

export const EngagementChart: React.FC<EngagementChartProps> = ({ data }) => {
    return (
        <ChartCard title="참여도 분석" subtitle="좋아요, 댓글, 공유" height={320}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="sharesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.7} />
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
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        iconType="circle"
                    />
                    <Bar
                        dataKey="likes"
                        stackId="a"
                        fill="url(#likesGradient)"
                        radius={[0, 0, 0, 0]}
                        name="좋아요"
                    />
                    <Bar
                        dataKey="comments"
                        stackId="a"
                        fill="url(#commentsGradient)"
                        radius={[0, 0, 0, 0]}
                        name="댓글"
                    />
                    <Bar
                        dataKey="shares"
                        stackId="a"
                        fill="url(#sharesGradient)"
                        radius={[4, 4, 0, 0]}
                        name="공유"
                    />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};
