import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    trend?: 'up' | 'down' | 'neutral';
    sparklineData?: number[];
    icon?: React.ReactNode;
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
    subtitle?: string;
}

const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
};

const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
};

export function MetricCard({
    title,
    value,
    change,
    trend = 'neutral',
    sparklineData,
    icon,
    color = 'blue',
    subtitle,
}: MetricCardProps) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon && (
                    <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                        {icon}
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline justify-between">
                    <div>
                        <div className="text-2xl font-bold">{value}</div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                        )}
                    </div>
                    {change !== undefined && (
                        <div className={`flex items-center text-sm font-medium ${trendColors[trend]}`}>
                            <TrendIcon className="h-4 w-4 mr-1" />
                            {Math.abs(change)}%
                        </div>
                    )}
                </div>
                {sparklineData && sparklineData.length > 0 && (
                    <div className="mt-4 h-12 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                            <LineChart data={sparklineData.map((value, index) => ({ value, index }))}>
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : '#8b5cf6'}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
