import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MessageSquare } from 'lucide-react';
import { cn } from "@/lib/utils";

const ScriptRemixNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-indigo-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">
                                {data.label || "스크립트 리믹스"}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 flex gap-1">
                                    <MessageSquare className="w-3 h-3" /> {data.remix_style || "Standard"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-slate-400 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-indigo-500 border-2 border-white" />
        </div>
    );
};

export default memo(ScriptRemixNode);
