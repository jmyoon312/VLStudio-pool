import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
    BrainCircuit, 
    Search, 
    PenTool, 
    Video, 
    Settings, 
    ShieldCheck, 
    Activity,
    UploadCloud,
    Zap,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSwarmStore } from '@/hooks/useSwarmStore';

// ─── Agent Node Data Interface ───────────────────────────────────────────────
export interface AgentNodeData {
    label: string;
    role: 'COORDINATOR' | 'RESEARCHER' | 'WRITER' | 'MEDIA' | 'EDITOR' | 'PUBLISHER' | 'ANALYST';
    status: 'IDLE' | 'THINKING' | 'PRODUCING' | 'FAILED' | 'FINALIZING';
    skills: string[];
    isThinking?: boolean;
    onClick?: () => void;
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────
const getRoleIcon = (role: AgentNodeData['role']) => {
    switch (role) {
        case 'COORDINATOR': return <BrainCircuit className="w-5 h-5 text-primary" />;
        case 'RESEARCHER':  return <Search      className="w-5 h-5 text-emerald-500" />;
        case 'WRITER':      return <PenTool     className="w-5 h-5 text-amber-500" />;
        case 'MEDIA':       return <Video       className="w-5 h-5 text-rose-500" />;
        case 'EDITOR':      return <Settings    className="w-5 h-5 text-blue-500" />;
        case 'PUBLISHER':   return <UploadCloud className="w-5 h-5 text-fuchsia-500" />;
        case 'ANALYST':     return <Activity    className="w-5 h-5 text-cyan-500" />;
        default:            return <ShieldCheck className="w-5 h-5 text-slate-600" />;
    }
};

const getThemeColors = (role: AgentNodeData['role']) => {
    switch (role) {
        case 'COORDINATOR': return 'bg-primary/10  border-primary/20  text-primary shadow-primary/5';
        case 'RESEARCHER':  return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/5';
        case 'WRITER':      return 'bg-amber-500/10   border-amber-500/20   text-amber-500 shadow-amber-500/5';
        case 'MEDIA':       return 'bg-rose-500/10    border-rose-500/20    text-rose-500 shadow-rose-500/5';
        case 'EDITOR':      return 'bg-blue-500/10    border-blue-500/20    text-blue-500 shadow-blue-500/5';
        case 'PUBLISHER':   return 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500 shadow-fuchsia-500/5';
        case 'ANALYST':     return 'bg-cyan-500/10    border-cyan-500/20    text-cyan-500 shadow-cyan-500/5';
        default:            return 'bg-muted   border-border   text-foreground shadow-muted/5';
    }
};

// ─── Node Component ───────────────────────────────────────────────────────────
const AgentTopologyNode: React.FC<NodeProps<AgentNodeData>> = ({ data, isConnectable }) => {
    const activeSkill = useSwarmStore(state => state.activeSkillPerAgent[data.role] ?? '');
    const isExecuting  = !!activeSkill;
    const isThinking   = data.status === 'THINKING' || data.status === 'PRODUCING' || isExecuting;
    const isFailed     = data.status === 'FAILED';
    const themeClass   = getThemeColors(data.role);

    return (
        <div 
            className={cn(
                "relative group w-72 rounded-[2.5rem] border-2 shadow-2xl transition-all duration-500 cursor-pointer hover:scale-105",
                themeClass,
                isThinking ? "ring-8 ring-primary/10 shadow-primary/10" : "",
                isExecuting ? "ring-8 ring-amber-500/10 border-amber-500/50 shadow-amber-500/10" : "",
                isFailed    ? "border-rose-500 ring-8 ring-rose-500/10" : ""
            )}
            onClick={data.onClick}
        >
            {/* Target Handle */}
            <Handle type="target" position={Position.Top}
                className="w-5 h-5 bg-card border-2 border-border rounded-full -top-2.5 z-20 shadow-md"
                isConnectable={isConnectable}
            />

            <div className="p-6 flex flex-col h-full rounded-[2.5rem] overflow-hidden relative">
                {/* Background Accent */}
                <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 -mr-8 -mt-8 rounded-full", themeClass.split(' ')[0])} />

                {/* ── Header Row ── */}
                <div className="relative z-10 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm border bg-card/80",
                            isExecuting ? "border-amber-500/30" : "border-border"
                        )}>
                            {isExecuting
                                ? <Zap className="w-6 h-6 text-amber-500 animate-pulse" />
                                : getRoleIcon(data.role)
                            }
                        </div>
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
                                {data.role}
                            </div>
                            <h3 className="text-[13px] font-black text-foreground tracking-tighter italic uppercase truncate w-32">
                                {data.label}
                            </h3>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <Badge className={cn(
                        "text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-sm transition-all border shrink-0",
                        isThinking ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border",
                        isFailed   ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : ""
                    )}>
                        {isThinking ? (
                            <span className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 animate-spin" /> LIVE
                            </span>
                        ) : data.status}
                    </Badge>
                </div>

                {/* ── Skill Execution Banner ── */}
                <div className="relative z-10 mt-6 space-y-3">
                    {isExecuting ? (
                        <div className="bg-card/85 border border-amber-500/20 rounded-2xl p-4 shadow-inner">
                            <div className="flex items-center gap-3">
                                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                                <div>
                                    <div className="text-[7px] font-black text-amber-500 uppercase tracking-widest opacity-70">Executing Skill</div>
                                    <span className="text-[10px] font-black text-foreground uppercase tracking-tight truncate block w-40">
                                        {activeSkill}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {data.skills.slice(0, 3).map((skill, idx) => (
                                <span key={idx} className="bg-muted/60 px-2.5 py-1 rounded-lg text-[8px] font-black text-muted-foreground border border-border uppercase tracking-tighter">
                                    {skill}
                                </span>
                            ))}
                            {data.skills.length > 3 && (
                                <span className="bg-card px-2.5 py-1 rounded-lg text-[8px] font-black text-foreground border border-border uppercase">
                                    +{data.skills.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Source Handle */}
            <Handle type="source" position={Position.Bottom}
                className="w-5 h-5 bg-card border-2 border-border rounded-full -bottom-2.5 z-20 shadow-lg"
                isConnectable={isConnectable}
            />
        </div>
    );
};

export default AgentTopologyNode;
