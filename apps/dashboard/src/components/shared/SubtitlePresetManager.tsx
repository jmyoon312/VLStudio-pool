import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Save,
    FolderOpen,
    Trash2,
    Edit2,
    X,
    Plus
} from "lucide-react";
import { SubtitleConfig } from '@/types/subtitle';
import { toast } from 'sonner';

interface SubtitlePreset {
    id: string;
    name: string;
    config: SubtitleConfig;
    updatedAt: number;
}

interface SubtitlePresetManagerProps {
    currentConfig: SubtitleConfig;
    onLoad: (config: SubtitleConfig) => void;
}

const STORAGE_KEY = 'vira_subtitle_presets';

export function SubtitlePresetManager({ currentConfig, onLoad }: SubtitlePresetManagerProps) {
    const [presets, setPresets] = useState<SubtitlePreset[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSaveMode, setIsSaveMode] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Load presets on mount
    useEffect(() => {
        loadPresets();
    }, []);

    const loadPresets = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setPresets(JSON.parse(stored).sort((a: SubtitlePreset, b: SubtitlePreset) => b.updatedAt - a.updatedAt));
            }
        } catch (e) {
            console.error("Failed to load presets", e);
        }
    };

    const savePresets = (newPresets: SubtitlePreset[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
            setPresets(newPresets);
        } catch (e) {
            toast.error("프리셋 저장 실패");
        }
    };

    const handleSaveNew = () => {
        if (!newPresetName.trim()) {
            toast.error("프리셋 이름을 입력해주세요");
            return;
        }

        const newPreset: SubtitlePreset = {
            id: crypto.randomUUID(),
            name: newPresetName.trim(),
            config: currentConfig,
            updatedAt: Date.now()
        };

        const updated = [newPreset, ...presets];
        savePresets(updated);
        toast.success(`'${newPresetName}' 프리셋 저장됨`);
        setNewPresetName('');
        setIsSaveMode(false);
    };

    const handleUpdate = (id: string, name?: string) => {
        const updated = presets.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    name: name || p.name,
                    config: name ? p.config : currentConfig, // If just renaming, keep config. If updating, use current.
                    updatedAt: Date.now()
                };
            }
            return p;
        }).sort((a, b) => b.updatedAt - a.updatedAt);

        savePresets(updated);
        if (!name) toast.success("현재 설정으로 업데이트됨");
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm("정말 이 프리셋을 삭제하시겠습니까?")) return;
        const updated = presets.filter(p => p.id !== id);
        savePresets(updated);
        toast.success("프리셋 삭제됨");
    };

    const activePreset = presets.find(p => JSON.stringify(p.config) === JSON.stringify(currentConfig));

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant={activePreset ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1.5 px-2">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {activePreset ? activePreset.name : "프리셋"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between bg-slate-50/50">
                    <h4 className="font-medium text-xs text-slate-700">자막 스타일 프리셋</h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-slate-200"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsOpen(false);
                        }}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>

                <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto" onKeyDown={e => e.stopPropagation()}>
                    {/* Save New Section */}
                    {isSaveMode ? (
                        <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] text-indigo-700 font-semibold">새 프리셋 저장</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 text-indigo-400 hover:text-indigo-600"
                                    onClick={() => setIsSaveMode(false)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                            <div className="flex gap-1.5">
                                <Input
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder="예: 예능 자막 (노란색)"
                                    className="h-7 text-xs bg-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') handleSaveNew();
                                    }}
                                />
                                <Button size="sm" className="h-7 px-2" onClick={handleSaveNew}>
                                    <Save className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full justify-start h-8 text-xs border-dashed text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                            onClick={() => setIsSaveMode(true)}
                        >
                            <Plus className="w-3.5 h-3.5 mr-2" />
                            현재 스타일 저장하기
                        </Button>
                    )}

                    {/* Preset List */}
                    <div className="space-y-1">
                        {presets.length === 0 && !isSaveMode && (
                            <div className="text-center py-6 text-slate-600 text-xs">
                                저장된 프리셋이 없습니다.
                            </div>
                        )}

                        {presets.map(preset => (
                            <div
                                key={preset.id}
                                className="group flex items-center justify-between p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    {editingId === preset.id ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                defaultValue={preset.name}
                                                className="h-6 text-xs"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    e.stopPropagation();
                                                    if (e.key === 'Enter') handleUpdate(preset.id, e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col cursor-pointer" onClick={() => {
                                            onLoad(preset.config);
                                            setIsOpen(false);
                                        }}>
                                            <span className="text-xs font-medium text-slate-700 truncate">{preset.name}</span>
                                            <span className="text-[10px] text-slate-600">
                                                {new Date(preset.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-600 hover:text-indigo-600"
                                        title="이름 변경"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(preset.id);
                                        }}
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-600 hover:text-indigo-600"
                                        title="현재 설정으로 덮어쓰기"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`현재 설정으로 '${preset.name}'을 업데이트하시겠습니까?`)) {
                                                handleUpdate(preset.id);
                                            }
                                        }}
                                    >
                                        <Save className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-slate-600 hover:text-red-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(preset.id);
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
