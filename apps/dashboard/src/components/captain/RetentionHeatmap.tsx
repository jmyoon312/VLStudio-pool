import React from 'react';

interface RetentionSegment {
    time_range: string;
    retention_rate: number;
    color: string;
}

interface RetentionVideo {
    video_id: string;
    title: string;
    segments: Array<{
        start_time?: number;
        end_time?: number;
        value: number;
    }>;
    avg_retention: number;
}

interface RetentionHeatmapProps {
    data: RetentionVideo[];
}

const getRetentionColor = (rate: number): string => {
    if (rate >= 0.8) return '#10b981'; // Green
    if (rate >= 0.6) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
};

export const RetentionHeatmap: React.FC<RetentionHeatmapProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold mb-4">시청 유지율 히트맵</h3>
                <p className="text-sm text-gray-500">데이터가 없습니다. 영상 메타데이터가 수집되면 표시됩니다.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">시청 유지율 히트맵</h3>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                        <span className="text-gray-600">80%+</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                        <span className="text-gray-600">60-80%</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                        <span className="text-gray-600">&lt;60%</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {data.map((video) => {
                    const segments = video.segments || [];

                    return (
                        <div key={video.video_id} className="flex items-center gap-2">
                            {/* Video Title */}
                            <div className="w-32 flex-shrink-0">
                                <span
                                    className="text-xs truncate block"
                                    title={video.title}
                                >
                                    {video.title}
                                </span>
                            </div>

                            {/* Retention Bar */}
                            <div className="flex-1 flex h-6 rounded overflow-hidden border">
                                {segments.length > 0 ? (
                                    segments.map((seg, idx) => {
                                        const color = getRetentionColor(seg.value);
                                        const percentage = (100 / segments.length).toFixed(2);

                                        return (
                                            <div
                                                key={idx}
                                                className="transition-all hover:opacity-80 cursor-pointer"
                                                style={{
                                                    backgroundColor: color,
                                                    width: `${percentage}%`,
                                                }}
                                                title={`${seg.start_time || 0}s-${seg.end_time || 0}s: ${(seg.value * 100).toFixed(1)}%`}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="w-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-xs text-gray-500">No data</span>
                                    </div>
                                )}
                            </div>

                            {/* Average Retention */}
                            <div className="w-12 flex-shrink-0 text-right">
                                <span className="text-xs font-medium">
                                    {(video.avg_retention * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>평균 유지율</span>
                    <span className="font-medium">
                        {data.length > 0
                            ? ((data.reduce((sum, v) => sum + v.avg_retention, 0) / data.length) * 100).toFixed(1)
                            : 0}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RetentionHeatmap;
