import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Mic2, Gauge } from 'lucide-react';

const TTSNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={`relative min-w-[240px] transition-all duration-300 ${selected ? 'ring-2 ring-violet-500 rounded-xl' : ''}`}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-4 h-4 bg-violet-500 border-2 border-white"
                isConnectable={true}
            />

            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                {/* Header */}
                <div className="h-2 bg-gradient-to-r from-violet-400 to-purple-600" />

                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                            <Music className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                            <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="text-[10px] h-5 px-1 uppercase border-violet-200 text-violet-600">
                                    {data.engine || "GOOGLE"}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
                            <div className="flex items-center gap-1 text-slate-500">
                                <Mic2 className="w-3 h-3" />
                                <span>Voice</span>
                            </div>
                            <span className="font-medium truncate max-w-[100px]" title={data.voice_id}>
                                {data.voice_id || "Default"}
                            </span>
                        </div>

                        {(data.speed !== undefined || data.pitch !== undefined) && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                <Gauge className="w-3 h-3" />
                                <span>Speed: {data.speed || 0}%</span>
                                <span className="text-slate-700">|</span>
                                <span>Pitch: {data.pitch || 0}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 bg-violet-500 border-2 border-white"
                isConnectable={true}
            />
        </div>
    );
};

export default memo(TTSNode);
