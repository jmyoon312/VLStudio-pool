import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

const SyncVideoNode = ({ data, selected }: NodeProps) => {
    // Mock data for UI demo
    const status = data.status || 'idle'; // idle, syncing, completed
    const sourceDur = data.sourceDuration || 120; // 2m 0s (mock)
    const targetDur = data.targetDuration || 115; // 1m 55s (mock) - TTS Duration
    const isCompleted = status === 'completed';

    return (
        <Card className={`w-[250px] border-2 shadow-sm ${selected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200'}`}>
            <Handle type="target" position={Position.Left} id="video" style={{ top: '30%', background: '#64748b' }} />
            <Handle type="target" position={Position.Left} id="audio" style={{ top: '70%', background: '#f59e0b' }} />

            <CardHeader className="bg-slate-50 pb-2 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center text-slate-700">
                        <Timer className="w-4 h-4 mr-2 text-orange-500" />
                        {data.label || 'Video Sync'}
                    </CardTitle>
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
            </CardHeader>

            <CardContent className="pt-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-500">Video</div>
                    <ArrowRightLeft className="w-3 h-3 text-slate-700" />
                    <div className="text-orange-600 font-bold">Audio (Master)</div>
                </div>

                <div className="bg-slate-100 rounded p-2 text-xs flex justify-between items-center">
                    <div className="flex flex-col items-center">
                        <span className="text-slate-600 text-[10px]">SRC</span>
                        <span className="font-mono">{sourceDur}s</span>
                    </div>
                    <div className="h-px bg-gray-300 w-8"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-slate-600 text-[10px]">TGT</span>
                        <span className="font-mono">{targetDur}s</span>
                    </div>
                </div>

                <Badge variant={isCompleted ? "default" : "outline"} className={`w-full justify-center ${isCompleted ? 'bg-green-600' : ''}`}>
                    {status === 'processing' ? 'Syncing...' : isCompleted ? 'Synced' : 'Ready'}
                </Badge>
            </CardContent>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
        </Card>
    );
};

export default memo(SyncVideoNode);
