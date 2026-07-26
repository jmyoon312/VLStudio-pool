import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, Music, Mic, Sliders } from 'lucide-react';
import { cn } from "@/lib/utils";

const AudioMixNode = ({ data, selected }: NodeProps) => {
    // Config: bgm_vol, voice_vol, ducking (bool)
    const bgmVol = data.bgm_vol !== undefined ? data.bgm_vol : 30; // 0-100
    const ducking = data.ducking !== undefined ? data.ducking : true;

    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-pink-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-pink-400 to-rose-500" />
                <div className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                                {data.label || "오디오 믹싱 (Audio)"}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-pink-50 text-pink-700">
                                    BGM {bgmVol}%
                                </Badge>
                                {ducking && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-pink-200">
                                        Auto-Duck
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Visualizer Mock */}
                    <div className="flex items-center gap-1 h-3 mt-2">
                        <div className="bg-slate-200 h-full w-1 rounded-full" />
                        <div className="bg-pink-400 h-full w-1 rounded-full animate-pulse" />
                        <div className="bg-pink-500 h-full w-1 rounded-full animate-bounce" />
                        <div className="bg-pink-300 h-full w-1 rounded-full" />
                        <div className="bg-slate-200 h-full w-1 rounded-full" />
                    </div>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-400" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-pink-500" />
        </div>
    );
};

export default memo(AudioMixNode);
