import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trash2, Edit, AlertCircle } from 'lucide-react';

interface SyncReport {
    message: string;
    details: string[];
    counts: {
        added: number;
        updated: number;
        removed: number;
    };
}

interface SyncReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    report: SyncReport | null;
}

const SyncReportDialog: React.FC<SyncReportDialogProps> = ({ isOpen, onClose, report }) => {
    if (!report) return null;

    // Helper to categorize messages
    const categorize = (text: string) => {
        if (text.includes("추가됨")) return "added";
        if (text.includes("제거됨")) return "removed";
        if (text.includes("업데이트됨")) return "updated";
        return "info";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCwIcon /> 동기화 리포트
                    </DialogTitle>
                    <DialogDescription>
                        유튜브 채널 정보와 로컬 데이터베이스의 동기화 결과입니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
                            <div className="text-xl font-bold text-green-600">{report.counts.added}</div>
                            <div className="text-xs text-green-700 font-medium">신규 추가</div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
                            <div className="text-xl font-bold text-blue-600">{report.counts.updated}</div>
                            <div className="text-xs text-blue-700 font-medium">업데이트</div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg text-center border border-red-100">
                            <div className="text-xl font-bold text-red-600">{report.counts.removed}</div>
                            <div className="text-xs text-red-700 font-medium">제거됨</div>
                        </div>
                    </div>

                    {/* Details List */}
                    <div className="bg-slate-50 rounded-md p-4 max-h-[200px] overflow-y-auto text-sm space-y-2 border">
                        {report.details.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">변경 사항이 없습니다.</p>
                        ) : (
                            report.details.map((line, idx) => {
                                const type = categorize(line);
                                return (
                                    <div key={idx} className="flex items-start gap-2">
                                        {type === 'added' && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
                                        {type === 'removed' && <Trash2 className="w-4 h-4 text-red-500 mt-0.5" />}
                                        {type === 'updated' && <Edit className="w-4 h-4 text-blue-500 mt-0.5" />}

                                        <span className={`flex-1 ${type === 'removed' ? 'text-slate-600 line-through' : 'text-slate-700'}`}>
                                            {line}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose} className="w-full sm:w-auto">확인</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const RefreshCwIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
);

export default SyncReportDialog;
