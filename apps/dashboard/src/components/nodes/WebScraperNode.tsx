import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Link2, Newspaper } from 'lucide-react';
import { cn } from "@/lib/utils";

const WebScraperNode = ({ data, selected }: NodeProps) => {
    // Data: url, preset (reddit, news, auto)
    const url = data.url ? (data.url.length > 25 ? data.url.substring(0, 25) + '...' : data.url) : "URL 입력 필요";
    const preset = data.preset || 'auto';

    let Icon = Globe;
    if (preset === 'reddit') Icon = Newspaper;

    return (
        <div className={cn(
            "relative min-w-[200px] transition-all duration-300",
            selected ? 'ring-2 ring-cyan-500 rounded-xl' : ''
        )}>
            <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                <div className="h-2 bg-gradient-to-r from-cyan-400 to-blue-500" />
                <div className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center">
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                                {data.label || "웹 스크래퍼 (Scraper)"}
                            </h3>
                            <div className="flex items-center gap-1 mt-1">
                                <Link2 className="w-3 h-3 text-slate-600" />
                                <span className="text-[10px] text-slate-500 truncate">{url}</span>
                            </div>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] w-full justify-center border-cyan-100 text-cyan-600">
                        Mode: {preset.toUpperCase()}
                    </Badge>
                </div>
            </Card>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500" />
        </div>
    );
};

export default memo(WebScraperNode);
