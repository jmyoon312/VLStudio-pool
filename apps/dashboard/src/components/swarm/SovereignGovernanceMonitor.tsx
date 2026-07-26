import React from 'react';
import { ShieldCheck, Smartphone, History, ArrowRight, TrendingUp, Coins } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

interface SovereignGovernanceMonitorProps {
    cost: number;
    revenue: number;
    pending: number;
}

export const SovereignGovernanceMonitor: React.FC<SovereignGovernanceMonitorProps> = ({ 
    cost, 
    revenue, 
    pending 
}) => {
    return (
        <Card className="h-full border-0 shadow-3xl bg-white rounded-[3.5rem] p-12 space-y-10 text-slate-900 relative overflow-hidden group border border-slate-100 transition-all duration-700 hover:shadow-emerald-100/30">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.05),transparent)] pointer-events-none" />
            
            <div className="relative z-10 flex items-center justify-between">
                <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-indigo-600" /> 시스템 거버넌스
                </h4>
                <Badge variant="outline" className="border-slate-200 text-slate-600 font-black text-[9px] uppercase px-4 py-1.5 rounded-full tracking-widest bg-slate-50">24시간 자동 감사 활성</Badge>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-12">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">예상 운영 비용 (OPEX)</span>
                        <Badge className="bg-rose-50 text-rose-500 border-0 text-[8px] font-black h-4 px-1.5 uppercase">Live</Badge>
                    </div>
                    <div className="text-5xl font-black italic tracking-tighter tabular-nums text-slate-900">${cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" /> Tokens / Compute / Storage
                    </p>
                </div>
                
                <div className="space-y-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <Badge className="bg-emerald-50 text-emerald-500 border-0 text-[8px] font-black h-4 px-1.5 uppercase">Estimated</Badge>
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">바이럴 수익 예측 (ROAS)</span>
                    </div>
                    <div className="text-5xl font-black italic text-indigo-600 tracking-tighter tabular-nums">${revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <p className="text-[8px] font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-2 justify-end">
                        RPM Dynamic Integrated v2.1 <div className="w-1.5 h-1.5 bg-indigo-100 rounded-full" />
                    </p>
                </div>
            </div>

            <div className="relative z-10 p-8 bg-slate-50/80 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 flex items-center justify-between group-hover:bg-slate-100 transition-all duration-500 shadow-inner">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-500 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-amber-200/50 relative overflow-hidden group/btn">
                        <div className="absolute inset-0 bg-white/20 translate-y-16 group-hover/btn:translate-y-0 transition-transform duration-500" />
                        <History className="w-8 h-8 text-white relative z-10" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">대기 중인 전문가 개입 (HITL)</span>
                        <h5 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900 tabular-nums">{pending}건의 승인 대기</h5>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-14 w-14 rounded-[1.2rem] hover:bg-white text-slate-700 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-slate-100"
                >
                    <ArrowRight className="w-6 h-6" />
                </Button>
            </div>
            
            <div className="relative z-10 flex items-center gap-8 px-2 pt-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Sovereign Integrity: 100%</span>
                </div>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Efficiency: 94.2%</span>
                </div>
            </div>
        </Card>
    );
};
