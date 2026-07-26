// Upload to Queue Node - 워크플로우에서 Work Queue로 영상 전송

import React from 'react';
import { Handle, Position } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, Clock } from 'lucide-react';

interface UploadToQueueNodeProps {
    id: string;
    data: {
        label?: string;
        title_template?: string;
        upload_method?: 'API' | 'BROWSER';
        platforms?: {
            youtube?: { enabled: boolean };
            tiktok?: { enabled: boolean };
            instagram?: { enabled: boolean };
        };
        auto_approve?: boolean;
        channel_id?: string;
    };
    selected?: boolean;
}

export const UploadToQueueNode = ({ data, selected }: UploadToQueueNodeProps) => {
    // 활성화된 플랫폼 카운트
    const enabledPlatforms = Object.entries(data.platforms || {})
        .filter(([_, config]) => config?.enabled)
        .length;

    // 플랫폼 아이콘
    const platformIcons = [];
    if (data.platforms?.youtube?.enabled) platformIcons.push('YT');
    if (data.platforms?.tiktok?.enabled) platformIcons.push('TT');
    if (data.platforms?.instagram?.enabled) platformIcons.push('IG');

    return (
        <div className={`relative w-[280px] transition-all duration-300 ${selected ? 'ring-2 ring-purple-500 rounded-xl shadow-xl' : ''}`}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-4 h-4 bg-purple-500 border-2 border-white"
            />

            <Card className="overflow-hidden border-0 shadow-lg bg-white">
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-purple-600" />
                        <span className="font-bold text-sm text-purple-900">{data.label || 'Upload to Queue'}</span>
                    </div>
                    {data.auto_approve && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Auto
                        </Badge>
                    )}
                </div>

                {/* Body */}
                <div className="p-3 space-y-3">
                    {/* 제목 템플릿 */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100 line-clamp-2 font-mono leading-relaxed">
                        {data.title_template || '{title}'}
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-2 text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500">
                            <span>Method</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-200 text-blue-600">
                            {data.upload_method || 'API'}
                        </Badge>
                    </div>

                    {/* Platforms Row */}
                    <div className="flex items-center gap-2 text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500">
                            <span>Platforms</span>
                        </div>
                        <div className="flex gap-1">
                            {platformIcons.length > 0 ? (
                                platformIcons.map((icon, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px] h-5 px-1.5">
                                        {icon}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-[10px] text-slate-600">None</span>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3 text-purple-500" />
                        <span>Ready to queue</span>
                    </div>
                </div>
            </Card>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 bg-purple-500 border-2 border-white"
            />
        </div>
    );
};

export default UploadToQueueNode;
