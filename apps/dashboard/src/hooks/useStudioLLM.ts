import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useEffect } from 'react';
import { LLMConfig } from '@/components/shared/LLMConfigPanel';

export const useStudioLLM = (initialConfig?: LLMConfig) => {
    const [config, setConfig] = useState<LLMConfig>(initialConfig || {
        provider: 'google',
        model: 'gemini-1.5-pro',
        temperature: 0.7
    });

    const { data: availableModels } = useQuery({
        queryKey: ['availableModels'],
        queryFn: async () => {
            const res = await api.get('/creative/models');
            return res.data;
        },
        initialData: {} // Zero base: start empty
    });

    // Auto-update model if provider changes
    useEffect(() => {
        const models = availableModels[config.provider as keyof typeof availableModels] || [];
        const currentModelValid = models.find((m: { value: string }) => m.value === config.model);

        if (!currentModelValid && models.length > 0) {
            setConfig(prev => ({ ...prev, model: models[0].value }));
        }
    }, [config.provider, availableModels]);

    const runLLM = useMutation({
        mutationFn: async (payload: {
            system_prompt: string,
            user_input: string,
            config: LLMConfig
        }) => {
            const res = await api.post('/creative/generate-text', {
                provider: payload.config.provider,
                model: payload.config.model,
                temperature: payload.config.temperature,
                system_prompt: payload.system_prompt,
                prompt: payload.user_input
            });
            return res.data;
        }
    });

    return {
        config,
        setConfig,
        availableModels,
        runLLM
    };
};
