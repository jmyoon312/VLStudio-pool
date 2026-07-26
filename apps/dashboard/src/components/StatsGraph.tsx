import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface StatsGraphProps {
    data: any[]; // Raw history data
    uploadDate?: string; // Needed for velocity calc
    height?: number | string;
}

const StatsGraph: React.FC<StatsGraphProps> = ({ data, uploadDate, height = 300 }) => {
    // Advanced Data Calculation (Ported from Gallery.tsx)
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Sort by time
        const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const uploadTime = uploadDate ? new Date(uploadDate).getTime() : sorted[0]?.timestamp ? new Date(sorted[0].timestamp).getTime() : Date.now();

        return sorted.map((item, i) => {
            let velocity = 0;
            const itemTime = new Date(item.timestamp).getTime();

            // Lifetime Velocity (Safe calculation)
            const hoursSinceUpload = Math.max(0.1, (itemTime - uploadTime) / (1000 * 60 * 60));
            const lifetimeVelocity = item.view_count / hoursSinceUpload;

            if (i === 0) {
                // First point: Use Lifetime
                velocity = lifetimeVelocity;
            } else {
                // Instant Velocity
                const prev = sorted[i - 1];
                const prevTime = new Date(prev.timestamp).getTime();
                const timeDiff = itemTime - prevTime;
                const hours = timeDiff / (1000 * 60 * 60);

                let instantVelocity = 0;
                if (hours > 0) {
                    const viewDiff = item.view_count - prev.view_count;
                    instantVelocity = viewDiff / hours;
                }

                if (instantVelocity > 0) {
                    velocity = instantVelocity;
                } else {
                    velocity = lifetimeVelocity; // Fallback
                }
            }

            return {
                ...item,
                velocity: Math.max(0, Math.floor(velocity))
            };
        });
    }, [data, uploadDate]);

    const formatCount = (num: number) => {
        if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
        return num.toString();
    };

    if (!chartData || chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20 rounded-lg" style={{ height }}>
                <TrendingUp className="w-8 h-8 mr-2 opacity-50" />
                데이터가 충분하지 않습니다.
            </div>
        );
    }

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#888"
                        fontSize={12}
                    />
                    <YAxis
                        yAxisId="left"
                        stroke="#6366f1"
                        fontSize={12}
                        tickFormatter={(val) => formatCount(val)}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#f59e0b"
                        fontSize={12}
                        tickFormatter={(val) => formatCount(val) + '/h'}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        formatter={(value: number, name: string) => {
                            if (name === "velocity") return [formatCount(value) + '/h', "시간당 조회수 (Vel)"];
                            return [formatCount(value), "누적 조회수"];
                        }}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="view_count"
                        name="view_count"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="velocity"
                        name="velocity"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        strokeDasharray="5 5"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default StatsGraph;
