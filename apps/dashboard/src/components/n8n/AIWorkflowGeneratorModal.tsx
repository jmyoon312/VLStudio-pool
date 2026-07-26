import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AIModelSelector from "../shared/AIModelSelector";

export function AIWorkflowGeneratorModal() {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // [NEW] Model Selection State
    const [provider, setProvider] = useState("google");
    const [model, setModel] = useState("gemini-1.5-pro");


    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/integration/n8n/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt,
                    save: true,
                    provider: provider,
                    model: model
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Generation failed");
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openN8n = () => {
        if (result?.saved_workflow?.id) {
            window.open(`http://localhost:5678/workflow/${result.saved_workflow.id}`, '_blank');
        } else {
            window.open('http://localhost:5678', '_blank');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg border-0">
                    <Sparkles className="w-4 h-4" /> AI 워크플로우 생성
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Natural Language Workflow Generator
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!result ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                필요한 워크플로우를 자연어로 설명하세요. AI가 n8n 구조를 설계하고 생성합니다.
                            </p>

                            {/* [NEW] Model Selector */}
                            <div className="bg-slate-50 p-3 rounded-md border">
                                <AIModelSelector
                                    provider={provider}
                                    onProviderChange={setProvider}
                                    model={model}
                                    onModelChange={setModel}
                                    compact={true}
                                />
                            </div>

                            <Textarea
                                placeholder="예: 매일 아침 9시에 비트코인 가격을 조회해서 텔레그램으로 보내줘."
                                className="min-h-[150px] text-base p-4 resize-none"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center space-y-4 py-6 animate-in fade-in zoom-in duration-300">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-center">워크플로우 생성 완료!</h3>
                            <p className="text-sm text-center text-muted-foreground max-w-[80%]">
                                "{result.saved_workflow?.name}" 워크플로우가 n8n이 저장되었습니다.<br />
                                ID: <code className="bg-muted px-1 rounded">{result.saved_workflow?.id}</code>
                            </p>

                            <div className="bg-slate-50 p-3 rounded-md w-full max-h-[150px] overflow-auto text-xs font-mono border">
                                {JSON.stringify(result.generated_json, null, 2)}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    {!result ? (
                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                        >
                            {loading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 생성 중...</>
                            ) : (
                                "워크플로우 생성하기"
                            )}
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => { setResult(null); setPrompt(""); }}>
                                다시 생성
                            </Button>
                            <Button className="gap-2" onClick={openN8n}>
                                <ExternalLink className="w-4 h-4" /> n8n 에디터에서 열기
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
