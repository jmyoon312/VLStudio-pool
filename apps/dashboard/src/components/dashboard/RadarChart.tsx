import React from 'react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from 'recharts';

interface RadarChartProps {
    data: Array<{ category: string;[key: string]: string | number }>;
    dataKeys: Array<{ key: string; name: string; color: string }>;
}

export function RadarChartComponent({ data, dataKeys }: RadarChartProps) {
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <RadarChart data={data}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                    }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {dataKeys.map((item) => (
                    <Radar
                        key={item.key}
                        name={item.name}
                        dataKey={item.key}
                        stroke={item.color}
                        fill={item.color}
                        fillOpacity={0.3}
                    />
                ))}
            </RadarChart>
        </ResponsiveContainer>
    );
}
