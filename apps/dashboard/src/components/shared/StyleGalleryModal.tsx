import React, { useCallback, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
// @ts-ignore
import StylePicker from "../../features/flow2capcut/components/StylePicker";
// @ts-ignore
import { useStyleThumbnails } from "../../features/flow2capcut/hooks/useStyleThumbnails";
// @ts-ignore
import { STYLE_PRESETS } from "../../features/flow2capcut/config/defaults";

interface StyleGalleryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectStyle: (style: any) => void;
}

export function StyleGalleryModal({ open, onOpenChange, onSelectStyle }: StyleGalleryModalProps) {
    // Dummy flow API just to satisfy the hook if needed (we only load, not generate here)
    const mockFlowAPI = {};

    // Use the exact hook from flow2capcut to load thumbnails
    const { thumbnails, loadThumbnails } = useStyleThumbnails(mockFlowAPI);

    useEffect(() => {
        if (open) {
            loadThumbnails();
        }
    }, [open, loadThumbnails]);

    // Handle selection from StylePicker
    const handleSelect = useCallback((selectedId: string | null) => {
        if (!selectedId) return;

        // format: "preset:ghibli"
        if (selectedId.startsWith('preset:')) {
            const presetId = selectedId.replace('preset:', '');
            const preset = STYLE_PRESETS?.styles?.find((s: any) => s.id === presetId);
            if (preset) {
                onSelectStyle(preset);
                onOpenChange(false);
            }
        }
    }, [onSelectStyle, onOpenChange]);

    // Dummy t function since we don't have i18next setup here matching flow2capcut
    const t = (key: string) => {
        const translations: Record<string, string> = {
            'reference.allCategories': '모든 카테고리',
            'reference.uploadedStyles': '업로드된 스타일',
            'reference.noStyle': '선택 안함',
        };
        return translations[key] || key;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[900px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-muted/20">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <span role="img" aria-label="palette">🎨</span> 시각적 스타일 갤러리
                    </DialogTitle>
                    <DialogDescription>
                        원하는 아트 스타일을 선택하세요. 긍정 프롬프트에 자동으로 적용됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative bg-muted/5">
                    {/* StylePicker component from flow2capcut */}
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                        <StylePicker
                            selectedId={null}
                            onSelect={handleSelect}
                            thumbnails={thumbnails}
                            onDeleteThumbnail={() => {}}
                            uploadedStyleRefs={[]}
                            generating={false}
                            stopping={false}
                            progress={{ current: 0, total: 0 }}
                            onGenerateThumbnails={null}
                            onStopGenerating={() => {}}
                            onCustomStyleUpload={null}
                            autoCardMeta={{ label: '스타일 선택 안함', icon: '🚫', tooltip: '프롬프트 적용 취소', summary: null }}
                            t={t}
                            isKo={true}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
