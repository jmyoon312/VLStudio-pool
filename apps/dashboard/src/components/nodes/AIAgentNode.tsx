import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Bot, Zap, Sparkles, Layers } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const AIAgentNode = ({ data, selected }: NodeProps) => {
    const isInternal = data.useInternalEngine;
    const isAutoRun = data.isAutoRun;
    const assetCount = data.assets?.length || 0;

    return (
        <div className={`relative w-[300px] transition-all duration-300 ${selected ? 'ring-2 ring-indigo-500 rounded-xl shadow-xl' : ''}`}>
            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-indigo-500 border-2 border-white" />

            <Card className="overflow-hidden border-0 shadow-lg bg-white group">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-sm text-indigo-900">AI Agent (Batch)</span>
                    </div>
                    {isAutoRun && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-yellow-100 text-yellow-700 border-yellow-200 flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-yellow-500 text-yellow-500" /> Auto
                        </Badge>
                    )}
                </div>

                {/* Body */}
                <div className="p-3 space-y-3">
                    {/* Stats Row */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Layers className="w-3 h-3" />
                        <span>Input Assets: </span>
                        <Badge variant="outline" className="h-5 px-1.5">{assetCount > 0 ? `${assetCount} items` : 'Waiting...'}</Badge>
                    </div>

                    {/* Instruction Preview */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100 line-clamp-2 font-mono leading-relaxed">
                        {data.systemPrompt || 'No instruction set. Configure in Inspector.'}
                    </div>

                    {/* Output Status */}
                    {data.outputScript && (
                        <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                            <Sparkles className="w-3 h-3" />
                            <span>Last Generated: {data.outputScript.substring(0, 20)}...</span>
                        </div>
                    )}
                </div>
            </Card>

            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-indigo-500 border-2 border-white" />
        </div>
    );
};
export default memo(AIAgentNode);
