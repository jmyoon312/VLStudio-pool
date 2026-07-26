import React, { memo } from 'react';
import { Handle, Position, NodeProps, useNodeStore } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Search, Rss } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const SourceNode = ({ data, selected }: NodeProps) => {
    // const isEdit = useNodeStore((state) => state.mode === 'edit');
    // For Source Node, visuals don't change much between modes yet

    return (
        <div className={`relative w-[240px] transition-all duration-300 ${selected ? 'ring-2 ring-purple-500 rounded-xl' : ''}`}>

            <Card className="overflow-hidden border-0 shadow-lg bg-white text-slate-800 group">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-purple-100 to-indigo-100 border-b border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-purple-600" />
                        <span className="font-bold text-sm tracking-wide text-purple-900">Source (수집)</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/50 text-purple-700 text-[10px]">
                        Ref
                    </Badge>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Search className="w-3 h-3" />
                        <span className="truncate">{data.keywords || '키워드 없음 (No Keywords)'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Rss className="w-3 h-3" />
                        <span className="truncate font-medium text-slate-700">{data.channel_id || '채널 미지정'}</span>
                    </div>
                </div>
            </Card>

            {/* Output Handle */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="source"
                            position={Position.Right}
                            className="w-4 h-4 bg-purple-500 border-2 border-white"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Output: Video Metadata (to AI Agent)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

        </div>
    );
};

export default memo(SourceNode);
