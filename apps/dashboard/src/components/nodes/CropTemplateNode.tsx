import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, Crop, Layers } from 'lucide-react';
import { cn } from "@/lib/utils";

const CropTemplateNode = ({ data, selected }: NodeProps) => {
    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-orange-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                            <LayoutTemplate className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">
                                {data.label || "템플릿 크롭"}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700 flex gap-1">
                                    <Crop className="w-3 h-3" /> {data.template || "Standard"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    {/* Visualizer for Template */}
                    <div className="mt-3 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden relative">
                        {data.template === 'split_screen' ? (
                            <div className="w-8 h-full flex flex-col gap-0.5">
                                <div className="flex-1 bg-orange-200 rounded-sm"></div>
                                <div className="flex-1 bg-black rounded-sm"></div>
                            </div>
                        ) : data.template === 'blur_bg' ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <div className="absolute inset-0 bg-orange-200 blur-sm opacity-50"></div>
                                <div className="w-6 h-full bg-orange-300 relative z-10 border-x border-white/50"></div>
                            </div>
                        ) : (
                            <div className="w-8 h-full bg-orange-200 border-x border-white/50"></div>
                        )}
                    </div>
                </div>
            </Card>

            <Handle type="target" position={Position.Left} className="w-4 h-4 bg-slate-400 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-orange-500 border-2 border-white" />
        </div>
    );
};

export default memo(CropTemplateNode);
