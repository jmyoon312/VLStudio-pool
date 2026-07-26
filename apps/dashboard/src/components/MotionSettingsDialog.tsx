import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Move, Video, Zap } from "lucide-react";
import PresetSelector from './PresetSelector';

export interface MotionConfig {
    enable: boolean; // New toggle
    direction: 'random' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down';
    speed: number;
    shake: boolean;
}

interface MotionSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialConfig: MotionConfig;
    onSave: (config: MotionConfig) => void;
}

const MotionSettingsDialog: React.FC<MotionSettingsDialogProps> = ({ open, onOpenChange, initialConfig, onSave }) => {
    const [config, setConfig] = useState<MotionConfig>(initialConfig);

    useEffect(() => {
        if (open) {
            setConfig(initialConfig);
        }
    }, [open, initialConfig]);

    const handleSave = () => {
        onSave(config);
        onOpenChange(false);
    };

    const handlePresetSelect = (newConfig: any) => {
        setConfig(newConfig);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-blue-600" />
                        영상 모션 설정 (Motion Settings)
                    </DialogTitle>
                    <DialogDescription>
                        이미지에 적용할 움직임 효과를 설정합니다. (영상 소스에는 적용되지 않습니다)
                    </DialogDescription>
                </DialogHeader>

                <PresetSelector
                    type="motion"
                    currentConfig={config}
                    onSelect={handlePresetSelect}
                />

                <div className="grid gap-6 py-4">
                    {/* Master Toggle */}
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                        <div className="space-y-1">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                ✨ 모션 효과 적용
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                켜면 이미지에 움직임을 추가합니다. 끄면 정지 이미지로 렌더링됩니다.
                            </p>
                        </div>
                        <Switch
                            checked={config.enable}
                            onCheckedChange={(checked) => setConfig({ ...config, enable: checked })}
                        />
                    </div>

                    {/* Settings (Disabled if enable is false) */}
                    <div className={`space-y-6 ${!config.enable ? 'opacity-50 pointer-events-none' : ''}`}>
                        {/* Direction */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Move className="w-4 h-4" />
                                이동 방향 (Direction)
                            </Label>
                            <Select
                                value={config.direction}
                                onValueChange={(val: any) => setConfig({ ...config, direction: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="방향 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="random">🎲 랜덤 (Random)</SelectItem>
                                    <SelectItem value="zoom_in">🔍 줌 인 (Zoom In)</SelectItem>
                                    <SelectItem value="zoom_out">🔎 줌 아웃 (Zoom Out)</SelectItem>
                                    <SelectItem value="pan_left">⬅️ 왼쪽으로 이동 (Pan Left)</SelectItem>
                                    <SelectItem value="pan_right">➡️ 오른쪽으로 이동 (Pan Right)</SelectItem>
                                    <SelectItem value="pan_up">⬆️ 위로 이동 (Pan Up)</SelectItem>
                                    <SelectItem value="pan_down">⬇️ 아래로 이동 (Pan Down)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Speed */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    움직임 속도 (Speed): {config.speed.toFixed(1)}x
                                </Label>
                            </div>
                            <Slider
                                value={[config.speed]}
                                min={0.1}
                                max={3.0}
                                step={0.1}
                                onValueChange={([val]) => setConfig({ ...config, speed: val })}
                                className="py-2"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                                <span>느리게</span>
                                <span>보통</span>
                                <span>빠르게</span>
                            </div>
                        </div>

                        {/* Camera Shake */}
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                            <div className="space-y-1">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    🎥 핸드헬드 쉐이크 (Camera Shake)
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    사람이 직접 촬영한 듯한 미세한 떨림 효과를 추가합니다.
                                </p>
                            </div>
                            <Switch
                                checked={config.shake}
                                onCheckedChange={(checked) => setConfig({ ...config, shake: checked })}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSave}>설정 저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MotionSettingsDialog;
