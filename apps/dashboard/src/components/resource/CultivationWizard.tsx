import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Leaf, Target, Users, ShieldAlert, Loader2, CalendarClock, Sparkles, Eye, Search, MessageSquare, Dices } from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

const STRATEGIES = [
    {
        id: 'INITIAL',
        title: '초기 인큐베이팅',
        icon: <Leaf className="w-5 h-5 text-green-500" />,
        desc: '신규 채널의 섀도우밴을 방지하고 휴먼 트러스트 점수를 구축합니다.',
        timeline: '7일 코스 (Stage 1 → Stage 2 → Stage 3)',
        color: 'border-green-500/50 hover:border-green-500 bg-green-500/5'
    },
    {
        id: 'NICHE_PIVOT',
        title: '니치/알고리즘 재학습',
        icon: <Target className="w-5 h-5 text-blue-500" />,
        desc: '채널의 주제를 변경하거나 타겟 시청자층을 새롭게 세팅합니다.',
        timeline: '무한 반복 (Stage 2 집중 수행)',
        color: 'border-blue-500/50 hover:border-blue-500 bg-blue-500/5'
    },
    {
        id: 'TRAFFIC_HIJACK',
        title: '트래픽 유도 (커뮤니티)',
        icon: <Users className="w-5 h-5 text-purple-500" />,
        desc: '경쟁 채널에 우호적 댓글을 남겨 자연스러운 오가닉 트래픽을 유입시킵니다.',
        timeline: '무한 반복 (Stage 3 집중 수행)',
        color: 'border-purple-500/50 hover:border-purple-500 bg-purple-500/5'
    },
    {
        id: 'DEATH_VALLEY',
        title: '데스밸리(소프트밴) 복구',
        icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
        desc: '상업적 활동 이력을 덮고 순수 시청자 모드로 돌아가 페널티를 해제합니다.',
        timeline: '7일 코스 (Stage 1 → Stage 2)',
        color: 'border-red-500/50 hover:border-red-500 bg-red-500/5'
    }
];

interface CultivationWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channel: any;
}

export const CultivationWizard = ({ open, onOpenChange, channel }: CultivationWizardProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [selectedStrategy, setSelectedStrategy] = useState<string>('');
    const [isActive, setIsActive] = useState(false);
    const [targetNiche, setTargetNiche] = useState<string>('');

    useEffect(() => {
        if (open && channel) {
            setSelectedStrategy(channel.cultivation_strategy || 'INITIAL');
            setIsActive(channel.cultivation_active || false);
        }
    }, [open, channel]);

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await axios.patch(`${API_BASE}/youtube/channels/${channel.channel_id}/cultivation`, {
                strategy: selectedStrategy,
                active: isActive,
                target_niche: targetNiche
            });
            return res.data;
        },
        onSuccess: () => {
            toast({
                title: "육성 전략 업데이트 완료",
                description: "채널의 자동 육성 스케줄이 저장되었습니다."
            });
            queryClient.invalidateQueries({ queryKey: ['captain-channels'] });
            queryClient.invalidateQueries({ queryKey: ['active-channel'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast({
                variant: "destructive",
                title: "저장 실패",
                description: err.response?.data?.detail || "알 수 없는 오류가 발생했습니다."
            });
        }
    });

    if (!channel) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <CalendarClock className="w-6 h-6 text-primary" />
                        전략적 채널 육성 마법사
                    </DialogTitle>
                    <DialogDescription>
                        {channel.channel_name} 채널의 알고리즘 최적화 및 육성 전략을 설정합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Strategy Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold text-foreground">1. 육성 시나리오 선택</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {STRATEGIES.map((s) => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedStrategy(s.id)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                        selectedStrategy === s.id ? s.color + ' ring-2 ring-primary/20 scale-[1.02]' : 'border-border/50 hover:border-border bg-card'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {s.icon}
                                        <h4 className="font-bold">{s.title}</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 h-10">
                                        {s.desc}
                                    </p>
                                    <Badge variant="secondary" className="text-[10px] w-full justify-center bg-background">
                                        ⏱ {s.timeline}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Niche Input Form (Only for INITIAL or NICHE_PIVOT) */}
                    {(selectedStrategy === 'INITIAL' || selectedStrategy === 'NICHE_PIVOT') && (
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label className="flex items-center gap-1.5 text-sm font-bold text-primary">
                                <Sparkles className="w-4 h-4" />
                                타겟 페르소나 및 니치 키워드
                            </Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                AI가 이 정보를 바탕으로 채널의 <b>최적화 DNA</b>를 자동 생성하여 시청 기록과 댓글을 정교하게 세팅합니다.
                            </p>
                            <Input 
                                placeholder="예: 50대 남성 캠핑 장비 리뷰, 사이버펑크 Lofi 음악..." 
                                value={targetNiche}
                                onChange={(e) => setTargetNiche(e.target.value)}
                                className="bg-background border-primary/20 focus-visible:ring-primary/30"
                            />
                        </div>
                    )}

                    {/* 7-Day Course Roadmap UI (Only for INITIAL) */}
                    {selectedStrategy === 'INITIAL' && (
                        <div className="bg-muted/20 p-4 rounded-xl border border-border/50 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <CalendarClock className="w-4 h-4 text-primary" />
                                    7-Day 섀도우밴 해제 로드맵
                                </Label>
                                <Badge variant="outline" className="text-[10px] bg-background border-primary/20 text-primary flex items-center gap-1">
                                    <Dices className="w-3 h-3" />
                                    AI 난수 변수 적용됨
                                </Badge>
                            </div>
                            
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                                
                                {/* Stage 1 */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted-foreground/10 text-muted-foreground group-[.is-active]:bg-primary/20 group-[.is-active]:text-primary group-[.is-active]:border-primary/30 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-300">
                                        <Eye className="w-4 h-4" />
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border bg-card shadow-sm group-[.is-active]:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm">Day 1~2</span>
                                            <Badge variant="secondary" className="text-[10px]">탐색 및 체류</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            순수 시청자 모드. 알고리즘 탐색 및 랜덤 영상 시청. 좋아요/구독 행동 일절 차단.
                                        </p>
                                    </div>
                                </div>

                                {/* Stage 2 */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted-foreground/10 text-muted-foreground group-[.is-active]:bg-primary/20 group-[.is-active]:text-primary group-[.is-active]:border-primary/30 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-300">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border bg-card shadow-sm group-[.is-active]:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm">Day 3~4</span>
                                            <Badge variant="secondary" className="text-[10px]">타겟 니치 딥다이브</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            AI 생성 롱테일 검색어 무작위 조합. 영상 끝까지(80% 이상) 시청. 간헐적 좋아요.
                                        </p>
                                    </div>
                                </div>

                                {/* Stage 3 */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted-foreground/10 text-muted-foreground group-[.is-active]:bg-primary/20 group-[.is-active]:text-primary group-[.is-active]:border-primary/30 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-300">
                                        <MessageSquare className="w-4 h-4" />
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border bg-card shadow-sm group-[.is-active]:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm">Day 5~7</span>
                                            <Badge variant="secondary" className="text-[10px]">커뮤니티 진입</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            10~20% 확률로 경쟁 채널 구독. DNA 페르소나 분석을 통한 사람 냄새나는 맞춤형 오가닉 댓글 작성.
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Automation Toggle */}
                    <div className="bg-muted/30 p-4 rounded-xl border flex items-start space-x-4">
                        <div className="mt-1">
                            <Switch 
                                id="auto-schedule" 
                                checked={isActive} 
                                onCheckedChange={setIsActive}
                            />
                        </div>
                        <div className="space-y-1 flex-1">
                            <Label htmlFor="auto-schedule" className="font-bold text-base cursor-pointer">
                                자동 스케줄러 활성화
                            </Label>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                켜두시면 매일 백그라운드에서 선택한 시나리오의 다음 일차(Day) 웜업이 자동으로 실행됩니다. 수동으로 돌리시려면 꺼두세요.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button 
                        onClick={() => mutation.mutate()} 
                        disabled={mutation.isPending}
                        className="min-w-[120px]"
                    >
                        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "설정 저장"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
