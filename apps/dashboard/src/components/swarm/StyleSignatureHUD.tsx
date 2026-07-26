import React from 'react';
import { Fingerprint, Zap, Sparkles, Activity, Dna, BrainCircuit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';

interface StyleSignatureHUDProps {
    pacing: number;
    hook: number;
    tone: string;
    semanticFlux: number;
}

export const StyleSignatureHUD: React.FC<StyleSignatureHUDProps> = ({ 
    pacing, 
    hook, 
    tone, 
    semanticFlux 
}) => {
    return (
        <Card className="h-full border border-border shadow-3xl bg-card rounded-[3.5rem] p-12 space-y-10 hover:shadow-primary/10 transition-all duration-700 relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
            
            <div className="relative z-10 flex items-center justify-between">
                <h4 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-3">
                    <Dna className="w-5 h-5 text-indigo-600" /> 스타일 시그니처 DNA
                </h4>
                <Badge className="bg-primary text-primary-foreground border-0 font-black text-[9px] uppercase tracking-widest px-3 py-1 scale-110 shadow-lg shadow-primary/10">실시간 분석</Badge>
            </div>

            <div className="relative z-10 space-y-8">
                {[
                    { label: '호흡 및 리듬 (Pacing)', value: pacing * 100, icon: Activity, color: 'bg-indigo-600' },
                    { label: '바이럴 훅 지표 (Hook)', value: hook * 100, icon: Zap, color: 'bg-emerald-500' },
                    { label: '시맨틱 밀도 (Semantic)', value: semanticFlux * 100, icon: BrainCircuit, color: 'bg-amber-500' },
                ].map((m, i) => (
                    <div key={i} className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <m.icon className="w-3.5 h-3.5 opacity-50" /> {m.label}
                            </span>
                            <span className="text-xs font-black italic tabular-nums">{m.value.toFixed(1)}%</span>
                        </div>
                        <Progress value={m.value} className={cn("h-1.5", m.color)} />
                    </div>
                ))}
                
                <div className="pt-6 border-t border-border flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">마스터 톤 프로필_</span>
                        <span className="text-sm font-black text-indigo-600 italic uppercase leading-none mt-1">{tone || 'Aggressive Cinematic'}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl border border-border">
                        <Fingerprint className="w-4 h-4 text-foreground" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">Identity Verified</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};
