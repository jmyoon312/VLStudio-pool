import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Type, Sparkles } from 'lucide-react';
import { cn } from "@/lib/utils";

const TextAnimNode = ({ data, selected }: NodeProps) => {
    const textPreview = data.text ? (data.text.length > 15 ? data.text.substring(0, 15) + '...' : data.text) : "텍스트 입력...";
    const effect = data.effect || 'typewriter';

    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-violet-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-violet-400 to-fuchsia-500" />
                <div className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                                {data.label || "텍스트 애니메이션"}
                            </h3>
                            <p className="text-[10px] text-slate-500 truncate mt-1 italic">
                                "{textPreview}"
                            </p>
                        </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] w-full justify-center bg-violet-50 text-violet-700">
                        Effect: {effect.toUpperCase()}
                    </Badge>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-400" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-violet-500" />
        </div>
    );
};

export default memo(TextAnimNode);
