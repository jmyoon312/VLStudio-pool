import React from 'react';
import { Sword, X, ShieldAlert, Zap, Rocket, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConquestManualProps {
    target: any | null;
    onClose: () => void;
    onInitiateMission: (candidateId: number) => void;
}

export const ConquestManual: React.FC<ConquestManualProps> = ({ target, onClose, onInitiateMission }) => {
    if (!target) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-[100] flex items-center justify-end p-6 pointer-events-none">
            <div className="w-[550px] h-full bg-card shadow-[0_0_120px_rgba(0,0,0,0.15)] dark:shadow-[0_0_120px_rgba(0,0,0,0.6)] rounded-[3.5rem] p-10 flex flex-col animate-in slide-in-from-right-full duration-500 pointer-events-auto relative border border-border backdrop-blur-xl">
                {/* Close Button */}
                <div className="absolute top-8 right-8">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-foreground rounded-full bg-muted hover:bg-accent transition-all"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Header: Tactical Identity */}
                <div className="flex items-center gap-5 mb-10">
                    <div className="p-5 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] shadow-2xl shadow-indigo-900/20 dark:shadow-indigo-900/50 ring-4 ring-white/5">
                        <Sword className="w-9 h-9 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-foreground italic uppercase tracking-tighter leading-none">Conquest Manual</h2>
                        <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                            Target Intelligence: {target.channel_name}
                        </p>
                    </div>
                </div>

                <ScrollArea className="flex-1 -mx-4 px-4 pr-6">
                    <div className="space-y-10 pb-10">
                        {/* 1. Vulnerability Scan */}
                        <section>
                            <h3 className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                                <ShieldAlert className="w-5 h-5" /> Vulnerability Scan Report
                            </h3>
                            <div className="grid gap-3">
                                {(!target.vulnerabilities || target.vulnerabilities.length === 0) ? (
                                    <div className="p-8 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-50">
                                        <p className="text-muted-foreground text-[11px] font-black uppercase tracking-widest">Generating Vulnerability Intel...</p>
                                    </div>
                                ) : (
                                    target.vulnerabilities.map((v: string, i: number) => (
                                        <div key={i} className="group p-5 bg-muted/30 border border-border rounded-3xl hover:bg-muted/60 transition-all border-l-4 border-l-amber-500/50">
                                            <p className="text-foreground text-[12px] font-bold leading-relaxed italic">"{v}"</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* 2. Strategic Counter-Moves */}
                        <section>
                            <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                                <Zap className="w-5 h-5" /> Tactical Counter-Moves
                            </h3>
                            <div className="space-y-4">
                                {(!target.conquest_plan || target.conquest_plan.length === 0) ? (
                                    <div className="p-8 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-50">
                                        <p className="text-muted-foreground text-[11px] font-black uppercase tracking-widest">Formulating Tactical Response...</p>
                                    </div>
                                ) : (
                                    target.conquest_plan.map((step: any, i: number) => (
                                        <div key={i} className="relative pl-12 group">
                                            <div className="absolute left-0 top-0 w-9 h-9 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                {step.step}
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-3xl border border-border group-hover:border-indigo-500/30 transition-all">
                                                <p className="text-foreground text-sm font-black mb-2 uppercase tracking-tight italic">{step.action}</p>
                                                <p className="text-muted-foreground text-[11px] font-bold leading-normal opacity-80">{step.reason}</p>
                                            </div>
                                            {i < target.conquest_plan.length - 1 && (
                                                <div className="absolute left-4 top-10 w-[1px] h-6 bg-indigo-500/20" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* 3. High-Velocity Content Hooks */}
                        <section>
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                                <Rocket className="w-5 h-5" /> High-Velocity Content Hooks
                            </h3>
                            <div className="grid gap-3">
                                {(!target.recommended_hooks || target.recommended_hooks.length === 0) ? (
                                    <div className="p-8 border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-50">
                                        <p className="text-muted-foreground text-[11px] font-black uppercase tracking-widest">Synthesizing Content Hooks...</p>
                                    </div>
                                ) : (
                                    target.recommended_hooks.map((hook: string, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-5 bg-gradient-to-r from-muted/50 to-transparent rounded-3xl border border-border group hover:border-indigo-400/50 transition-all cursor-pointer">
                                            <div className="flex-1">
                                                <p className="text-foreground text-[13px] font-black italic tracking-tight">"{hook}"</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </ScrollArea>
                
                {/* Action CTA */}
                <div className="mt-8 pt-8 border-t border-border">
                    <Button 
                        onClick={() => onInitiateMission(target.id)}
                        className="w-full h-18 bg-primary hover:bg-primary-hover text-primary-foreground font-black uppercase text-[14px] tracking-[0.25em] rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 group transition-all"
                    >
                        <Rocket className="w-6 h-6 group-hover:animate-bounce" /> 
                        미션 즉시 기동 (INITIATE MISSION)
                    </Button>
                </div>
            </div>
        </div>
    );
};
