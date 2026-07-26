import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
    Sparkles, Zap, Target, Film, Clapperboard, CheckCircle2, AlertTriangle,
    ExternalLink, Copy, Send, Image as ImageIcon, Gauge,
} from 'lucide-react';
import {
    ProductionResearchBrief, Hook, HOOK_TYPE_LABEL, BEAT_ROLE_LABEL,
    gateBadge, readinessColor, readinessPercent, bestHook, totalShortsSeconds,
    verifiedClaimCount, briefToScriptSeed,
} from '@/lib/researchBrain';

interface Props {
    brief: ProductionResearchBrief;
    onCopy?: (text: string) => void;
    onSendToScript?: (text: string, format: 'shorts' | 'longform') => void;
    onSearchAsset?: (query: string) => void;
    onOpenEditor?: (brief: ProductionResearchBrief) => void;
}

const HookCard: React.FC<{ hook: Hook; isBest: boolean }> = ({ hook, isBest }) => (
    <div className={cn(
        'rounded-md border p-2.5 flex flex-col gap-1.5',
        isBest ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200',
    )}>
        <div className="flex items-center justify-between gap-2">
            <Badge variant={isBest ? 'success' : 'secondary'} className="text-[9px]">
                {HOOK_TYPE_LABEL[hook.type]}
            </Badge>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Gauge className="w-3 h-3" />
                {hook.strength.toFixed(1)}
            </div>
        </div>
        <p className="text-xs text-slate-700 leading-snug">{hook.text}</p>
        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
                className={cn('h-full rounded-full', isBest ? 'bg-emerald-500' : 'bg-slate-400')}
                style={{ width: `${Math.round(hook.strength * 10)}%` }}
            />
        </div>
    </div>
);

const BriefDetail: React.FC<Props> = ({ brief, onCopy, onSendToScript, onSearchAsset, onOpenEditor }) => {
    const [beatView, setBeatView] = useState<'shorts' | 'longform'>('shorts');
    const gb = gateBadge(brief.gate?.status ?? '');
    const best = bestHook(brief);

    return (
        <div className="space-y-3">
            {/* Header: angle / promise / gate / readiness */}
            <Card className="border-indigo-100">
                <CardHeader className="py-3 px-4 border-b bg-indigo-50/30">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                <CardTitle className="text-sm truncate">{brief.topic}</CardTitle>
                                <Badge variant={gb.variant as any} className="text-[9px]">{gb.label}</Badge>
                                {brief.degraded && (
                                    <Badge variant="warning" className="text-[9px] flex items-center gap-0.5">
                                        <AlertTriangle className="w-2.5 h-2.5" /> 부분 생성
                                    </Badge>
                                )}
                            </div>
                            {brief.angle && <p className="text-xs text-slate-700"><span className="text-slate-400">앵글 · </span>{brief.angle}</p>}
                            {brief.promise && <p className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">약속 · </span>{brief.promise}</p>}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 w-28">
                            <span className={cn('text-lg font-bold tabular-nums', readinessColor(brief.production_readiness))}>
                                {brief.production_readiness.toFixed(1)}
                                <span className="text-[10px] text-slate-400 font-normal"> /10</span>
                            </span>
                            <Progress value={readinessPercent(brief.production_readiness)} className="h-1.5 mt-1" />
                            <span className="text-[9px] text-slate-400 mt-1">제작 준비도</span>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => onSendToScript?.(briefToScriptSeed(brief, 'shorts'), 'shorts')}>
                            <Film className="w-3 h-3 mr-1" /> 쇼츠 대본
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSendToScript?.(briefToScriptSeed(brief, 'longform'), 'longform')}>
                            <Clapperboard className="w-3 h-3 mr-1" /> 롱폼 대본
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onOpenEditor?.(brief)}>
                            <Clapperboard className="w-3 h-3 mr-1" /> 에이전트 컷
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={() => alert('mutation_engine.py 연동 필요: 10개 채널용 대본 변조 파이프라인 가동')}>
                            <Sparkles className="w-3 h-3 mr-1" /> Warp Script (10개 변조)
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCopy?.(briefToScriptSeed(brief, beatView))}>
                            <Copy className="w-3 h-3 mr-1" /> 복사
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Hook bank */}
            <Card>
                <CardHeader className="py-2 px-4 border-b">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <CardTitle className="text-xs">후킹 뱅크</CardTitle>
                        <Badge variant="outline" className="text-[9px]">{brief.hook_bank.length}개</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {brief.hook_bank.length === 0 ? (
                        <p className="text-xs text-slate-400">후킹이 생성되지 않았습니다.</p>
                    ) : (
                        brief.hook_bank.map((h, i) => <HookCard key={i} hook={h} isBest={best === h} />)
                    )}
                </CardContent>
            </Card>

            {/* Narrative beats: shorts / longform toggle */}
            <Card>
                <CardHeader className="py-2 px-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-500" />
                            <CardTitle className="text-xs">내러티브 비트</CardTitle>
                        </div>
                        <div className="flex rounded-md border overflow-hidden">
                            <button
                                className={cn('px-2 py-0.5 text-[10px]', beatView === 'shorts' ? 'bg-blue-500 text-white' : 'text-slate-500')}
                                onClick={() => setBeatView('shorts')}
                            >
                                쇼츠 {totalShortsSeconds(brief)}s
                            </button>
                            <button
                                className={cn('px-2 py-0.5 text-[10px]', beatView === 'longform' ? 'bg-blue-500 text-white' : 'text-slate-500')}
                                onClick={() => setBeatView('longform')}
                            >
                                롱폼 {brief.narrative_beats.longform.length}챕터
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                    {beatView === 'shorts' ? (
                        brief.narrative_beats.shorts.length === 0 ? (
                            <p className="text-xs text-slate-400">쇼츠 비트가 없습니다.</p>
                        ) : brief.narrative_beats.shorts.map((b, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Badge variant={b.role === 'hook' ? 'warning' : 'secondary'} className="text-[9px] flex-shrink-0 mt-0.5">
                                    {BEAT_ROLE_LABEL[b.role]} · {b.seconds}s
                                </Badge>
                                <p className="text-xs text-slate-700 leading-snug">{b.text}</p>
                            </div>
                        ))
                    ) : (
                        brief.narrative_beats.longform.length === 0 ? (
                            <p className="text-xs text-slate-400">롱폼 챕터가 없습니다.</p>
                        ) : brief.narrative_beats.longform.map((ch) => (
                            <div key={ch.index} className="border-l-2 border-blue-200 pl-2 py-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">{ch.index}. {ch.title}</span>
                                    <span className="text-[9px] text-slate-400">{ch.seconds}s</span>
                                </div>
                                <p className="text-xs text-slate-500">{ch.beat}</p>
                                {ch.rehook && <p className="text-[10px] text-amber-600 mt-0.5">↻ {ch.rehook}</p>}
                                {ch.broll_query && (
                                    <button
                                        className="text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5 mt-0.5"
                                        onClick={() => onSearchAsset?.(ch.broll_query!)}
                                    >
                                        <ImageIcon className="w-2.5 h-2.5" /> {ch.broll_query}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Atomic claims */}
            <Card>
                <CardHeader className="py-2 px-4 border-b">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <CardTitle className="text-xs">검증된 사실</CardTitle>
                        <Badge variant="outline" className="text-[9px]">
                            {verifiedClaimCount(brief)}/{brief.atomic_claims.length} 검증
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                    {brief.atomic_claims.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                            {c.verified
                                ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                                <span className="text-slate-700">{c.claim}</span>
                                {c.exact_stat && <Badge variant="info" className="text-[8px] ml-1">{c.exact_stat}</Badge>}
                                {c.emotion_trigger && <span className="text-[9px] text-rose-400 ml-1">#{c.emotion_trigger}</span>}
                                {c.source_url && (
                                    <a href={c.source_url} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-600 ml-1 inline-flex">
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    {brief.contradictions.length > 0 && (
                        <>
                            <Separator className="my-2" />
                            <div className="text-[10px] text-amber-600">
                                ⚠ 출처 충돌 {brief.contradictions.length}건 감지됨
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Format card */}
            {(brief.format_card.story_arc.length > 0 || brief.format_card.source_replacement_query) && (
                <Card className="border-purple-100">
                    <CardHeader className="py-2 px-4 border-b bg-purple-50/30">
                        <div className="flex items-center gap-2">
                            <Clapperboard className="w-4 h-4 text-purple-500" />
                            <CardTitle className="text-xs">포맷 카드 (복제용 DNA)</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                        {brief.format_card.story_arc.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                {brief.format_card.story_arc.map((s, i) => (
                                    <React.Fragment key={i}>
                                        <Badge variant="secondary" className="text-[9px]">{s}</Badge>
                                        {i < brief.format_card.story_arc.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        {brief.format_card.source_replacement_query && (
                            <button
                                className="text-[11px] text-indigo-500 hover:underline flex items-center gap-1"
                                onClick={() => onSearchAsset?.(brief.format_card.source_replacement_query!)}
                            >
                                <ImageIcon className="w-3 h-3" />
                                다른 소스 찾기: "{brief.format_card.source_replacement_query}"
                            </button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default BriefDetail;
