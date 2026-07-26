import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Wand2, Film } from 'lucide-react';

const VideoTransformNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={`relative w-[240px] transition-all duration-300 ${selected ? 'ring-2 ring-fuchsia-500 rounded-xl' : ''}`}>
            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-fuchsia-500 border-2 border-white" />

            <Card className="overflow-hidden border-0 shadow-lg bg-white group">
                <div className="p-3 bg-gradient-to-r from-fuchsia-100 to-pink-100 border-b border-fuchsia-200 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-fuchsia-700" />
                    <span className="font-bold text-sm text-fuchsia-900">영상 변환 (Transform)</span>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                        <Film className="w-3 h-3 text-slate-600" />
                        <span className="font-medium text-slate-700">{data.preset || '스타일 미지정'}</span>
                    </div>
                </div>
            </Card>

            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-fuchsia-500 border-2 border-white" />
        </div>
    );
};
export default memo(VideoTransformNode);
