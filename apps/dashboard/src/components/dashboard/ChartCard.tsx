import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    height?: number | string;
    className?: string;
    action?: React.ReactNode;
}

export function ChartCard({
    title,
    subtitle,
    children,
    height = 300,
    className = '',
    action,
}: ChartCardProps) {
    const heightValue = typeof height === 'number' ? height : parseInt(height as string) || 300;

    return (
        <Card className={`hover:shadow-lg transition-shadow bg-white flex flex-col ${className}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100 bg-slate-50/50 rounded-t-lg shrink-0">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-slate-800 tracking-tight">{title}</CardTitle>
                    {subtitle && (
                        <CardDescription className="text-xs font-medium text-slate-500">{subtitle}</CardDescription>
                    )}
                </div>
                {action && <div>{action}</div>}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
                {/* 
                  Recharts ResponsiveContainer needs a parent with definite width/height.
                  We use a direct style height here to enforce it.
                  min-w-0 is crucial for flex items to shrink properly.
                */}
                <div
                    className="w-full min-w-0 p-4"
                    style={{
                        height: `${heightValue}px`,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {children}
                </div>
            </CardContent>
        </Card>
    );
}
