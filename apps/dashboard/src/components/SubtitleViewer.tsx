import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, Check, Languages, AlertCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface SubtitleViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    videoId: number | null;
    title: string;
    description?: string | null;
}

const SubtitleViewer = ({ open, onOpenChange, videoId, title, description }: SubtitleViewerProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isCopied, setIsCopied] = useState(false);
    const [generateMessage, setGenerateMessage] = useState<string | null>(null);

    const { data: subtitleContent, isLoading, refetch } = useQuery({
        queryKey: ['subtitles', videoId],
        queryFn: async () => {
            if (!videoId) return null;
            return (await api.get(`/videos/${videoId}/subtitles`)).data;
        },
        enabled: !!videoId && open
    });

    const hasSubtitle = !!subtitleContent?.content &&
        subtitleContent.content !== "No subtitles found." &&
        subtitleContent.content !== "Directory not found.";

    const generateMutation = useMutation({
        mutationFn: async () => {
            return (await api.post(`/videos/${videoId}/generate-subtitles`)).data;
        },
        onSuccess: (data) => {
            setGenerateMessage('⚙️ 자막 생성 중... 약 20초 후 새로고침 됩니다.');
            // Poll after 25s for result
            setTimeout(async () => {
                await refetch();
                queryClient.invalidateQueries({ queryKey: ['subtitles', videoId] });
                setGenerateMessage(null);
            }, 25000);
        },
        onError: (err: any) => {
            setGenerateMessage(`❌ 오류: ${err?.response?.data?.detail || '자막 생성에 실패했습니다.'}`);
            setTimeout(() => setGenerateMessage(null), 5000);
        }
    });

    const handleCopySubtitle = async () => {
        if (!subtitleContent?.content) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(subtitleContent.content);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } else {
                const isSecureContext = window.isSecureContext;
                if (!isSecureContext) {
                    alert("클립보드 복사는 HTTPS 또는 localhost 환경에서만 지원됩니다.");
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = subtitleContent.content;
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                    } catch (err) {
                        console.error('Fallback: Oops, unable to copy', err);
                        alert("클립보드 복사에 실패했습니다.");
                    }
                    document.body.removeChild(textArea);
                }
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            alert("클립보드 복사 중 오류가 발생했습니다.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pr-6">
                    <div className="space-y-1">
                        <DialogTitle>자막 보기</DialogTitle>
                        <DialogDescription className="line-clamp-1 text-left">
                            {title}
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Generate Subtitle Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                            onClick={() => generateMutation.mutate()}
                            disabled={generateMutation.isPending}
                            title="자막 생성"
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline text-xs">
                                {generateMutation.isPending ? '생성 중...' : '자막 생성'}
                            </span>
                        </Button>

                        {/* Copy Button */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleCopySubtitle}
                            disabled={!hasSubtitle}
                            title="자막 복사"
                        >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>

                        {/* Script Translate Button */}
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => {
                                if (subtitleContent?.content) {
                                    navigate('/script-writer', { state: { initialScript: subtitleContent.content } });
                                }
                            }}
                            disabled={!hasSubtitle}
                            title="대본 번역 및 변환"
                        >
                            <Languages className="h-4 w-4" />
                            <span className="hidden sm:inline">대본 번역</span>
                        </Button>
                    </div>
                </DialogHeader>

                {/* Status Message */}
                {generateMessage && (
                    <div className="text-xs text-center text-muted-foreground bg-violet-50 border border-violet-100 rounded-md px-3 py-2">
                        {generateMessage}
                    </div>
                )}

                <ScrollArea className="h-[60vh] w-full rounded-md border p-4 bg-muted/30">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : hasSubtitle ? (
                        <div className="text-sm text-foreground/80 p-2 space-y-1">
                            {subtitleContent.content
                                .split(/\r?\n/)
                                .map((line: string) => line.trim())
                                .filter((line: string) => line.length > 0)
                                .map((line: string, i: number) => (
                                    <p key={i} className="leading-relaxed">
                                        {line}
                                    </p>
                                ))
                            }
                        </div>
                    ) : description ? (
                        <div className="text-sm text-foreground/80 p-2 space-y-1">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">동영상 설명</p>
                            {description
                                .split(/\r?\n/)
                                .map((line: string) => line.trim())
                                .filter((line: string) => line.length > 0)
                                .map((line: string, i: number) => (
                                    <p key={i} className="leading-relaxed">
                                        {line}
                                    </p>
                                ))
                            }
                            <div className="mt-4 pt-3 border-t border-border flex justify-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50"
                                    onClick={() => generateMutation.mutate()}
                                    disabled={generateMutation.isPending}
                                >
                                    {generateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                    {generateMutation.isPending ? '자막 생성 중...' : 'AI로 자막 생성하기'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                            <AlertCircle className="w-8 h-8 opacity-50" />
                            <p className="text-sm">자막 파일이 없습니다.</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50"
                                onClick={() => generateMutation.mutate()}
                                disabled={generateMutation.isPending}
                            >
                                {generateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                {generateMutation.isPending ? '자막 생성 중...' : 'AI로 자막 생성하기'}
                            </Button>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default SubtitleViewer;
