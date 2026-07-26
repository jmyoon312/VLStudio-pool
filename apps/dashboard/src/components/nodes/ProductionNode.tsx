import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import useNodeStore from '../../hooks/useNodeStore';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Settings2, CheckCircle2, AlertTriangle, Workflow } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const ProductionNode = ({ id, data, selected }: NodeProps) => {
    const isEdit = useNodeStore((state) => state.mode === 'edit');
    const { getNodes, getEdges } = useReactFlow();
    const [isRunning, setIsRunning] = useState(false);

    // --- Context Propagation Logic ---
    const handleRun = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRunning(true);

        // 1. Find Upstream 'AIAgentNode'
        const edges = getEdges();
        const incomingEdge = edges.find(edge => edge.target === id);

        if (!incomingEdge) {
            alert("입력 연결이 없습니다. (No Input Connection)");
            setIsRunning(false);
            return;
        }

        const upstreamNode = getNodes().find(n => n.id === incomingEdge.source);

        // 2. Simulate Context Gathering
        console.log("Gathering Context from:", upstreamNode?.data.label);

        // Mock API Call to n8n
        setTimeout(() => {
            setIsRunning(false);
            console.log("Sent payload to n8n:", {
                source: upstreamNode?.data,
                webhookUrl: data.webhookUrl
            });
            // Here you would normally update node status or show a toast
        }, 1500);
    };

    return (
        <div className={`relative w-[280px] transition-all duration-300 ${selected ? 'ring-2 ring-orange-500 rounded-xl' : ''}`}>

            {/* Input Handle (From AI) */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="target"
                            position={Position.Left}
                            className="w-4 h-4 bg-orange-500 border-2 border-white dark:border-slate-200"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Input: Script from AI</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Card className="overflow-hidden border-0 shadow-lg bg-white text-slate-800 border border-slate-200 group">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-orange-600 to-red-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Workflow className="w-5 h-5 text-white/90" />
                        <span className="font-bold text-sm tracking-wide">Production (제작)</span>
                    </div>
                    <Badge variant="outline" className="border-white/20 text-white/80 bg-black/20 text-[10px]">
                        n8n
                    </Badge>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Status</span>
                        <span className={`font-mono ${isRunning ? 'text-orange-400 animate-pulse' : 'text-green-400'}`}>
                            {isRunning ? 'EXECUTING...' : 'IDLE'}
                        </span>
                    </div>

                    <div className="text-xs bg-black/30 p-2 rounded border border-white/5 font-mono truncate">
                        {data.webhookUrl || 'https://n8n.webhook/path...'}
                    </div>

                    {/* Action Bar (Hover Only) */}
                    <div className="pt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white border-0"
                            onClick={handleRun}
                            disabled={isRunning}
                        >
                            {isRunning ? <Settings2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                            Test Run
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Output Handle (To Worker) */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="source"
                            position={Position.Right}
                            className="w-4 h-4 bg-orange-500 border-2 border-white dark:border-slate-200"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Output: Video File (to Worker)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

        </div>
    );
};

export default memo(ProductionNode);
