import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Trash, PlaySquare, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import api from '../lib/api';
import { useToast } from "@/components/ui/use-toast";

interface BrandChannel {
    id: number;
    title: string;
    channel_id: string;
    thumbnail_url: string;
    is_active: boolean; // Assuming backend sends this now
}

interface Worker {
    id: number;
    email: string;
    name: string;
    picture: string;
    is_active: boolean;
}

interface WorkerCardProps {
    worker: Worker;
    channels: BrandChannel[];
    onDelete: (id: number) => void;
    onSync: () => void; // Callback to refresh parent data
}

import SyncReportDialog from './dialogs/SyncReportDialog';

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, channels, onDelete, onSync }) => {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [report, setReport] = useState<any>(null); // Store last report
    const [isReportOpen, setIsReportOpen] = useState(false);

    // Mock Quota (Later implement real quota from backend)
    const quotaUsed = 1500;
    const quotaLimit = 10000;
    const quotaPercent = (quotaUsed / quotaLimit) * 100;

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await api.post(`/brand-channels/sync/${worker.id}`);
            const data = res.data;

            setReport(data);

            // Only open dialog if there are changes OR if it's explicitly requested 
            // Better UX: Always open on manual sync so user knows it worked.
            setIsReportOpen(true);

            if (data.details.length === 0) {
                toast({ title: "최신 상태", description: "변경된 채널 정보가 없습니다." });
            }

            onSync(); // Refresh parent data
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || "채널 정보 동기화 실패";
            toast({ variant: "destructive", title: "동기화 실패", description: msg });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <>
            <SyncReportDialog isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} report={report} />

            <Card className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                {/* Header: Worker Info */}
                <div className="p-4 bg-slate-50 border-b flex justify-between items-start">
                    <div className="flex gap-3">
                        <img src={worker.picture} alt={worker.name} className="w-10 h-10 rounded-full border border-slate-300" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 text-sm">{worker.name}</h3>
                                {worker.is_active ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] hover:bg-green-100">
                                        정상 (Active)
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="text-[10px]">오류</Badge>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">{worker.email}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Daily Quota</p>
                                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${quotaPercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                style={{ width: `${quotaPercent}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">{quotaUsed.toLocaleString()} / {quotaLimit.toLocaleString()}</p>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>API Quota Usage</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Body: Channels Grid */}
                <CardContent className="p-4 bg-white">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <PlaySquare className="w-3 h-3" /> 연결된 채널 ({channels.length})
                        </h4>
                    </div>

                    {channels.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {channels.map(ch => (
                                <div key={ch.id} className={`flex items-center justify-between p-2 rounded border ${ch.is_active ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-red-50 opacity-60'}`}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <img src={ch.thumbnail_url} className="w-6 h-6 rounded-full" />
                                        <p className="text-xs font-medium truncate max-w-[120px]" title={ch.title}>{ch.title}</p>
                                    </div>
                                    <div>
                                        {ch.is_active ?
                                            <CheckCircle className="w-3 h-3 text-green-500" /> :
                                            <AlertTriangle className="w-3 h-3 text-red-400" />
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 bg-slate-50 border border-dashed rounded-md">
                            <p className="text-xs text-slate-600">연결된 채널이 없습니다.</p>
                            <Button variant="link" size="sm" onClick={handleSync} className="text-xs h-auto p-0 text-blue-500">
                                동기화하여 가져오기
                            </Button>
                        </div>
                    )}
                </CardContent>

                {/* Footer: Actions */}
                <div className="p-3 bg-slate-50 border-t flex justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-600 text-xs h-8 px-2"
                        onClick={() => onDelete(worker.id)}
                    >
                        <Trash className="w-3 h-3 mr-1" /> 삭제
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-8"
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? '동기화 중...' : '채널 동기화'}
                    </Button>
                </div>
            </Card>
        </>
    );
};

export default WorkerCard;
