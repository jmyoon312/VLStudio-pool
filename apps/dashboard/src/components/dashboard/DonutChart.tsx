import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from 'recharts';

interface DonutChartProps {
    data: Array<{ name: string; value: number; color?: string }>;
    centerLabel?: string;
    centerValue?: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export function DonutChart({ data, centerLabel, centerValue }: DonutChartProps) {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    const renderCenterLabel = () => {
        if (!centerLabel && !centerValue) return null;

        return (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                <tspan x="50%" dy="-0.5em" className="text-2xl font-bold fill-gray-900">
                    {centerValue || total.toLocaleString()}
                </tspan>
                <tspan x="50%" dy="1.5em" className="text-sm fill-gray-500">
                    {centerLabel || 'Total'}
                </tspan>
            </text>
        );
    };

    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.color || COLORS[index % COLORS.length]}
                        />
                    ))}
                    {renderCenterLabel()}
                </Pie>
                <Tooltip
                    formatter={(value: number) => [
                        `${value.toLocaleString()} (${total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'}%)`,
                        '',
                    ]}
                />
                <Legend
                    verticalAlign="bottom"
                    height={80}
                    formatter={(value, entry: any) => (
                        <span className="text-[10px] text-slate-600">
                            {value}: {(entry.payload?.value ?? 0).toLocaleString()} (
                            {total > 0 ? (((entry.payload?.value ?? 0) / total) * 100).toFixed(1) : '0.0'}%)
                        </span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
