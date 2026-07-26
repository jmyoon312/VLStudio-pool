import React from 'react';
import { 
    Clock, 
    ChevronRight, 
    History, 
    CheckCircle2, 
    RotateCcw,
    FileText,
    Video,
    Languages,
    Database
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Artifact {
    id: number;
    node_id: string;
    stage: string;
    version: number;
    created_at: string;
    is_active: boolean;
    checksum: string;
}

interface ArtifactTimelineProps {
    artifacts: Artifact[];
    onRollback: (artifactId: number) => void;
    currentStageNodeId?: string;
}

const STAGE_ICONS: Record<string, any> = {
    'WRITERNODE': FileText,
    'CREATIVENODE': Database,
    'VIDEOGENNODE': Video,
    'MEDIAGENNODE': Video,
    'LOCALIZERNODE': Languages
};

const STAGE_LABELS: Record<string, string> = {
    'WRITERNODE': '대본 작성',
    'CREATIVENODE': '크리에이티브 엔진',
    'VIDEOGENNODE': 'AI 영상 생성',
    'MEDIAGENNODE': '에셋 최적화',
    'LOCALIZERNODE': '로컬라이징'
};

export const ArtifactTimeline: React.FC<ArtifactTimelineProps> = ({ 
    artifacts, 
    onRollback,
    currentStageNodeId 
}) => {
    // Group artifacts by stage
    const stages = artifacts.reduce((acc, art) => {
        if (!acc[art.node_id]) acc[art.node_id] = [];
        acc[art.node_id].push(art);
        return acc;
    }, {} as Record<string, Artifact[]>);

    const sortedNodeIds = Object.keys(stages).sort((a, b) => {
        // Simple sort by timestamp of the first artifact in each group
        return new Date(stages[a][0].created_at).getTime() - new Date(stages[b][0].created_at).getTime();
    });

    return (
        <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-border">
                {sortedNodeIds.map((nodeId) => {
                    const nodeArtifacts = stages[nodeId].sort((a, b) => b.version - a.version);
                    const latest = nodeArtifacts[0];
                    const Icon = STAGE_ICONS[latest.stage] || Clock;
                    const isCurrent = nodeId === currentStageNodeId;

                    return (
                        <div key={nodeId} className="relative pl-12">
                            {/* Stage Icon Dot */}
                            <div className={cn(
                                "absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all shadow-sm",
                                isCurrent ? "bg-primary text-primary-foreground shadow-md scale-110" : "bg-card border border-border text-muted-foreground"
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-black text-foreground uppercase tracking-tight">
                                            {STAGE_LABELS[latest.stage] || latest.stage}
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{nodeId}</p>
                                    </div>
                                    {isCurrent && (
                                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black animate-pulse">
                                        현재 가동 단계
                                    </Badge>
                                    )}
                                </div>

                                {/* Version List */}
                                <div className="space-y-2">
                                    {nodeArtifacts.map((art) => (
                                        <div 
                                            key={art.id} 
                                            className={cn(
                                                "p-3 rounded-xl border transition-all flex items-center justify-between group",
                                                art.is_active ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-card border-border opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold",
                                                    art.is_active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}>
                                                    v{art.version}
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-bold text-foreground">
                                                        {new Date(art.created_at).toLocaleTimeString()} 기록됨
                                                    </div>
                                                    <div className="text-[9px] font-mono text-muted-foreground truncate w-32">
                                                        {art.checksum?.substring(0, 12)}...
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {!art.is_active && (
                                                    <Button 
                                                        size="sm" 
                                                        className="h-7 px-3 bg-card border border-border text-muted-foreground hover:bg-muted rounded-lg text-[10px] font-black gap-1.5 shadow-none"
                                                        onClick={() => onRollback(art.id)}
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        이 시점으로 복구
                                                    </Button>
                                                )}
                                                {art.is_active && (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};
