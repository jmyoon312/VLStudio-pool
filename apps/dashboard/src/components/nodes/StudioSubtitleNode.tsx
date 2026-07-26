import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Type, Palette, Move, Clapperboard } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const StudioSubtitleNode = ({ data, selected }: NodeProps) => {
    // Generate a preview style based on node data
    const previewStyle = {
        fontFamily: data.font || 'sans-serif',
        color: data.color || '#fbbf24', // Default amber-400
        textShadow: '2px 2px 0px rgba(0,0,0,0.8)',
        fontSize: '14px',
        fontWeight: 'bold',
        padding: '4px 8px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '4px',
        textAlign: 'center' as const
    };

    return (
        <Card className={`w-[300px] shadow-lg border-2 transition-colors ${selected ? 'border-primary' : 'border-slate-200'} overflow-hidden`}>
            {/* Header with gradient */}
            <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />

            <CardHeader className="p-3 pb-2 bg-slate-50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                        <Clapperboard className="w-4 h-4 text-purple-600" />
                        스튜디오 자막 (Studio)
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">Stylist</Badge>
                </div>
            </CardHeader>

            <CardContent className="p-3 space-y-4">
                {/* Preview Area */}
                <div
                    className="relative h-24 bg-white rounded-md flex items-center justify-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=100&auto=format&fit=crop')] bg-cover bg-center"
                >
                    <div className="absolute inset-0 bg-black/40" /> {/* Dimmer */}
                    <div className="relative z-10 max-w-[90%]">
                        <p style={previewStyle}>
                            영화의 감동을 더하다<br />
                            <span className="text-[10px] opacity-80">(자막 미리보기)</span>
                        </p>
                    </div>
                </div>

                {/* Configuration Specs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-100 p-2 rounded flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-slate-500">
                            <Type className="w-3 h-3" />
                            <span>폰트</span>
                        </div>
                        <span className="font-semibold text-slate-800 truncate">{data.font || "CookieRun Regular"}</span>
                    </div>
                    <div className="bg-slate-100 p-2 rounded flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-slate-500">
                            <Palette className="w-3 h-3" />
                            <span>색상</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: data.color || '#fbbf24' }} />
                            <span className="font-semibold text-slate-800">{data.color || "#fbbf24"}</span>
                        </div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded flex flex-col gap-1 col-span-2">
                        <div className="flex items-center gap-1 text-slate-500">
                            <Move className="w-3 h-3" />
                            <span>애니메이션 효과</span>
                        </div>
                        <span className="font-semibold text-slate-800">
                            {data.animation || "Pop-up (Basic)"}
                        </span>
                    </div>
                </div>

                <div className="relative h-4 pt-2">
                    <Handle type="target" position={Position.Left} id="input" className="w-2.5 h-2.5 bg-slate-400 border-2 border-white top-2" />
                    <span className="absolute left-3 top-0.5 text-[10px] text-slate-600">Audio/Script</span>

                    <Handle type="source" position={Position.Right} id="output" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white top-2" />
                    <span className="absolute right-3 top-0.5 text-[10px] text-slate-600">Subtitle Asset</span>
                </div>
            </CardContent>
        </Card>
    );
};

export default memo(StudioSubtitleNode);
