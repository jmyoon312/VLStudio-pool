import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import useNodeStore from '../../hooks/useNodeStore';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Power, Shield, Activity, Clock } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Simple Liquid Gauge Visual (CSS based)
const LiquidGauge = ({ percent }: { percent: number }) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const color = clamped > 90 ? 'bg-red-500' : clamped > 70 ? 'bg-amber-500' : 'bg-blue-500';

    return (
        <div className="relative w-10 h-10 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
            <div
                className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${color} opacity-80`}
                style={{ height: `${clamped}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-10 text-slate-700 mix-blend-multiply">
                {clamped}%
            </div>
        </div>
    )
}

const WorkerNode = ({ data, selected }: NodeProps) => {
    // const mode = useNodeStore((state) => state.mode);

    // Calc Usage
    const limit = data.quota_limit || 1;
    const used = data.quota_used || 0;
    const percent = Math.round((used / limit) * 100);

    return (
        <div className={`relative w-[280px] transition-all duration-300 ${selected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}>

            {/* Input Handle (From Production) */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="target"
                            position={Position.Left}
                            className="w-4 h-4 bg-blue-500 border-2 border-white dark:border-slate-200"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Input: Task Queue</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Card className="overflow-hidden border-0 shadow-lg bg-white group">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <Power className="w-5 h-5" />
                        <div>
                            <span className="font-bold text-sm tracking-wide block">Worker Agent</span>
                            <span className="text-[10px] opacity-80 font-mono tracking-tight">{data.email || 'user@example.com'}</span>
                        </div>
                    </div>
                    <LiquidGauge percent={percent} />
                </div>

                {/* Body */}
                <div className="p-3 space-y-3 bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded border flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] text-slate-600 uppercase">Daily Limit</span>
                            <Badge variant="outline" className="font-mono text-xs border-blue-200 text-blue-700">
                                {used} / {limit}
                            </Badge>
                        </div>
                        <div className="bg-white p-2 rounded border flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] text-slate-600 uppercase">Cooldown</span>
                            <Badge variant="outline" className="font-mono text-xs border-amber-200 text-amber-700 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> 15m
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
                        <Activity className="w-3 h-3 text-green-500" />
                        <span>Ready to distribute</span>
                    </div>
                </div>
            </Card>

            {/* Output Handle (To Channel) */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="source"
                            position={Position.Right}
                            className="w-4 h-4 bg-blue-500 border-2 border-white dark:border-slate-200"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Output: Distribution Stream</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

        </div>
    );
};

export default memo(WorkerNode);
