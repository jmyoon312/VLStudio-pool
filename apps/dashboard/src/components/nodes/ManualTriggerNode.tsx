import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Link, Play } from 'lucide-react';

const ManualTriggerNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={`relative w-[240px] transition-all duration-300 ${selected ? 'ring-2 ring-cyan-500 rounded-xl' : ''}`}>
            <Card className="overflow-hidden border-0 shadow-lg bg-white group">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-cyan-100 to-blue-100 border-b border-cyan-200 flex items-center gap-2">
                    <Link className="w-4 h-4 text-cyan-700" />
                    <span className="font-bold text-sm text-cyan-900">수동 입력 (Manual)</span>
                </div>
                {/* Body */}
                <div className="p-3">
                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                        {data.url || 'URL을 입력하세요...'}
                    </div>
                </div>
            </Card>
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-cyan-500 border-2 border-white" />
        </div>
    );
};
export default memo(ManualTriggerNode);
