import React from 'react';
import { Compass, Zap, Rocket, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BlueOceanPanelProps {
    data: any[] | null;
    isLoading: boolean;
    onRefetch: () => void;
}

export const BlueOceanPanel: React.FC<BlueOceanPanelProps> = ({ data, isLoading, onRefetch }) => {
    return (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[3.5rem] shadow-3xl animate-in slide-in-from-top-6 duration-700 border border-indigo-500/20 relative overflow-hidden">
            {/* Background Aesthetic */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -mr-64 -mt-64" />
            
            <div className="flex flex-col md:flex-row items-center justify-between mb-10 relative z-10 gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-amber-500 rounded-3xl shadow-xl shadow-amber-900/40 ring-4 ring-white/5">
                        <Compass className="w-8 h-8 text-white animate-spin-slow" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none flex items-center gap-3">
                            Blue Ocean Discovery
                            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] font-black uppercase px-3 py-1">Predictive v7.0</Badge>
                        </h2>
                        <p className="text-indigo-300 text-[11px] font-bold uppercase tracking-[0.3em] mt-2 opacity-80 italic">
                            Synthesizing hidden intersections from your master interests
                        </p>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    className="h-14 px-10 rounded-2xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 text-[11px] font-black uppercase tracking-widest transition-all"
                    onClick={onRefetch}
                    disabled={isLoading}
                >
                    <Rocket className={cn("w-4 h-4 mr-3", isLoading && "animate-pulse")} /> 
                    {isLoading ? "CALCULATING NICHES..." : "새로운 항로 개척 (RE-SYNTHESIZE)"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {isLoading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white/5 animate-pulse rounded-[2.5rem] border border-white/5" />
                    ))
                ) : (
                    data?.map((ocean: any, i: number) => (
                        <div 
                            key={i} 
                            className="group bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 hover:bg-white/10 hover:border-indigo-500/40 transition-all duration-500 cursor-pointer relative flex flex-col h-full"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <Badge className="bg-indigo-600/50 text-white text-[9px] font-black px-4 py-1.5 rounded-full border-0">
                                    {ocean.potential_score}% VIRAL POTENTIAL
                                </Badge>
                                <Sparkles className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            
                            <h3 className="text-amber-400 font-black uppercase text-lg mb-4 italic tracking-tight group-hover:translate-x-1 transition-transform">{ocean.category_name}</h3>
                            
                            <p className="text-white/60 text-[11px] font-bold leading-relaxed mb-8 opacity-80 group-hover:opacity-100 transition-opacity">
                                {ocean.logic}
                            </p>
                            
                            <div className="mt-auto space-y-4 pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between text-indigo-300">
                                    <span className="text-[8px] font-black uppercase tracking-widest">Recommended Aesthetic</span>
                                    <span className="text-[9px] font-black italic">{ocean.aesthetic}</span>
                                </div>
                                <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 group-hover:bg-indigo-600/20 transition-all">
                                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">First Mission Concept</p>
                                    <p className="text-white/90 text-[10px] font-bold italic line-clamp-2">"{ocean.first_video_concept}"</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
