import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface WarmupLogViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channelId: string;
}

const WarmupLogViewer: React.FC<WarmupLogViewerProps> = ({ open, onOpenChange, channelId }) => {
    // 로그 조회
    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ['warmup-logs', channelId],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/youtube/channels/${channelId}/warmup/logs?limit=50`);
            return res.data;
        },
        enabled: open && !!channelId
    });

    // 분석 데이터
    const { data: analytics, isLoading: analyticsLoading } = useQuery({
        queryKey: ['warmup-analytics', channelId],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/youtube/channels/${channelId}/warmup/analytics`);
            return res.data;
        },
        enabled: open && !!channelId
    });

    if (!channelId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">웜업 로그 & 분석</DialogTitle>
                </DialogHeader>

                {/* 성공률 요약 */}
                {analyticsLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : analytics && analytics.total_actions > 0 ? (
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">{analytics.total_actions}</div>
                            <div className="text-xs text-blue-600">총 액션</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="text-2xl font-bold text-green-600">{analytics.success_count}</div>
                            <div className="text-xs text-green-600">성공</div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <div className="text-2xl font-bold text-red-600">{analytics.failed_count}</div>
                            <div className="text-xs text-red-600">실패</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <div className="text-2xl font-bold text-purple-600">{analytics.success_rate}%</div>
                            <div className="text-xs text-purple-600">성공률</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 p-4">
                        아직 로그 데이터가 없습니다
                    </div>
                )}

                {/* 액션별 성공률 */}
                {analytics && analytics.action_stats && Object.keys(analytics.action_stats).length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold mb-2">액션별 성공률</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(analytics.action_stats).map(([action, stats]: [string, any]) => (
                                <div key={action} className="bg-gray-50 p-2 rounded border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">{action}</span>
                                        <Badge variant={stats.success_rate >= 80 ? "default" : "destructive"} className="text-xs">
                                            {stats.success_rate}%
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {stats.success}/{stats.total} 성공
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 로그 목록 */}
                <div>
                    <h3 className="text-sm font-semibold mb-2">최근 로그 ({logs?.total || 0}개)</h3>
                    <ScrollArea className="h-[400px] border rounded-lg">
                        {logsLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        ) : logs && logs.logs && logs.logs.length > 0 ? (
                            <div className="space-y-2 p-3">
                                {logs.logs.map((log: any) => (
                                    <div key={log.id} className="border rounded-lg p-3 text-sm bg-white hover:bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                                                    {log.status === 'success' ? '✅' : '❌'}
                                                </Badge>
                                                <span className="font-semibold">{log.action}</span>
                                                <Badge variant="outline" className="text-xs">Day {log.stage}</Badge>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {new Date(log.created_at).toLocaleString('ko-KR', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>

                                        {/* 상세 정보 */}
                                        {log.details && Object.keys(log.details).length > 0 && (
                                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2 font-mono">
                                                {log.details.url && (
                                                    <div className="truncate">URL: {log.details.url}</div>
                                                )}
                                                {log.details.planned_duration && (
                                                    <div>Duration: {log.details.actual_duration || 0}s / {log.details.planned_duration}s</div>
                                                )}
                                                {log.details.ads_skipped !== undefined && (
                                                    <div>Ads skipped: {log.details.ads_skipped}</div>
                                                )}
                                                {log.details.early_exit && (
                                                    <div className="text-yellow-600">⚠️ Early exit</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 에러 메시지 */}
                                        {log.error_message && (
                                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                                                ❌ {log.error_message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 p-8">
                                로그가 없습니다
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default WarmupLogViewer;
