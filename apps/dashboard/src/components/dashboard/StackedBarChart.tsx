import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface StackedBarChartProps {
    data: Array<{ name: string;[key: string]: string | number }>;
    dataKeys: Array<{ key: string; name: string; color: string }>;
    xAxisKey?: string;
}

export function StackedBarChartComponent({
    data,
    dataKeys,
    xAxisKey = 'name',
}: StackedBarChartProps) {
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                    dataKey={xAxisKey}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    height={50}
                    interval={0}
                />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} width={30} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                    }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {dataKeys.map((item) => (
                    <Bar
                        key={item.key}
                        dataKey={item.key}
                        stackId="a"
                        fill={item.color}
                        name={item.name}
                        radius={[4, 4, 0, 0]}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}
