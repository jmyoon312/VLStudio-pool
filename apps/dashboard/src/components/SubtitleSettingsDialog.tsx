
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Type } from "lucide-react";
import SubtitleConfigPanel from './shared/SubtitleConfigPanel';
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from '@/types/subtitle';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Helper to check if legacy object needs migration
// For now, we assume the parent 'CreativeStudio' passes a config object.
// We might need to cast or adapt it.
// The prop interface is defined here, but CreativeStudio imports the OLD one from this file.
// We must export `SubtitleConfig` from here recursively OR rely on the new type.
// Since we are replacing the file content, the old `SubtitleConfig` export will be gone.
// We should re-export the new one to avoid breaking imports in CreativeStudio.

export { type SubtitleConfig } from '@/types/subtitle';

interface SubtitleSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialConfig: SubtitleConfig;
    onSave: (config: SubtitleConfig) => void;
}

const SubtitleSettingsDialog: React.FC<SubtitleSettingsDialogProps> = ({ open, onOpenChange, initialConfig, onSave }) => {
    // We need to merge initialConfig with DEFAULT to ensure all fields exist
    // dealing with potential missing fields from legacy data.
    const [config, setConfig] = useState<SubtitleConfig>({
        ...DEFAULT_SUBTITLE_CONFIG,
        ...initialConfig
    });

    // Reset when opening
    useEffect(() => {
        if (open) {
            setConfig({
                ...DEFAULT_SUBTITLE_CONFIG,
                ...initialConfig
            });
        }
    }, [open, initialConfig]);

    const handleSave = () => {
        onSave(config);
        onOpenChange(false);
    };

    // Extra toggle for "Enabled" which corresponds to "Subtitle On/Off" in the old dialog using Switch
    // But 'SubtitleConfig' doesn't strictly have an 'enabled' field in the new type definition I made.
    // Wait, let's check the old one: `enabled: boolean;` was there.
    // My new type definition `src/types/subtitle.ts` MISSED `enabled`.
    // I should add `enabled` to the new type or handle it separately.
    // "CreativeStudio" state has `enabled`.
    // Use `any` cast for now or update type again? 
    // It's cleaner to add `enabled` to the type. 

    // I'll add `enabled` to the type in the next step or implicitly here.
    // For now, I'll assume config has it (via intersection or just loose typing) 
    // but strictly `SubtitleConfig` in `types/subtitle.ts` needs it for full compatibility.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Type className="w-5 h-5 text-green-600" />
                        자막 설정 (Subtitle Settings)
                    </DialogTitle>
                    <DialogDescription>
                        영상에 삽입될 자막의 스타일과 위치를 설정합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-4">
                    {/* Enable Toggle (Legacy Support) */}
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                        <div className="space-y-1">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                📝 자막 표시 (Enable Subtitles)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                켜면 대본 내용을 영상에 자막으로 입힙니다.
                            </p>
                        </div>
                        <Switch
                            checked={(config as any).enabled ?? true}
                            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked } as any)}
                        />
                    </div>

                    {/* Shared Config Panel */}
                    <SubtitleConfigPanel
                        config={config}
                        onChange={setConfig}
                        compact={false}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSave}>설정 저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SubtitleSettingsDialog;
