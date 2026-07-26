import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { Settings, ConfigPreset, getConfigPresets, createConfigPreset, deleteConfigPreset } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Save, Trash2, Plus, Zap, Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AutoHDSettingsDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export const AutoHDSettingsDialog: React.FC<AutoHDSettingsDialogProps> = ({ open, onOpenChange, trigger }) => {
    const queryClient = useQueryClient();
    const [viralThreshold, setViralThreshold] = useState<string>('');
    const [velocityThreshold, setVelocityThreshold] = useState<string>('');
    const [presetName, setPresetName] = useState('');
    const [isSavingPreset, setIsSavingPreset] = useState(false);

    // Fetch Settings
    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: async () => (await api.get<Settings>('/settings/')).data
    });

    // Fetch Presets
    const { data: presets, isLoading: isPresetsLoading } = useQuery<ConfigPreset[]>({
        queryKey: ['config-presets', 'auto_hd'],
        queryFn: async () => await getConfigPresets('auto_hd')
    });

    // Update Settings Mutation
    const updateSettingsMutation = useMutation({
        mutationFn: async (data: Partial<Settings>) => {
            await api.patch('/settings/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success("설정이 저장되었습니다.");
        }
    });

    // Create Preset Mutation
    const createPresetMutation = useMutation({
        mutationFn: async (name: string) => {
            const config = {
                viral: parseFloat(viralThreshold) || 0,
                velocity: parseFloat(velocityThreshold) || 0
            };
            await createConfigPreset('auto_hd', name, config);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['config-presets'] });
            setPresetName('');
            setIsSavingPreset(false);
            toast.success("프리셋이 저장되었습니다.");
        }
    });

    // Delete Preset Mutation
    const deletePresetMutation = useMutation({
        mutationFn: async (id: number) => {
            await deleteConfigPreset(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['config-presets'] });
            toast.success("프리셋이 삭제되었습니다.");
        }
    });

    // Sync state with settings on open
    useEffect(() => {
        if (settings) {
            setViralThreshold(settings.auto_hd_viral_threshold?.toString() || '');
            setVelocityThreshold(settings.auto_hd_velocity_threshold?.toString() || '');
        }
    }, [settings]);

    const handleSaveSettings = () => {
        updateSettingsMutation.mutate({
            auto_hd_viral_threshold: parseFloat(viralThreshold) || 0,
            auto_hd_velocity_threshold: parseFloat(velocityThreshold) || 0
        });
        if (onOpenChange) onOpenChange(false);
    };

    const loadPreset = (preset: ConfigPreset) => {
        setViralThreshold(preset.config.viral?.toString() || '');
        setVelocityThreshold(preset.config.velocity?.toString() || '');
        toast.info(`'${preset.name}' 프리셋을 불러왔습니다. 저장을 눌러 적용하세요.`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-500" />
                        Auto HD 다운로드 설정
                    </DialogTitle>
                    <DialogDescription>
                        지정된 바이럴 지수나 급상승 속도를 초과하면 자동으로 고화질 영상을 다운로드합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Threshold Inputs */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 flex justify-center">
                                <Flame className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="viral" className="text-sm font-medium">바이럴 지수 임계값 (Viral Score)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="viral"
                                        type="number"
                                        placeholder="예: 150"
                                        value={viralThreshold}
                                        onChange={(e) => setViralThreshold(e.target.value)}
                                    />
                                    <span className="text-sm text-muted-foreground font-bold">% 이상</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">구독자 대비 조회수 비율 (예: 150%)</p>

                                {/* Viral Grade Reference */}
                                <div className="flex items-center gap-1.5 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                                    <div className="text-[10px] font-medium text-slate-500 mr-1">참고 등급:</div>
                                    <div className="flex gap-1">
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-white border-red-200 text-red-600 gap-0.5"><Flame className="w-2 h-2 fill-red-600" />S: 300%↑</Badge>
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-white border-orange-200 text-orange-600 gap-0.5"><Zap className="w-2 h-2" />A: 100%↑</Badge>
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-white border-emerald-200 text-emerald-600">B: 30%↑</Badge>
                                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-white border-slate-200 text-slate-600">C: 30%↓</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-10 flex justify-center">
                                <Zap className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="velocity" className="text-sm font-medium">급상승 속도 임계값 (Velocity)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="velocity"
                                        type="number"
                                        placeholder="예: 5000"
                                        value={velocityThreshold}
                                        onChange={(e) => setVelocityThreshold(e.target.value)}
                                    />
                                    <span className="text-sm text-muted-foreground font-bold">회/hr 이상</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">지난 1시간 동안의 조회수 증가량</p>
                            </div>
                        </div>
                    </div>

                    {/* Presets Section */}
                    <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-slate-500">프리셋 (Presets)</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                onClick={() => setIsSavingPreset(!isSavingPreset)}
                            >
                                {isSavingPreset ? "취소" : "+ 현재 설정 저장"}
                            </Button>
                        </div>

                        {isSavingPreset && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <Input
                                    placeholder="프리셋 이름 (예: 엄격한 기준)"
                                    className="h-8 text-sm"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                />
                                <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!presetName.trim() || createPresetMutation.isPending}
                                    onClick={() => createPresetMutation.mutate(presetName)}
                                >
                                    저장
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
                            {isPresetsLoading ? (
                                <div className="col-span-2 flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin opacity-50" /></div>
                            ) : presets && presets.length > 0 ? (
                                presets.map(preset => (
                                    <div key={preset.id} className="group flex items-center justify-between bg-white text-xs px-2.5 py-1.5 rounded border shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                                        onClick={() => loadPreset(preset)}
                                    >
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium truncate">{preset.name}</span>
                                            <span className="text-[9px] text-slate-600">🔥{preset.config.viral}% ⚡{preset.config.velocity}</span>
                                        </div>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-400 rounded transition-opacity"
                                            onClick={(e) => { e.stopPropagation(); deletePresetMutation.mutate(preset.id); }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 text-center text-xs text-slate-700 py-2">저장된 프리셋이 없습니다</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange && onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        설정 저장
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
