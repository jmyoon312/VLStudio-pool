import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TTSConfig } from '@/types/tts';
import TTSConfigPanel from '@/components/shared/TTSConfigPanel';

interface TTSSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialConfig?: any;
    onSave: (config: any) => void;
}

const TTSSettingsDialog = ({ open, onOpenChange, initialConfig, onSave }: TTSSettingsDialogProps) => {
    // Transform initialConfig (flat or mixed) to TTSConfig
    const [config, setConfig] = useState<TTSConfig>({
        engine: initialConfig?.engine || "supertone-local",
        language: initialConfig?.language || "ko",
        voice_id: initialConfig?.voice_id || "",
        speed: initialConfig?.speed || 1.0,
        pitch: initialConfig?.pitch || 0,
        emotion: initialConfig?.emotion || "normal",
        xi_stability: initialConfig?.xi_stability,
        xi_similarity_boost: initialConfig?.xi_similarity_boost,
        xi_style: initialConfig?.xi_style,
        use_silence_removal: initialConfig?.silenceEnabled || initialConfig?.use_silence_removal || false,
        silence_threshold: initialConfig?.silenceThreshold,
        min_silence_len: initialConfig?.minSilenceLen,
        keep_silence_len: initialConfig?.keepSilenceLen
    });

    const handleSave = () => {
        // Convert back to format expected by parent if needed, 
        // or just pass the clean TTSConfig. 
        // For backward compatibility we map back:
        const rate = Math.round((config.speed - 1.0) * 100);

        onSave({
            ...config,
            rate, // Legacy
            silenceEnabled: config.use_silence_removal,
            silenceThreshold: config.silence_threshold,
            minSilenceLen: config.min_silence_len,
            keepSilenceLen: config.keep_silence_len
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>TTS 고급 설정</DialogTitle>
                    <DialogDescription>
                        음성 합성 엔진과 보정 옵션을 설정합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <TTSConfigPanel
                        config={config}
                        onChange={setConfig}
                        compact={false}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSave}>저장 및 적용</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TTSSettingsDialog;
