import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Type } from 'lucide-react';

const SubtitleNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={`relative min-w-[200px] transition-all duration-300 ${selected ? 'ring-2 ring-amber-500 rounded-xl' : ''}`}>
            {/* Input */}
            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-amber-500 border-2 border-white" />

            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-amber-300 to-orange-500" />
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                            <Type className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                            <Badge variant="outline" className="mt-1 text-[10px] border-amber-200 text-amber-700">
                                {data.output_format || "SRT"}
                            </Badge>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Output */}
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-amber-500 border-2 border-white" />
        </div>
    );
};

export default memo(SubtitleNode);
