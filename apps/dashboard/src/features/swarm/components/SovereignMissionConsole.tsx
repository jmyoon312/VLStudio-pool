import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Dna, 
    History, 
    ShieldCheck, 
    TrendingUp, 
    ChevronRight,
    Loader2,
    Database,
    Cpu
} from 'lucide-react';
import { ArtifactTimeline } from './ArtifactTimeline';
import { SovereignGovernanceMonitor } from './SovereignGovernanceMonitor';
import { Button } from "@/components/ui/button";
import { toast } from 'react-hot-toast';

interface SovereignMissionConsoleProps {
    sessionId: string;
    onClose: () => void;
}

export const SovereignMissionConsole: React.FC<SovereignMissionConsoleProps> = ({ 
    sessionId, 
    onClose 
}) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('timeline');

    // 1. Fetch Artifact History
    const { data: artifacts, isLoading: isArtifactsLoading } = useQuery({
        queryKey: ['mission_artifacts', sessionId],
        queryFn: async () => (await api.get(`/swarm/missions/${sessionId}/artifacts`)).data,
        refetchInterval: 10000 // Poll every 10s
    });

    // 2. Fetch Telemetry Data
    const { data: telemetry, isLoading: isTelemetryLoading } = useQuery({
        queryKey: ['mission_telemetry', sessionId],
        queryFn: async () => (await api.get(`/swarm/missions/${sessionId}/telemetry`)).data,
        refetchInterval: 5000 // Poll every 5s
    });

    // 3. Rollback Mutation
    const rollbackMutation = useMutation({
        mutationFn: (artifactId: number) => 
            api.post(`/swarm/missions/${sessionId}/rollback?artifact_id=${artifactId}`),
        onSuccess: () => {
            toast.success("성공적으로 공정이 되돌려졌습니다. 미션을 재개합니다.", {
                icon: '🔄',
                style: {
                    borderRadius: '16px',
                    background: '#1e293b',
                    color: '#fff',
                    fontWeight: 'bold',
                },
            });
            queryClient.invalidateQueries({ queryKey: ['mission_artifacts', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['swarmStatus'] });
            onClose();
        },
        onError: (error: any) => {
            toast.error(`롤백 실패: ${error.message}`);
        }
    });

    const handleRollback = (artifactId: number) => {
        if (window.confirm("정말로 해당 버전으로 공정을 되돌리시겠습니까? 이후의 모든 진행 데이터는 버전 이력으로 남지만, 현재 실행 상태는 리셋됩니다.")) {
            rollbackMutation.mutate(artifactId);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card rounded-[2.5rem] overflow-hidden shadow-2xl border border-border">
            {/* Console Header */}
            <div className="bg-primary p-8 text-primary-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <History className="w-24 h-24" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Dna className="w-4 h-4 text-primary-foreground/70" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground/70">시스템 동기화 및 관제 센터</span>
                        </div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3 leading-none">
                            Sovereign <span className="text-primary-foreground/80">관제 시스템 2.0</span>
                        </h2>
                        <div className="mt-4 flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-[9px] font-bold px-3 py-1">
                                ID: {sessionId.substring(0, 12)}...
                            </Badge>
                            <Badge className="bg-emerald-500 text-white border-0 text-[9px] font-black uppercase">
                                <ShieldCheck className="w-3 h-3 mr-1" /> 무결성 검증 완료
                            </Badge>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Console Body */}
            <div className="flex-1 p-8 overflow-hidden bg-muted/30">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted p-1 rounded-2xl h-12">
                        <TabsTrigger value="timeline" className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <History className="w-3.5 h-3.5" /> 타임라인 & 롤백
                        </TabsTrigger>
                        <TabsTrigger value="telemetry" className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                            <TrendingUp className="w-3.5 h-3.5" /> 거버넌스 텔레메트리
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="timeline" className="flex-1 mt-0 outline-none">
                        <div className="flex flex-col h-full gap-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black italic uppercase tracking-tighter text-foreground">아티팩트 레지스트리 (Artifact Registry)</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">단계별 산출물 버전 관리 및 물리적 롤백 포인트</p>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['mission_artifacts', sessionId] })}
                                    className="rounded-xl border-border h-10 px-4 font-black text-[10px] uppercase tracking-widest"
                                >
                                    {isArtifactsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 mr-2" />}
                                    갱신 (Refresh)
                                </Button>
                            </div>
                            
                            <div className="flex-1 bg-card border border-border rounded-[2rem] p-6 shadow-sm overflow-hidden">
                                {isArtifactsLoading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <ArtifactTimeline 
                                        artifacts={artifacts || []} 
                                        onRollback={handleRollback}
                                    />
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="telemetry" className="flex-1 mt-0 outline-none">
                        <div className="flex flex-col h-full gap-6">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black italic uppercase tracking-tighter text-foreground">운영 거버넌스 (Operational Governance)</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">실시간 토큰 사용량 및 에이전트별 운영 비용 시각화</p>
                            </div>

                            <SovereignGovernanceMonitor 
                                data={telemetry} 
                                isLoading={isTelemetryLoading} 
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            
            {/* Footer Console Info */}
            <div className="px-8 py-4 bg-card border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">운영 준비 완료</span>
                    </div>
                </div>
                <div className="text-[9px] font-mono text-muted-foreground">
                    ViraLoop Sovereign C2 Dashboard // Build 2026.04.21_STABLE
                </div>
            </div>
        </div>
    );
};
