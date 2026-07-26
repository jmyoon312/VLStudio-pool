import React, { useEffect, useState } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Info, RotateCw, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import api from '@/lib/api';

export interface LLMConfig {
    provider: string;
    model: string;
    temperature: number;
}

interface LLMConfigPanelProps {
    config: LLMConfig;
    setConfig: (config: LLMConfig) => void;
    compact?: boolean;
}

interface ModelOption {
    value: string;
    label: string;
}

interface ModelMap {
    [key: string]: ModelOption[];
}

const LLMConfigPanel = ({ config, setConfig, compact = false }: LLMConfigPanelProps) => {
    const { toast } = useToast();
    const [availableModels, setAvailableModels] = useState<ModelMap>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const fetchModels = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/creative/models');
            setAvailableModels(res.data);
            setIsInitialized(true);

            // Console log for debugging
            console.log("Fetched AI Models:", res.data);

        } catch (err: any) {
            console.error("Failed to fetch models:", err);
            toast({
                variant: 'destructive',
                title: "모델 목록 로드 실패",
                description: "AI 공급자로부터 모델 목록을 가져오지 못했습니다. 잠시 후 다시 시도해주세요."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchModels();
    }, []);

    // Auto-select first model when provider changes or models load
    useEffect(() => {
        if (!isInitialized) return;

        const models = availableModels[config.provider] || [];
        if (models.length > 0) {
            // Check if current model is valid
            const isValid = models.find(m => m.value === config.model);
            if (!isValid) {
                // If not valid, switch to first available
                setConfig({ ...config, model: models[0].value });
            }
        }
    }, [config.provider, availableModels, isInitialized]);

    const activeModels = availableModels[config.provider] || [];

    return (
        <div className={`space-y-4 ${compact ? 'text-xs' : ''} relative`}>
            {/* Loading Overlay for Initial Load */}
            {!isInitialized && isLoading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-sm rounded">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className={compact ? "text-[10px]" : "text-sm"}>Provider</Label>
                    <Select
                        value={config.provider}
                        onValueChange={(val) => setConfig({ ...config, provider: val })}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="groq">Groq</SelectItem>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                            <SelectItem value="sambanova">SambaNova</SelectItem>
                            <SelectItem value="cerebras">Cerebras</SelectItem>
                            <SelectItem value="opencode">OpenCode Zen</SelectItem>
                            <SelectItem value="ollama">Ollama</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className={compact ? "text-[10px]" : "text-sm"}>Model</Label>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 text-slate-600 hover:text-indigo-600"
                            onClick={(e) => { e.stopPropagation(); fetchModels(); }}
                            title="Refresh Models"
                        >
                            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <Select
                        value={config.model}
                        onValueChange={(val) => setConfig({ ...config, model: val })}
                        disabled={isLoading && !isInitialized}
                    >
                        <SelectTrigger className="h-8">
                            {isLoading && activeModels.length === 0 ? (
                                <span className="flex items-center gap-2 text-slate-600">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                                </span>
                            ) : (
                                <SelectValue placeholder="Select Model" />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {activeModels.length === 0 && !isLoading && (
                                <div className="p-2 text-xs text-center text-slate-600">
                                    No models available found.
                                </div>
                            )}
                            {activeModels.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label className={compact ? "text-[10px]" : "text-sm"}>Temperature: {config.temperature}</Label>
                    <span className="text-[10px] text-slate-600">Creativity</span>
                </div>
                <Slider
                    value={[config.temperature]}
                    onValueChange={(vals) => setConfig({ ...config, temperature: vals[0] })}
                    max={1}
                    step={0.1}
                    className="py-2"
                />
            </div>

            {/* Debug Info (Only if models empty and initialized) */}
            {isInitialized && activeModels.length === 0 && (
                <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5" />
                    <span>
                        모델 목록이 비어있습니다. API 키 설정을 확인하거나 새로고침 해주세요.
                    </span>
                </div>
            )}
        </div>
    );
};

export default LLMConfigPanel;
