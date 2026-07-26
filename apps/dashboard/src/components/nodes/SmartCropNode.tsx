import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanFace, UserCheck, Focus, Layers } from 'lucide-react';
import { cn } from "@/lib/utils";

const SmartCropNode = ({ data, selected }: NodeProps) => {
    // Mode: center (default), face_track, active_speaker
    const mode = data.mode || 'center';

    let ModeIcon = Focus;
    let modeLabel = "중앙 크롭 (Center)";

    if (mode === 'face_track') {
        ModeIcon = ScanFace;
        modeLabel = "얼굴 추적 (Face Track)";
    } else if (mode === 'active_speaker') {
        ModeIcon = UserCheck;
        modeLabel = "화자 감지 (Active Speaker)";
    }

    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-emerald-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <div className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <ModeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                                {data.label || "스마트 크롭 (CV)"}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 mt-1">
                                {modeLabel}
                            </Badge>
                        </div>
                    </div>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-400" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
        </div>
    );
};

export default memo(SmartCropNode);
