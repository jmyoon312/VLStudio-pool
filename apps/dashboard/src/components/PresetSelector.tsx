import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface PresetSelectorProps {
    type: 'tts' | 'motion' | 'subtitle';
    currentConfig: any;
    onSelect: (config: any) => void;
    onReset?: () => void;
}

const PresetSelector: React.FC<PresetSelectorProps> = ({ type, currentConfig, onSelect, onReset }) => {
    const queryClient = useQueryClient();
    const [selectedPresetId, setSelectedPresetId] = useState<string>("");
    const [presetName, setPresetName] = useState("");

    // Fetch Presets
    const { data: presets } = useQuery({
        queryKey: ['configPresets', type],
        queryFn: async () => (await api.get(`/creative/presets/${type}`)).data
    });

    // Mutations
    const createPresetMutation = useMutation({
        mutationFn: async (data: any) => (await api.post('/creative/presets', data)).data,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['configPresets', type] });
            setSelectedPresetId(String(data.id));
            setPresetName(""); // Clear name after save
            toast.success("프리셋 저장 완료!");
        }
    });

    const deletePresetMutation = useMutation({
        mutationFn: async (id: number) => (await api.delete(`/creative/presets/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configPresets', type] });
            setSelectedPresetId("");
            toast.success("프리셋 삭제 완료!");
        }
    });

    const handleSelect = (val: string) => {
        setSelectedPresetId(val);
        if (val === "new") {
            setPresetName("");
            return;
        }
        // @ts-ignore
        const preset = presets?.find((p: any) => String(p.id) === val);
        if (preset) {
            onSelect(preset.config);
            toast.info(`'${preset.name}' 프리셋 적용됨`);
        }
    };

    const handleSave = () => {
        if (!presetName.trim()) {
            toast.error("프리셋 이름을 입력해주세요.");
            return;
        }
        createPresetMutation.mutate({
            type,
            name: presetName,
            config: currentConfig
        });
    };

    const handleDelete = () => {
        if (!selectedPresetId || selectedPresetId === "new") return;
        if (confirm("정말 이 프리셋을 삭제하시겠습니까?")) {
            deletePresetMutation.mutate(Number(selectedPresetId));
        }
    };

    return (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">설정 프리셋 (Presets)</Label>
                {onReset && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onReset}>
                        <RotateCcw className="w-3 h-3 mr-1" /> 초기화
                    </Button>
                )}
            </div>

            <div className="flex gap-2">
                <Select value={selectedPresetId} onValueChange={handleSelect}>
                    <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="프리셋 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="new" className="text-primary font-medium">+ 새 프리셋 저장</SelectItem>
                        {presets?.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedPresetId && selectedPresetId !== "new" && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={handleDelete} title="삭제">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {selectedPresetId === "new" && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                    <Input
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="프리셋 이름 입력..."
                        className="h-9 text-sm"
                    />
                    <Button size="sm" onClick={handleSave} disabled={!presetName.trim()} className="h-9">
                        <Save className="w-4 h-4 mr-1" /> 저장
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PresetSelector;
