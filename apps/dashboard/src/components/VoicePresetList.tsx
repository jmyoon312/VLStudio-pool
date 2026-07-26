import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Star, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VoicePreset {
    id: string;
    label: string;
    engine: string;
    language: string;
    voice_id: string;
    speed: number;
    pitch: number;
}

interface VoicePresetListProps {
    currentConfig: {
        engine: string;
        language: string;
        voice_id: string;
        speed: number;
        pitch: number;
    };
    onSelect: (preset: VoicePreset) => void;
}

const STORAGE_KEY = 'tts_voice_presets';

export const VoicePresetList: React.FC<VoicePresetListProps> = ({ currentConfig, onSelect }) => {
    const [presets, setPresets] = useState<VoicePreset[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newLabel, setNewLabel] = useState("");

    // Load presets on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setPresets(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse presets", e);
            }
        }
    }, []);

    const savePresets = (newPresets: VoicePreset[]) => {
        setPresets(newPresets);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    };

    const handleAddPreset = () => {
        if (!newLabel.trim()) return;

        // Fallback for crypto.randomUUID
        const genId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

        const newPreset: VoicePreset = {
            id: genId(),
            label: newLabel,
            ...currentConfig
        };

        const updated = [...presets, newPreset];
        savePresets(updated);
        setNewLabel("");
        setIsAddOpen(false);
        toast.success("프리셋이 저장되었습니다.");
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("정말 이 프리셋을 삭제하시겠습니까?")) {
            const updated = presets.filter(p => p.id !== id);
            savePresets(updated);
            toast.success("삭제되었습니다.");
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    즐겨찾는 목소리 (Favorites)
                </Label>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>현재 설정을 즐겨찾기에 추가</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>설정 이름 (예: 나레이션, 주인공)</Label>
                                <Input
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    placeholder="이름을 입력하세요"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddPreset()}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                                <p>엔진: {currentConfig.engine}</p>
                                <p>언어: {currentConfig.language}</p>
                                <p>목소리 ID: {currentConfig.voice_id}</p>
                                <p>속도: {currentConfig.speed}</p>
                                <p>Pitch: {currentConfig.pitch}</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddPreset}>저장</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {presets.length === 0 ? (
                <div className="text-center py-4 border border-dashed rounded-lg text-muted-foreground text-xs">
                    저장된 목소리가 없습니다. 현재 설정을 추가해보세요.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {presets.map(preset => (
                        <div
                            key={preset.id}
                            className="group relative flex items-center p-2 rounded-lg border bg-white hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all"
                            onClick={() => onSelect(preset)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                    <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4 leading-none">
                                        {preset.language === 'ko' ? '한글' : preset.language.toUpperCase()}
                                    </Badge>
                                    <span className="truncate">{preset.label}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    {preset.engine} · {preset.voice_id}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2 hover:bg-red-50 hover:text-red-600"
                                onClick={(e) => handleDelete(e, preset.id)}
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
