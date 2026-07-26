import React from 'react';

interface GaugeChartProps {
    value: number;
    max?: number;
    label?: string;
    size?: number;
    thickness?: number;
}

export function GaugeChart({
    value,
    max = 100,
    label = 'Score',
    size = 200,
    thickness = 20,
}: GaugeChartProps) {
    const percentage = Math.min((value / max) * 100, 100);
    const radius = (size - thickness) / 2;
    const circumference = Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    // Color based on value
    const getColor = () => {
        if (percentage >= 80) return '#10b981'; // green
        if (percentage >= 60) return '#f59e0b'; // yellow
        return '#ef4444'; // red
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <svg width={size} height={size / 2 + 20}>
                {/* Background arc */}
                <path
                    d={`M ${thickness / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - thickness / 2
                        } ${size / 2}`}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={thickness}
                    strokeLinecap="round"
                />
                {/* Value arc */}
                <path
                    d={`M ${thickness / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - thickness / 2
                        } ${size / 2}`}
                    fill="none"
                    stroke={getColor()}
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: 'stroke-dashoffset 0.5s ease',
                    }}
                />
                {/* Center text */}
                <text
                    x={size / 2}
                    y={size / 2 - 10}
                    textAnchor="middle"
                    className="text-3xl font-bold"
                    fill="#111827"
                >
                    {value}
                </text>
                <text
                    x={size / 2}
                    y={size / 2 + 15}
                    textAnchor="middle"
                    className="text-sm"
                    fill="#6b7280"
                >
                    {label}
                </text>
            </svg>
        </div>
    );
}
