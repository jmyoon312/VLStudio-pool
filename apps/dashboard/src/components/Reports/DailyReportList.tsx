import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api'; // [FIX] Use standardized API client
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Selecto from "react-selecto"; // [NEW]
import { Trash2 } from "lucide-react"; // [NEW]
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, FileText, RefreshCw, Eye, Copy,
    TrendingUp, AlertTriangle, Video, Scroll, Activity, CheckCircle2
} from "lucide-react";
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface ReportStats {
    videos_collected: number;
    scripts_collected: number;
    failed_downloads: number;
    channels: {
        total: number;
        active: number;
        failing: number;
    };
    trends_cached: number;
    logs: any;
    system_health?: { // [NEW] Backward compatible
        storage: { percent: number; free_gb: number };
        db_size_mb: number;
        zombie_tasks: number;
    };
    operational_metrics?: {
        search: {
            searxng: { success: number; fail: number; latency: number[] };
            tavily: { success: number; fail: number; latency: number[] };
        };
        llm: {
            requests: number;
            errors: number;
            rate_limits: number;
            tokens: number;
        };
    };
}

interface DailyReport {
    id: number;
    report_date: string;
    summary_markdown: string;
    raw_stats_json: ReportStats;
    is_read: boolean;
    created_at: string;
    auto_fix_log?: any[]; // [NEW] Added for auto-fix logs
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EF4444']; // Blue, Green, Yellow, Orange, Red

// Custom Markdown Components for Styling
const markdownComponents = {
    h1: ({ node, ...props }: any) => <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border text-primary" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-xl font-semibold mt-8 mb-3 flex items-center gap-2 text-foreground/90" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-lg font-medium mt-4 mb-2 text-foreground/80" {...props} />,
    p: ({ node, ...props }: any) => <p className="leading-7 mb-4 text-foreground/80" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
    blockquote: ({ node, ...props }: any) => (
        <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50/50 italic rounded-r-lg text-foreground/90" {...props} />
    ),
    code: ({ node, inline, ...props }: any) => (
        inline
            ? <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm text-pink-600" {...props} />
            : <div className="bg-slate-950 text-slate-50 p-4 rounded-lg my-4 overflow-x-auto"><code className="font-mono text-sm" {...props} /></div>
    ),
    table: ({ node, ...props }: any) => (
        <div className="overflow-x-auto my-6 rounded-lg border border-border">
            <table className="w-full text-sm border-collapse" {...props} />
        </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-muted/50" {...props} />,
    th: ({ node, ...props }: any) => <th className="border-b border-border p-3 text-left font-medium text-muted-foreground" {...props} />,
    td: ({ node, ...props }: any) => <td className="border-b border-border p-3 align-top" {...props} />,
    hr: ({ node, ...props }: any) => <hr className="my-8 border-border" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-primary hover:underline font-medium" {...props} />,
};

// [NEW] System Health Dashboard Component
function SystemHealthDashboard() {
    const { data: metrics, isLoading, refetch } = useQuery({
        queryKey: ['system-metrics'],
        queryFn: async () => {
            const res = await api.get('/maintenance/metrics');
            return res.data;
        },
        refetchInterval: 30000 // Refresh every 30s
    });

    if (isLoading) return <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!metrics) return null;

    const getStatusColor = (percent: number) => {
        if (percent > 90) return "bg-red-500";
        if (percent > 70) return "bg-orange-500";
        return "bg-blue-500";
    };

    return (
        <Card className="mb-8 border-border/50 shadow-sm bg-card">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            실시간 시스템 상태 (Live System Status)
                        </CardTitle>
                        <CardDescription>서버 리소스 및 작업 대기열 현황</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* CPU Usage */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> CPU 사용량</span>
                            <span>{metrics.cpu_percent}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${getStatusColor(metrics.cpu_percent)}`} style={{ width: `${metrics.cpu_percent}%` }} />
                        </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-purple-500" /> 메모리 ({metrics.memory.percent}%)</span>
                            <span className="text-xs text-muted-foreground">{metrics.memory.used_gb}GB / {metrics.memory.total_gb}GB</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${getStatusColor(metrics.memory.percent)}`} style={{ width: `${metrics.memory.percent}%` }} />
                        </div>
                    </div>

                    {/* Storage */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" /> 저장소 ({metrics.storage.percent}%)</span>
                            <span className="text-xs text-muted-foreground">{metrics.storage.free_gb}GB Free</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${getStatusColor(metrics.storage.percent)}`} style={{ width: `${metrics.storage.percent}%` }} />
                        </div>
                    </div>

                    {/* Queue stats */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-card p-3 rounded-lg border border-border text-center">
                            <div className="text-2xl font-bold text-primary">{metrics.queue?.active_downloads || 0}</div>
                            <div className="text-xs text-muted-foreground">다운로드 중</div>
                        </div>
                        <div className="bg-card p-3 rounded-lg border border-border text-center">
                            <div className="text-2xl font-bold text-foreground">{metrics.queue?.pending_videos || 0}</div>
                            <div className="text-xs text-muted-foreground">대기열</div>
                        </div>
                    </div>
                </div>

                {/* Advanced Info Footer */}
                <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">DB 크기:</span> {metrics.db_size_mb} MB
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">좀비 태스크:</span>
                        <span className={metrics.zombie_tasks > 0 ? "text-red-500 font-bold" : ""}>{metrics.zombie_tasks}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <span className={`px-2 py-0.5 rounded-full ${metrics.api_status.openai ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>OpenAI</span>
                        <span className={`px-2 py-0.5 rounded-full ${metrics.api_status.gemini ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Gemini</span>
                        <span className={`px-2 py-0.5 rounded-full ${metrics.api_status.searxng ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>SearXNG</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function DailyReportList() {
    const queryClient = useQueryClient();
    const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set()); // [NEW] Selection State

    const { data: reports, isLoading } = useQuery<DailyReport[]>({
        queryKey: ['daily-reports'],
        queryFn: async () => {
            const res = await api.get('/reports/');
            return res.data;
        }
    });

    const generateMutation = useMutation({
        mutationFn: async () => {
            await api.post('/reports/generate');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
            alert("리포트 생성이 완료되었습니다.");
        },
        onError: (error: any) => {
            console.error("Generate failed:", error);
            const msg = error.response?.data?.detail || error.message || "Unknown error";
            alert(`리포트 생성 실패: ${msg}`);
        }
    });

    const markReadMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.put(`/reports/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            const params = new URLSearchParams();
            ids.forEach(id => params.append('ids', id.toString()));
            // Ensure trailing slash and correct query handling
            const response = await api.delete(`/reports/?${params.toString()}`);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
            setSelectedIds(new Set());
            // Optional: Show success toast/alert if you had a toast system, using alert for now as requested
            // alert(`Deleted ${data.deleted} reports successfully.`); 
        },
        onError: (error) => {
            console.error("Delete failed:", error);
            alert("삭제에 실패했습니다. (Delete failed)");
        }
    });

    const fixMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await api.post(`/reports/${id}/fix`);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
            setSelectedReport(data);
            alert("자동 조치가 완료되었습니다. (Auto-Fix Completed)");
        },
        onError: (error: any) => {
            const msg = error.response?.data?.detail || error.message || "Unknown error";
            alert(`자동 조치 실패 (Failed): ${msg}`);
        }
    });

    const handleViewReport = (report: DailyReport) => {
        setSelectedReport(report);
        if (!report.is_read) {
            markReadMutation.mutate(report.id);
        }
    };

    // Prepare chart data function
    const getChartData = (stats: ReportStats) => {
        const contentData = [
            { name: '영상', value: stats.videos_collected, fill: '#3b82f6' },
            { name: '대본', value: stats.scripts_collected, fill: '#8b5cf6' },
            { name: '실패', value: stats.failed_downloads, fill: '#ef4444' },
        ];

        const channelData = [
            { name: '활성', value: stats.channels.active },
            { name: '오류/중지', value: stats.channels.failing },
            { name: '기타/대기', value: stats.channels.total - stats.channels.active - stats.channels.failing },
        ];

        return { contentData, channelData };
    };

    return (
        <div className="space-y-6 select-none" >
            {/* Disable Selecto when dialog is open to allow text selection */}
            {!selectedReport && (
                <Selecto
                    dragContainer={window}
                    selectableTargets={[".report-row"]}
                    hitRate={0}
                    selectByClick={false}
                    selectFromInside={false}
                    toggleContinueSelect={["shift"]}
                    dragCondition={(e) => {
                        const target = e.inputEvent.target as HTMLElement;
                        // Prevent clearing selection when clicking on buttons or their children
                        // Also prevent drag start if clicking on interactive elements
                        return !target.closest("button") && !target.closest("a") && !target.closest(".no-drag");
                    }}
                    onSelect={e => {
                        e.added.forEach(el => {
                            el.classList.add("selected");
                        });
                        e.removed.forEach(el => {
                            el.classList.remove("selected");
                        });

                        setSelectedIds(prev => {
                            const newSelected = new Set(prev);
                            e.added.forEach(el => {
                                const id = Number(el.getAttribute("data-id"));
                                if (id) newSelected.add(id);
                            });
                            e.removed.forEach(el => {
                                const id = Number(el.getAttribute("data-id"));
                                if (id) newSelected.delete(id);
                            });
                            return newSelected;
                        });
                    }}
                />
            )}

            <div className="flex justify-between items-center">
                <div />
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (confirm(`${selectedIds.size}개의 리포트를 삭제하시겠습니까?`)) {
                                    deleteMutation.mutate(Array.from(selectedIds));
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {selectedIds.size}개 삭제
                        </Button>
                    )}
                    <Button
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                        variant="outline"
                        className="border-primary/20 hover:bg-primary/5"
                    >
                        {generateMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                분석 중...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                지금 수동 생성
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <SystemHealthDashboard />

            <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/75">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">선택</TableHead>
                                <TableHead className="w-[180px]">리포트 날짜</TableHead>
                                <TableHead className="w-[100px]">상태</TableHead>
                                <TableHead>주요 요약 (Executive Summary)</TableHead>
                                <TableHead className="text-right w-[100px]">보기</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                            <span className="text-xs">데이터 로딩 중...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : reports?.map((report) => (
                                <TableRow
                                    key={report.id}
                                    className={`report-row cursor-pointer transition-colors ${selectedIds.has(report.id) ? 'bg-blue-50/70 hover:bg-blue-100/50' : 'hover:bg-slate-50/50'}`}
                                    onClick={() => handleViewReport(report)}
                                    data-id={report.id}
                                >
                                    <TableCell className="text-center no-drag" onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(report.id)) {
                                                next.delete(report.id);
                                            } else {
                                                next.add(report.id);
                                            }
                                            return next;
                                        });
                                    }}>
                                        <div className="flex items-center justify-center">
                                            <div className={`w-4 h-4 rounded border transition-all ${selectedIds.has(report.id) ? 'bg-primary border-primary' : 'border-slate-300 bg-white'}`}>
                                                {selectedIds.has(report.id) && <CheckCircle2 className="w-4 h-4 text-white p-0.5" />}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-700">
                                        {format(new Date(report.report_date), 'yyyy. MM. dd (eee)', { locale: ko })}
                                    </TableCell>
                                    <TableCell>
                                        {!report.is_read ? (
                                            <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm animate-pulse">신규 (New)</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-slate-500 bg-slate-100 font-medium">읽음 (Archived)</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[500px] truncate text-slate-600 text-sm font-medium">
                                        {report.summary_markdown.replace(/[#*`\-]/g, '').trim().slice(0, 120)}...
                                    </TableCell>
                                    <TableCell className="text-right no-drag">
                                        <Button size="icon" variant="ghost" className="hover:bg-blue-50" onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewReport(report);
                                        }}>
                                            <Eye className="h-4 w-4 text-blue-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Rich Report Dialog */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-white border border-slate-200 text-slate-900 shadow-2xl">
                    {selectedReport && (
                        <>
                            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl">
                                                {format(new Date(selectedReport!.report_date), 'yyyy년 MM월 dd일 시스템 리포트')}
                                            </DialogTitle>
                                            <DialogDescription>
                                                종합 데이터 분석 및 AI 인사이트
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Badge variant="outline" className="text-xs font-mono mr-2">
                                            ID: {selectedReport!.id}
                                        </Badge>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 ml-2 border-orange-200 hover:bg-orange-50 text-orange-600"
                                            onClick={() => fixMutation.mutate(selectedReport!.id)}
                                            disabled={fixMutation.isPending}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${fixMutation.isPending ? 'animate-spin' : ''}`} />
                                            즉시 문제 해결 (Auto-Fix)
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 ml-2"
                                            onClick={() => {
                                                const textToCopy = `
# ${format(new Date(selectedReport!.report_date), 'yyyy-MM-dd System Report')}

${selectedReport!.summary_markdown}

---
**Raw Stats:**
${JSON.stringify(selectedReport!.raw_stats_json, null, 2)}

**Auto-Fix Logs:**
${JSON.stringify(selectedReport!.auto_fix_log || [], null, 2)}
                                            `.trim();
                                                navigator.clipboard.writeText(textToCopy).then(() => {
                                                    alert("리포트 전체 내용이 클립보드에 복사되었습니다. (Full Report Copied)");
                                                }).catch(err => {
                                                    console.error('Failed to copy text: ', err);
                                                    alert("복사에 실패했습니다. (Copy failed)");
                                                });
                                            }}
                                        >
                                            <Copy className="h-4 w-4" />
                                            리포트 전체 복사
                                        </Button>
                                    </div>
                                </div>
                            </DialogHeader>

                            {/* Auto-Fix Logs Section */}
                            {(selectedReport!.auto_fix_log && selectedReport!.auto_fix_log.length > 0) && (
                                <div className="mx-6 mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" />
                                        자율 조치 로그 (Self-Healing Process)
                                    </h4>
                                    <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto custom-scrollbar">
                                        {selectedReport!.auto_fix_log.map((log: any, idx: number) => (
                                            <div key={idx} className={`flex gap-2 ${log.level === 'error' ? 'text-destructive' : log.level === 'success' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                <span className="text-muted-foreground opacity-50">[{format(new Date(log.timestamp), 'HH:mm:ss')}]</span>
                                                <span>{log.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* 1. Key Metrics Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Card className="bg-blue-50 border border-blue-100 text-blue-900">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <div className="mb-2 p-2 bg-blue-100 rounded-full">
                                                <Video className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-blue-700">
                                                {selectedReport!.raw_stats_json.videos_collected}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-medium">수집 영상</div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-purple-50 border border-purple-100 text-purple-900">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <div className="mb-2 p-2 bg-purple-100 rounded-full">
                                                <Scroll className="h-5 w-5 text-purple-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-purple-700">
                                                {selectedReport!.raw_stats_json.scripts_collected}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-medium">수집 스크립트</div>
                                        </CardContent>
                                    </Card>

                                    <Card className={selectedReport!.raw_stats_json.failed_downloads > 0
                                        ? "bg-red-50 border border-red-100 text-red-900"
                                        : "bg-green-50 border border-green-100 text-green-900"
                                    }>
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <div className={selectedReport!.raw_stats_json.failed_downloads > 0
                                                ? "mb-2 p-2 bg-red-100 rounded-full"
                                                : "mb-2 p-2 bg-green-100 rounded-full"
                                            }>
                                                {selectedReport!.raw_stats_json.failed_downloads > 0
                                                    ? <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                                                    : <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                }
                                            </div>
                                            <div className={selectedReport!.raw_stats_json.failed_downloads > 0
                                                ? "text-2xl font-bold text-red-700"
                                                : "text-2xl font-bold text-green-700"
                                            }>
                                                {selectedReport!.raw_stats_json.failed_downloads}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-medium">실패 오류</div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <div className="mb-2 p-2 bg-slate-100 rounded-full">
                                                <TrendingUp className="h-5 w-5 text-slate-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {selectedReport!.raw_stats_json.trends_cached}
                                            </div>
                                            <div className="text-xs text-slate-600 font-medium">트렌드 갱신</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* [NEW] System Infrastructure Card */}
                                {selectedReport!.raw_stats_json.system_health && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                                                <div className="text-sm font-semibold text-slate-800">💾 저장소 ({selectedReport!.raw_stats_json.system_health.storage.free_gb}GB Free)</div>
                                                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${selectedReport!.raw_stats_json.system_health.storage.percent}%` }} />
                                                </div>
                                                <div className="text-xs text-slate-600 mt-1">{selectedReport!.raw_stats_json.system_health.storage.percent}% 사용 중</div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                                                <div className="text-sm font-semibold text-slate-800">🗄️ DB 크기</div>
                                                <div className="text-lg font-bold text-slate-800 mt-1">{selectedReport!.raw_stats_json.system_health.db_size_mb} MB</div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                                                <div className="text-sm font-semibold text-slate-800">🧟 좀비 태스크</div>
                                                <div className={`text-lg font-bold mt-1 ${selectedReport!.raw_stats_json.system_health.zombie_tasks > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                                    {selectedReport!.raw_stats_json.system_health.zombie_tasks}개
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* [NEW] Operational Intelligence Card */}
                                {selectedReport!.raw_stats_json.operational_metrics && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-800">
                                                    <RefreshCw className="h-4 w-4" /> 웹 검색 엔진 상태
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                                                            <span>SearXNG (Self-Hosted)</span>
                                                            <span className="font-mono">
                                                                {selectedReport!.raw_stats_json.operational_metrics.search.searxng.success} OK / {selectedReport!.raw_stats_json.operational_metrics.search.searxng.fail} Fail
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full ${selectedReport!.raw_stats_json.operational_metrics.search.searxng.fail > 0 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                                style={{ width: `${(selectedReport!.raw_stats_json.operational_metrics.search.searxng.success / (selectedReport!.raw_stats_json.operational_metrics.search.searxng.success + selectedReport!.raw_stats_json.operational_metrics.search.searxng.fail + 0.1)) * 100}%` }}
                                                             />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                                                            <span>Tavily (Fallback)</span>
                                                            <span className="font-mono">{selectedReport!.raw_stats_json.operational_metrics.search.tavily.success} Used</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                            <div className="bg-blue-50 h-1.5 rounded-full" style={{ width: '100%' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="bg-slate-50 border border-slate-200 text-slate-900">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-800">
                                                    <Activity className="h-4 w-4" /> AI 엔진/LLM 상태
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-4 text-center">
                                                    <div>
                                                        <div className="text-2xl font-bold text-slate-800">
                                                            {selectedReport!.raw_stats_json.operational_metrics.llm.requests}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">총 요청 수</div>
                                                    </div>
                                                    <div>
                                                        <div className={`text-2xl font-bold ${selectedReport!.raw_stats_json.operational_metrics.llm.rate_limits > 0 ? 'text-destructive' : 'text-slate-800'}`}>
                                                            {selectedReport!.raw_stats_json.operational_metrics.llm.rate_limits}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Rate Limits</div>
                                                    </div>
                                                </div>
                                                {selectedReport!.raw_stats_json.operational_metrics.llm.rate_limits > 0 && (
                                                    <div className="mt-3 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                                                        ⚠️ API 키 회전이 {selectedReport!.raw_stats_json.operational_metrics.llm.rate_limits}회 발생했습니다.
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* 2. Visual Charts */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium">콘텐츠 수집 효율성</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[250px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={getChartData(selectedReport!.raw_stats_json).contentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 12 }} />
                                                    <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                                        {getChartData(selectedReport!.raw_stats_json).contentData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium">채널 운영 상태</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[250px] flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={getChartData(selectedReport!.raw_stats_json).channelData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {getChartData(selectedReport!.raw_stats_json).channelData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* 3. AI Analysis Report */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <h3 className="font-semibold text-lg text-slate-800">AI 상세 분석 브리핑</h3>
                                    </div>
                                    <div className="prose prose-slate max-w-none bg-slate-50 p-8 rounded-xl border border-slate-200 shadow-inner text-slate-800">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={markdownComponents}
                                        >
                                            {selectedReport!.summary_markdown}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
