import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StatsGraph from '@/components/StatsGraph'; // reusing existing
import api from '@/lib/api';
import { RefreshCw } from 'lucide-react';

interface StatsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    videoId: number | null;
    videoTitle?: string;
    uploadDate?: string; // [NEW]
}

const StatsDialog: React.FC<StatsDialogProps> = ({ open, onOpenChange, videoId, videoTitle, uploadDate }) => {
    const { data: history, isLoading } = useQuery({
        queryKey: ['videoHistory', videoId],
        queryFn: async () => {
            if (!videoId) return [];
            const res = await api.get(`/videos/${videoId}/history`);
            return res.data;
        },
        enabled: !!videoId && open
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        📈 바이럴 변화 추이
                        <span className="text-xs font-normal text-slate-500 truncate max-w-[300px]">
                            {videoTitle}
                        </span>
                    </DialogTitle>
                    <DialogDescription>
                        시간에 따른 조회수 변화 및 급상승 구간을 분석합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="h-[350px] w-full mt-4 bg-slate-50 rounded-lg border p-4">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center text-slate-600">
                            <RefreshCw className="w-8 h-8 animate-spin" />
                        </div>
                    ) : (
                        <StatsGraph data={history || []} height={320} uploadDate={uploadDate} />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default StatsDialog;
