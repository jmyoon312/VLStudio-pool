import React from 'react';

interface HealthScore {
    upload_consistency: number;
    engagement_quality: number;
    growth_momentum: number;
    content_diversity: number;
    total: number;
}

interface HealthScoreGaugeProps {
    score: HealthScore;
}

const ScoreBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => {
    const percentage = (value / max) * 100;
    const color = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium">{value.toFixed(1)}/{max}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: color,
                    }}
                />
            </div>
        </div>
    );
};

export const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({ score }) => {
    const getScoreColor = (total: number): string => {
        if (total >= 80) return '#10b981'; // Green
        if (total >= 60) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    const getScoreLabel = (total: number): string => {
        if (total >= 80) return '우수';
        if (total >= 60) return '양호';
        if (total >= 40) return '보통';
        return '개선 필요';
    };

    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score.total / 100) * circumference;

    return (
        <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-4">채널 건강 점수</h3>

            {/* Radial Gauge */}
            <div className="flex justify-center mb-6">
                <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="10"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={getScoreColor(score.total)}
                            strokeWidth="10"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">{score.total.toFixed(0)}</span>
                        <span className="text-xs text-gray-500">{getScoreLabel(score.total)}</span>
                    </div>
                </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
                <ScoreBar label="업로드 일관성" value={score.upload_consistency} max={25} />
                <ScoreBar label="참여도 품질" value={score.engagement_quality} max={25} />
                <ScoreBar label="성장 모멘텀" value={score.growth_momentum} max={25} />
                <ScoreBar label="콘텐츠 다양성" value={score.content_diversity} max={25} />
            </div>

            {/* Info */}
            <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500">
                    {score.total >= 80 && '채널이 매우 건강한 상태입니다! 현재 전략을 유지하세요.'}
                    {score.total >= 60 && score.total < 80 && '채널이 양호한 상태입니다. 일부 영역에서 개선이 가능합니다.'}
                    {score.total >= 40 && score.total < 60 && '채널 성장을 위해 업로드 빈도와 참여도 개선이 필요합니다.'}
                    {score.total < 40 && '채널 건강도가 낮습니다. 콘텐츠 전략을 재검토하세요.'}
                </p>
            </div>
        </div>
    );
};

export default HealthScoreGauge;
