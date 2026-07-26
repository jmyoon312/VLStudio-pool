import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

const SmartCutNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-pink-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-pink-500 to-rose-500" />
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center">
                            <Scissors className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">
                                {data.label || "스마트 컷"}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] border-pink-200 text-pink-700 flex gap-1">
                                    {data.count || 3} Clips
                                </Badge>
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {data.target_duration ? `${data.target_duration}s` : "Auto"}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Input/Process details */}
                    <div className="mt-3 p-2 bg-pink-50 text-[10px] text-pink-800 rounded border border-pink-100 font-medium">
                        AI Viral Moment Detection
                    </div>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-slate-400 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-pink-500 border-2 border-white" />
        </div>
    );
};

export default memo(SmartCutNode);
