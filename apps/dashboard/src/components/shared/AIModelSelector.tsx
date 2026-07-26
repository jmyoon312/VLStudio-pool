import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2, AlertCircle, Settings2, Search, X, RefreshCcw } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import api, { ScriptStyle } from '@/lib/api';

interface AIModelSelectorProps {
    provider: string;
    onProviderChange: (value: string) => void;
    model: string;
    onModelChange: (value: string) => void;
    
    // [NEW] Custom Model Support
    allowCustom?: boolean;

    // Optional: Styles/Presets
    presetId?: string;
    onPresetChange?: (value: string) => void;

    // Optional: UI Controls
    compact?: boolean;
    disabled?: boolean;
    showModel?: boolean;
    showPreset?: boolean;

    // Optional: Preset CRUD Actions
    onEditPreset?: (preset: ScriptStyle) => void;
    onCreatePreset?: () => void;
}

// 1. Static Provider List (Always Visible)
const PROVIDER_OPTIONS = [
    { value: "google", label: "Google" },
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "groq", label: "Groq (OpenSource)" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "sambanova", label: "SambaNova" },
    { value: "cerebras", label: "Cerebras" },
    { value: "xai", label: "xAI (Grok)" },
    { value: "nvidia", label: "NVIDIA" },
    { value: "ollama", label: "Ollama" },
    { value: "youtube1", label: "YouTube1" },
];

const AIModelSelector = ({
    provider,
    onProviderChange,
    model,
    onModelChange,
    presetId,
    onPresetChange,
    compact = false,
    disabled = false,
    showModel = true,
    showPreset = false,
    onEditPreset,
    onCreatePreset,
    allowCustom = true // Default to true if not specified
}: AIModelSelectorProps) => {


    // 2. Dynamic Model Fetching
    const { data: fetchedModels, isLoading, isError, refetch } = useQuery({
        queryKey: ['availableModels'],
        queryFn: async ({ queryKey }) => {
            const force = (queryKey as any)[1]?.force;
            const res = await api.get(`/creative/models${force ? '?force=true' : ''}`);
            return res.data || {};
        },
        staleTime: 1000 * 60 * 1, // 1 minute
        retry: 2,
    });

    const forceRefresh = () => {
        refetch({ queryKey: ['availableModels', { force: true }] } as any);
    };

    const currentProviderModels = useMemo(() => {
        if (!fetchedModels) return [];
        let models = fetchedModels[provider] || [];
        if (provider === 'ollama') {
            models = fetchedModels['ollama'] || [];
        }
        if (provider === 'openrouter') {
            models = fetchedModels['openrouter'] || [];
        }
        
        // [FIX] Deduplicate models by value to prevent React key warnings
        const uniqueModels = [];
        const seen = new Set();
        for (const model of models) {
            if (!seen.has(model.value)) {
                seen.add(model.value);
                uniqueModels.push(model);
            }
        }
        return uniqueModels;
    }, [fetchedModels, provider]);

    const [searchTerm, setSearchTerm] = React.useState("");
    const filteredModels = useMemo(() => {
        if (!searchTerm) return currentProviderModels;
        return currentProviderModels.filter((m: any) => 
            m.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
            m.value.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [currentProviderModels, searchTerm]);

    const [isCustom, setIsCustom] = React.useState(false);
    const prevProviderRef = React.useRef(provider);

    // 3. Smart Auto-Selection logic
    const handleProviderChange = (newProvider: string) => {
        onProviderChange(newProvider);
        // We don't call onModelChange here directly to avoid race conditions in parent state
    };

    // Auto-select model when provider changes OR when model is empty
    useEffect(() => {
        if (isLoading || !fetchedModels || !provider) return;

        const providerModels = fetchedModels[provider] || [];
        const hasModels = providerModels.length > 0;
        const providerChanged = prevProviderRef.current !== provider;
        
        // Scenario A: Model is explicitly empty -> Select first available
        if (!model && hasModels) {
            onModelChange(providerModels[0].value);
        } 
        // Scenario B: Provider just changed -> Select first available for new provider
        // (Only if not in custom mode or if we want to force valid models on provider switch)
        else if (providerChanged && hasModels) {
            onModelChange(providerModels[0].value);
        }

        prevProviderRef.current = provider;
    }, [provider, fetchedModels, model, onModelChange, isLoading]);

    // Keep custom mode state in sync
    React.useEffect(() => {
        if (!fetchedModels || isLoading) return;
        
        const models = fetchedModels[provider] || [];
        if (model && models.length > 0 && !models.some((m: any) => m.value === model)) {
            setIsCustom(true);
        } else if (!model) {
            setIsCustom(false);
        } else {
            setIsCustom(false);
        }
    }, [model, provider, fetchedModels, isLoading]);

    // --- Styling Classes ---
    const labelClass = compact ? "text-[10px] text-slate-500" : "text-sm font-medium";
    const selectTriggerClass = compact ? "h-8 text-xs bg-white" : "bg-white";
    const itemClass = compact ? "text-xs" : "";

    // Fetch Styles (only if needed)
    const { data: styles } = useQuery<ScriptStyle[]>({
        queryKey: ['scriptStyles'],
        queryFn: async () => (await api.get('/creative/script-styles')).data,
        enabled: showPreset
    });

    return (
        <div className={cn("grid gap-4", compact ? "grid-cols-2 gap-3" : "grid-cols-1 md:grid-cols-2")}>
            {/* Provider Section */}
            <div className="space-y-2">
                <div className="flex items-end min-h-[28px] pb-1">
                    <Label className={labelClass}>제공자 (Provider)</Label>
                </div>
                <Select value={provider} onValueChange={handleProviderChange} disabled={disabled}>
                    <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {PROVIDER_OPTIONS.filter((opt) => {
                            // Only display providers that have models loaded from user's keys
                            return fetchedModels?.[opt.value]?.length > 0 || ['ollama', 'nvidia', 'xai', 'openai', 'anthropic', 'youtube1'].includes(opt.value);
                        }).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className={itemClass}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Model Dropdown (Dynamic) */}
            {showModel && (
                <div className="space-y-2">
                    <div className="flex items-end justify-between min-h-[28px] pb-1">
                        <Label className={labelClass}>모델 (Model)</Label>
                        <button 
                            onClick={(e) => { e.preventDefault(); forceRefresh(); }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                            disabled={isLoading}
                        >
                            <RefreshCcw className={cn("w-2.5 h-2.5", isLoading && "animate-spin")} />
                            동적 갱신
                        </button>
                    </div>
                    <Select
                        value={isCustom ? "custom" : model}
                        onValueChange={(val) => {
                            if (val === "custom") {
                                setIsCustom(true);
                                onModelChange("");
                            } else {
                                setIsCustom(false);
                                onModelChange(val);
                            }
                        }}
                        disabled={disabled || isLoading || (currentProviderModels.length === 0 && !allowCustom)}
                    >
                        <SelectTrigger className={selectTriggerClass}>
                            {isLoading ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>로딩 중...</span>
                                </div>
                            ) : isError ? (
                                <div className="flex items-center gap-2 text-red-500 cursor-pointer" onClick={() => refetch()}>
                                    <AlertCircle className="w-3 h-3" />
                                    <span>오류 (클릭해서 재시도)</span>
                                </div>
                            ) : isCustom ? (
                                <div className="flex items-center gap-2 text-blue-600">
                                    <Settings2 className="w-3 h-3" />
                                    <span>커스텀 입력 중...</span>
                                </div>
                            ) : currentProviderModels.length === 0 && !allowCustom ? (
                                <div className="flex items-center gap-2 text-red-400">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>모델 없음 (Check Key)</span>
                                </div>
                            ) : (
                                <SelectValue placeholder="모델 선택" />
                            )}
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px] min-w-[300px]">
                            {/* [NEW] Search Input */}
                            <div className="flex items-center px-3 py-2 border-b sticky top-0 bg-white z-10">
                                <Search className="w-3.5 h-3.5 mr-2 text-slate-600" />
                                <input
                                    className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-slate-600"
                                    placeholder="모델 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()} // Prevent Select from handling keys
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setSearchTerm(""); }}
                                        className="text-slate-600 hover:text-slate-600 ml-1"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            <div className="overflow-y-auto max-h-[300px]">
                                {filteredModels.length > 0 ? (
                                    filteredModels.map((opt: any) => (
                                        <SelectItem key={opt.value} value={opt.value} className={itemClass}>
                                            {opt.label}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="py-6 text-center text-xs text-slate-600 italic">
                                        검색 결과가 없습니다
                                    </div>
                                )}
                            </div>
                            {allowCustom && (
                                <>
                                    <div className="h-px bg-slate-100 my-1" />
                                    <SelectItem value="custom" className={cn(itemClass, "text-blue-600 font-medium")}>
                                        커스텀 모델 직접 입력...
                                    </SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                    
                    {/* Custom Input Field (Appears when custom is selected) */}
                    {isCustom && (
                        <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                            <Input 
                                value={model}
                                onChange={(e) => onModelChange(e.target.value)}
                                placeholder="예: openrouter/free 또는 provider/model-id"
                                className="h-8 text-xs border-blue-200 focus:border-blue-400 bg-blue-50/30"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Preset Dropdown (Optional) */}
            {showPreset && onPresetChange && (
                <div className={`space-y-1 ${compact ? 'col-span-2' : ''}`}>
                    <Label className={labelClass}>작가 지침서 (Preset)</Label>
                    <div className="flex gap-2">
                        <Select value={presetId || "none"} onValueChange={(val) => onPresetChange(val === "none" ? "" : val)} disabled={disabled}>
                            <SelectTrigger className={`flex-1 ${selectTriggerClass}`}>
                                <SelectValue placeholder="지침서 선택..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className={itemClass}>선택하세요 (None)</SelectItem>
                                {styles?.map(style => (
                                    <SelectItem key={style.id} value={String(style.id)} className={itemClass}>
                                        {style.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {onCreatePreset && (
                            <Button variant="outline" size="icon" className={compact ? "h-8 w-8" : ""} onClick={onCreatePreset} disabled={disabled}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        )}

                        {onEditPreset && presetId && presetId !== "none" && (
                            <Button variant="outline" size="icon" className={compact ? "h-8 w-8" : ""} onClick={() => {
                                const style = styles?.find(s => String(s.id) === presetId);
                                if (style) onEditPreset(style);
                            }} disabled={disabled}>
                                <Edit className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIModelSelector;
