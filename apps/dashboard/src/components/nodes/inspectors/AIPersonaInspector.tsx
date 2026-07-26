import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCircle2, Play, Sparkles, Wand2, ArrowDownCircle } from 'lucide-react';
import LLMConfigPanel, { LLMConfig } from '@/components/shared/LLMConfigPanel';
import api from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";

interface AIPersonaInspectorProps {
    node: Node;
    updateData: (data: any) => void;
}

const PERSONA_PRESETS = [
    {
        id: "reviewer_sarcastic",
        name: "Movie Reviewer (Sarcastic)",
        prompt: "You are a cynical, witty movie critic who loves to poke fun at tropes. Write a script based on the provided analysis. Use sharp humor, rhetorical questions, and a fast-paced tone. End with a polarized rating."
    },
    {
        id: "news_anchor",
        name: "News Anchor (Professional)",
        prompt: "You are a trusted news anchor delivering breaking news. Present the analyzed facts with authority, clarity, and neutrality. Use 'We are receiving reports...' and 'Experts say...' phrasing. Maintain a formal tone."
    },
    {
        id: "storyteller_emotional",
        name: "Emotional Storyteller",
        prompt: "You are a master storyteller. Weave the key moments into a touching narrative that pulls at the heartstrings. Focus on the human element, struggle, and triumph. Use evocative language and sensory details."
    },
    {
        id: "gen_z_explainer",
        name: "Gen-Z Explainer (Music Style)",
        prompt: "You are a energetic Music creator explaining a complex topic. Use slang (no cap, fr), quick cuts in writing style, and direct address to the audience ('Listen up!'). Keep it high energy and under 60 seconds reading time."
    }
];

const AIPersonaInspector = ({ node, updateData }: AIPersonaInspectorProps) => {
    const { toast } = useToast();

    // State
    const [config, setConfig] = useState<LLMConfig>(node.data.config || {
        provider: 'groq',
        model: 'groq/llama-3.3-70b-versatile',
        temperature: 0.7 // Higher default for creativity
    });

    const [systemPrompt, setSystemPrompt] = useState(node.data.systemPrompt || PERSONA_PRESETS[0].prompt);
    const [selectedPreset, setSelectedPreset] = useState(node.data.presetId || "reviewer_sarcastic");
    const [testOutput, setTestOutput] = useState("");
    const [loading, setLoading] = useState(false);

    // Sync to Node Data
    useEffect(() => {
        updateData({
            config,
            systemPrompt,
            presetId: selectedPreset,
            label: `Persona: ${PERSONA_PRESETS.find(p => p.id === selectedPreset)?.name || "Custom"}`
        });
    }, [config, systemPrompt, selectedPreset]);

    const handlePresetChange = (val: string) => {
        setSelectedPreset(val);
        const preset = PERSONA_PRESETS.find(p => p.id === val);
        if (preset) {
            setSystemPrompt(preset.prompt);
        }
    };

    const handleTestRun = async () => {
        if (!systemPrompt) return;
        setLoading(true);
        try {
            const res = await api.post('/llm/preview', {
                provider: config.provider,
                model: config.model,
                temperature: config.temperature,
                system_prompt: systemPrompt,
                input_text: "STRUCTURED ANALYSIS:\n- Key Topic: Rising Coffee Prices\n- Sentiment: Negative\n- Key Moment: Farmers striking in Brazil." // Simulated Agent Output
            });
            setTestOutput(res.data.output || "No output generated.");
            toast({ title: "Draft Generated", description: "Test run finished successfully." });
        } catch (e: any) {
            console.error(e);
            setTestOutput("Error calling preview API. Ensure backend is running.\n\nSimulated Output:\n'Okay, listen. You think your morning latte is expensive now? Just wait. The farmers in Brazil are NOT having it...'");
            toast({ variant: "destructive", title: "Test Failed", description: "Could not reach LLM endpoint." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="p-4 bg-white border-b flex items-center gap-2 shrink-0">
                <UserCircle2 className="w-5 h-5 text-pink-500" />
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Persona & Style Engine</h3>
                    <p className="text-xs text-slate-500">Draft scripts with personality</p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {/* 0. Input Context Visualizer */}
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-2 flex items-center gap-2 text-xs text-blue-700">
                        <ArrowDownCircle className="w-4 h-4" />
                        <span className="font-medium">Receives: Structured Analysis Data</span>
                    </div>

                    {/* 1. LLM Configuration */}
                    <div className="space-y-3 bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <Label className="text-xs font-bold text-slate-700">Creative Model</Label>
                        </div>
                        <LLMConfigPanel config={config} setConfig={setConfig} compact />
                    </div>

                    {/* 2. Persona Preset */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-slate-700">Writing Style / Persona</Label>
                        <Select value={selectedPreset} onValueChange={handlePresetChange}>
                            <SelectTrigger className="text-xs h-8 bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PERSONA_PRESETS.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 3. System Prompt Editor */}
                    <div className="space-y-2 flex-1 flex flex-col min-h-[200px]">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold text-slate-700">Persona Instruction</Label>
                            <div className="flex gap-1">
                                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">
                                    Input: Analysis
                                </Badge>
                            </div>
                        </div>
                        <Textarea
                            className="flex-1 font-mono text-xs leading-relaxed resize-none bg-white p-3"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="Define the writer's personality..."
                        />
                        <p className="text-[10px] text-slate-600">
                            Available variables: <code className="bg-slate-100 px-1 rounded">{`{analysis}`}</code>
                        </p>
                    </div>

                    {/* 4. Test Run */}
                    <div className="pt-2 border-t space-y-2">
                        <Button
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white text-xs h-8"
                            onClick={handleTestRun}
                            disabled={loading}
                        >
                            {loading ? <span className="animate-pulse">Writing...</span> : (
                                <>
                                    <Wand2 className="w-3 h-3 mr-2 fill-white" /> Generate Draft
                                </>
                            )}
                        </Button>

                        {testOutput && (
                            <div className="mt-2 bg-white rounded-md p-3">
                                <Label className="text-[10px] text-slate-600 mb-1 block">Preview Draft</Label>
                                <pre className="text-[11px] text-cyan-400 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                                    {testOutput}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

export default AIPersonaInspector;
