import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export interface AudioConfig {
    keepOriginalAudio: boolean;
    originalVolume: number;
}

interface AudioSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialConfig: AudioConfig;
    onSave: (config: AudioConfig) => void;
}

export default function AudioSettingsDialog({ open, onOpenChange, initialConfig, onSave }: AudioSettingsDialogProps) {
    const [config, setConfig] = useState<AudioConfig>(initialConfig);

    useEffect(() => {
        if (open) {
            setConfig(initialConfig);
        }
    }, [open, initialConfig]);

    const handleSave = () => {
        onSave(config);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <span className="text-2xl">🔊</span> 오디오 설정 (Audio Settings)
                    </DialogTitle>
                    <DialogDescription>
                        영상 렌더링 시 오디오 믹싱 옵션을 설정합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                        <div>
                            <h4 className="font-medium flex items-center gap-2">
                                🎙️ 원본 오디오 유지 (Keep Original Audio)
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                원본 영상에 소리가 있는 경우, 생성된 TTS와 함께 소리를 섞어서 재생합니다.
                            </p>
                        </div>
                        <Switch 
                            checked={config.keepOriginalAudio} 
                            onCheckedChange={(c) => setConfig({ ...config, keepOriginalAudio: c })}
                        />
                    </div>

                    <div className={`space-y-4 transition-opacity ${!config.keepOriginalAudio ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium">원본 볼륨 크기</label>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    {config.originalVolume}%
                                </span>
                            </div>
                            <Slider
                                value={[config.originalVolume]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(vals) => setConfig({ ...config, originalVolume: vals[0] })}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                TTS 음성(100%) 대비 원본 오디오의 볼륨을 조절합니다.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                        설정 저장
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
