import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import useNodeStore from '../../hooks/useNodeStore';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlaySquare, AlertCircle, UploadCloud, CheckCircle, Clock, Share2 } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const ChannelNode = ({ data, selected }: NodeProps) => {
    const mode = useNodeStore((state) => state.mode);
    const isEdit = mode === 'edit';

    // Status Logic
    const isUploading = data.upload_status === 'UPLOADING' || data.upload_status === 'PROCESSING';
    const isFailed = data.upload_status === 'FAILED';
    const hasStrikes = (data.strike_count || 0) > 0;

    // Dynamic Styles for Card
    const cardBorder = isFailed ? 'border-red-500' : isUploading ? 'border-blue-400' : 'border-slate-200';
    const pulseClass = !isEdit && isUploading ? 'shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse' : '';
    const shakeClass = !isEdit && hasStrikes ? 'animate-shake' : '';

    return (
        <div className={`relative w-[280px] transition-all duration-300 ${isEdit ? 'scale-100' : 'scale-105'} ${selected ? 'ring-2 ring-red-500 rounded-xl' : ''}`}>

            {/* Input Handle (From Worker) */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Handle
                            type="target"
                            position={Position.Left}
                            className="w-4 h-4 bg-red-600 border-2 border-white dark:border-slate-200"
                        />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Input: Ready Video (from Worker)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Card className={`overflow-hidden border shadow-lg ${cardBorder} ${pulseClass} ${shakeClass} bg-white text-slate-900 dark:bg-slate-900 dark:text-white`}>
                <div className="p-3 flex items-start gap-4">
                    <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg shadow-red-500/30">
                        <PlaySquare className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-base truncate">{data.channel_title || 'Unassigned Channel'}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isUploading ? "default" : "outline"} className={`text-[10px] px-1.5 h-5 ${isUploading ? 'bg-blue-500' : 'text-slate-500'}`}>
                                {data.upload_status || 'IDLE'}
                            </Badge>
                            {data.default_privacy && (
                                <span className="text-[10px] text-slate-600 capitalize">{data.default_privacy}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Op Mode: Dashboard Stats */}
                {!isEdit && (
                    <div className="bg-slate-50 dark:bg-black/20 p-3 border-t dark:border-white/5 space-y-2">
                        {/* Alerts */}
                        {data.alerts && data.alerts.length > 0 && (
                            <div className="flex flex-col gap-1">
                                {data.alerts.map((alert: string, i: number) => (
                                    <Badge key={i} variant="destructive" className="py-0 px-1.5 text-[10px] flex items-center gap-1 justify-center w-full">
                                        <AlertCircle className="w-3 h-3" /> {alert}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Strikes */}
                        {hasStrikes && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold px-1 justify-center bg-amber-50 rounded py-1">
                                <AlertCircle className="w-3 h-3" /> 경고: {data.strike_count}/3
                            </div>
                        )}

                        {/* Progress Indicator */}
                        {isUploading && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-blue-600 font-medium">
                                    <span className="flex items-center gap-1"><UploadCloud className="w-3 h-3" /> Uploading...</span>
                                    <span>76%</span>
                                </div>
                                <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 animate-progress-indeterminate" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Secondary Handle (To Webhook) - Bottom Right or Right bottom biased */}
            <div className="absolute -right-3 bottom-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative">
                                {/* Visual Handle Decorator */}
                                <div className="absolute right-0 top-0 w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-75" />
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id="success-handle"
                                    className="w-4 h-4 bg-indigo-600 border-2 border-white dark:border-slate-200 !right-0 !relative"
                                    style={{ right: 0 }}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <div className="flex items-center gap-2">
                                <Share2 className="w-3 h-3 text-indigo-400" />
                                <span>On Upload Success (확산)</span>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

        </div>
    );
};

export default memo(ChannelNode);
