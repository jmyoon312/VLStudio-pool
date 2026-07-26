import React from 'react';
import { GaugeChart } from './GaugeChart';
import { ChartCard } from './ChartCard';

interface WatchQualityGaugeProps {
    score: number;
    avgViewPercentage: number;
    ctr: number;
    engagementRate: number;
}

export const WatchQualityGauge: React.FC<WatchQualityGaugeProps> = ({
    score,
    avgViewPercentage,
    ctr,
    engagementRate
}) => {
    // Get benchmark label
    const getBenchmark = (score: number) => {
        if (score >= 80) return '매우 우수';
        if (score >= 60) return '우수';
        if (score >= 40) return '보통';
        if (score >= 20) return '개선 필요';
        return '긴급 개선 필요';
    };

    return (
        <ChartCard title="시청 품질 점수" subtitle={getBenchmark(score)} height={320}>
            <div className="flex flex-col items-center justify-center h-full">
                <GaugeChart
                    value={Math.round(score)}
                    label="Watch Quality"
                    size={200}
                />

                {/* Breakdown */}
                <div className="mt-4 grid grid-cols-3 gap-4 w-full px-4">
                    <div className="text-center">
                        <div className="text-xs text-slate-500">평균 시청률</div>
                        <div className="text-sm font-semibold text-slate-700">{avgViewPercentage.toFixed(1)}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500">CTR</div>
                        <div className="text-sm font-semibold text-slate-700">{(ctr * 100).toFixed(2)}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500">참여율</div>
                        <div className="text-sm font-semibold text-slate-700">{engagementRate.toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        </ChartCard>
    );
};
