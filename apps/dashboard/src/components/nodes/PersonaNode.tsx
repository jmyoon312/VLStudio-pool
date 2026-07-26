import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { UserCircle2, Sparkles } from 'lucide-react';

const PersonaNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={`relative w-[200px] transition-all duration-300 ${selected ? 'ring-2 ring-violet-500 rounded-xl' : ''}`}>
            <Card className="overflow-hidden border-0 shadow-lg bg-white group">
                <div className="p-3 bg-gradient-to-r from-violet-100 to-purple-100 border-b border-violet-200 flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4 text-violet-700" />
                    <span className="font-bold text-sm text-violet-900">AI 작가 (Persona)</span>
                </div>
                <div className="p-3">
                    <div className="text-xs text-slate-500 italic">
                        "{data.description || '스타일 정의...'}"
                    </div>
                </div>
            </Card>
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-violet-500 border-2 border-white" />
        </div>
    );
};
export default memo(PersonaNode);
