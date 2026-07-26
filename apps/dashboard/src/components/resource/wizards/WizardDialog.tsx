import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WizardSession } from '@/hooks/useWizardProgress';

interface WizardDialogProps {
    session: WizardSession | undefined;
    isOpen: boolean;
    onClose: () => void;
    onCompleteDay: () => void;
    canComplete: boolean;
    children: React.ReactNode;
}

const WizardDialog: React.FC<WizardDialogProps> = ({
    session,
    isOpen,
    onClose,
    onCompleteDay,
    canComplete,
    children
}) => {
    if (!session) return null;

    // Calculate progress based on days (simple version)
    // Could be refined to include task completion % if needed, but per-day is safer for "Stages"
    const progress = ((session.currentDay - 1) / session.totalDays) * 100;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 gap-0">
                {/* Header Section */}
                <div className="p-6 pb-4 border-b">
                    <DialogHeader className="mb-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-xl flex items-center gap-2">
                                    {session.type === 'worker' ? '🦸 워커 계정 생성' : '📺 브랜드 채널 육성'}
                                    <Badge variant="outline" className="font-normal text-slate-500">
                                        {session.name}
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    안전한 계정 생성을 위한 단계별 가이드입니다.
                                </DialogDescription>
                            </div>
                            <Badge className={`${session.type === 'worker' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} hover:bg-opacity-80`}>
                                Day {session.currentDay} / {session.totalDays}
                            </Badge>
                        </div>
                    </DialogHeader>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>진행률</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <div className="space-y-6">
                        {children}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-4 border-t bg-white flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                        {canComplete ? '오늘의 할 일을 모두 완료했습니다! 🎉' : '모든 항목을 완료해야 다음으로 넘어갑니다.'}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            나중에 계속하기
                        </Button>
                        <Button
                            onClick={onCompleteDay}
                            disabled={!canComplete}
                            className={session.type === 'worker' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}
                        >
                            Day {session.currentDay} 완료 및 다음 단계
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default WizardDialog;
