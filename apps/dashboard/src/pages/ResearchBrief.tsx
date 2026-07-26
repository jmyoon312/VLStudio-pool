import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import {
    Search, Globe, Sparkles, FileText, ExternalLink, Loader2,
    TrendingUp, ChevronDown, ChevronRight, Copy, Check, BookOpen,
    Zap, Activity, BarChart3, Lightbulb, Newspaper
} from 'lucide-react';

interface Source {
    title: string;
    url: string;
    snippet: string;
}

interface ResearchResponse {
    topic: string;
    summary: string;
    sources: Source[];
    key_findings: string;
    model_used: string;
}

const ResearchBrief = () => {
    const [topic, setTopic] = useState("");
    const [niche, setNiche] = useState("");
    const [result, setResult] = useState<ResearchResponse | null>(null);
    const [showSources, setShowSources] = useState(false);
    const [copied, setCopied] = useState(false);

    const researchMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/research/brief', {
                topic,
                niche: niche || undefined
            }, { timeout: 180000 });
            return res.data;
        },
        onSuccess: (data: ResearchResponse) => {
            setResult(data);
            setShowSources(true);
            toast.success(`리서치 브리프 생성 완료! (${data.model_used})`);
        },
        onError: (err: any) => {
            toast.error("리서치 실패: " + (err.response?.data?.detail || err.message));
        }
    });

    const handleCopySummary = async () => {
        if (!result) return;
        const text = `## Research Brief: ${result.topic}\n\n### Key Findings\n${result.key_findings}\n\n### Summary\n${result.summary}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("복사 완료");
        } catch {
            toast.error("복사 실패");
        }
    };

    const handleSendToScript = () => {
        if (!result) return;
        window.open(`/#/script-writer`, '_blank');
        setTimeout(() => {
            localStorage.setItem('viral_loop_script_writer_input',
                `Research Topic: ${result.topic}\n\nKey Findings:\n${result.key_findings}\n\n${result.summary}`
            );
        }, 100);
        toast.success("스크립트 작성기로 전송됨");
    };

    return (
        <div className="flex-1 flex flex-col gap-4 p-4 min-h-0">
            <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">리서치 브리프</h1>
                <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">
                    웹 검색 + AI 요약
                </Badge>
            </div>

            {/* Input Card */}
            <Card className="flex-shrink-0">
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <Label>리서치 주제</Label>
                            <Input
                                placeholder="예: AI가 일자리를 대체하는 방법, 2026 K-Pop 트렌드..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && topic.trim()) researchMutation.mutate(); }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>분야 (Niche) - 선택</Label>
                            <Input
                                placeholder="Tech, Gaming, Health..."
                                value={niche}
                                onChange={(e) => setNiche(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={() => researchMutation.mutate()}
                            disabled={researchMutation.isPending || !topic.trim()}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                            {researchMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Search className="w-4 h-4 mr-2" />
                            )}
                            리서스 브리프 생성
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {researchMutation.isPending && (
                <Card>
                    <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        <span className="text-sm">웹 검색 및 AI 분석 중...</span>
                        <span className="text-[10px] text-slate-400">최대 3분 소요될 수 있습니다</span>
                    </CardContent>
                </Card>
            )}

            {result && !researchMutation.isPending && (
                <>
                    {/* Key Findings Card */}
                    {result.key_findings && (
                        <Card className="border-emerald-200 dark:border-emerald-900 flex-shrink-0">
                            <CardHeader className="py-3 px-4 border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                                <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                                    <CardTitle className="text-sm text-emerald-800 dark:text-emerald-200">핵심 발견 (Key Findings)</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    {result.key_findings}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary Card */}
                    <Card className="flex-1 min-h-0">
                        <CardHeader className="py-3 px-4 border-b bg-blue-50/50 dark:bg-blue-950/20">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Newspaper className="w-4 h-4 text-blue-600" />
                                    <CardTitle className="text-sm text-blue-800 dark:text-blue-200">요약 리포트</CardTitle>
                                    <Badge variant="outline" className="text-[9px] border-blue-200">{result.model_used}</Badge>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSendToScript}>
                                        <FileText className="w-3 h-3 mr-1" />
                                        스크립트로
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopySummary}>
                                        {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                        {copied ? "복사됨" : "복사"}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <CardContent className="p-4">
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    {result.summary}
                                </div>
                            </CardContent>
                        </ScrollArea>
                    </Card>

                    {/* Sources Card */}
                    {result.sources.length > 0 && (
                        <Card className="flex-shrink-0">
                            <button
                                onClick={() => setShowSources(!showSources)}
                                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">출처 ({result.sources.length})</span>
                                </div>
                                {showSources ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {showSources && (
                                <CardContent className="px-4 pb-4 pt-2 border-t space-y-2">
                                    {result.sources.map((src, i) => (
                                        <div key={i} className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{src.title}</span>
                                                {src.url && (
                                                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                            {src.snippet && (
                                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{src.snippet}...</p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            )}
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default ResearchBrief;
