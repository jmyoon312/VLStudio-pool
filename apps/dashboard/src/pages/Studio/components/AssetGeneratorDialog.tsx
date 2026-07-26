import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, Image as ImageIcon, Zap, Star } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';
import { useLofiStudioStore } from '../store/useLofiStudioStore';
import { v4 as uuidv4 } from 'uuid';

interface AssetGeneratorDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AssetGeneratorDialog: React.FC<AssetGeneratorDialogProps> = ({ isOpen, onClose }) => {
    const { toast } = useToast();
    const { addLayer, activeSceneId, scenes, updateScene } = useLofiStudioStore();

    const [prompt, setPrompt] = useState('');
    const [mode, setMode] = useState<'auto' | 'quality'>('auto'); // auto (API), quality (Browser)
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        setGeneratedImage(null);

        try {
            // Call Backend API
            const res = await axios.post('/api/image-gen/generate', {
                prompt,
                mode: mode === 'quality' ? 'quality' : 'fast'
            });

            if (res.data.success && res.data.image_url) {
                setGeneratedImage(res.data.image_url);
                toast({ title: "생성 완료!", description: `Provider: ${res.data.provider}` });
            } else {
                throw new Error(res.data.message || "Unknown error");
            }
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "생성 실패",
                description: e.response?.data?.detail || e.message
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddToScene = (asBackground: boolean) => {
        if (!generatedImage || !activeSceneId) return;

        if (asBackground) {
            updateScene(activeSceneId, { backgroundVideo: generatedImage }); // backgroundVideo field handles images too
            toast({ title: "배경 적용됨" });
        } else {
            addLayer({
                type: 'image',
                name: `AI Image ${Date.now()}`,
                src: generatedImage,
                visible: true,
                locked: false,
                x: 0,
                y: 0,
                width: 500,
                height: 500,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                fontFamily: undefined,
                fontSize: undefined,
                fill: undefined,
                textAlign: undefined,
                text: undefined
            });
            toast({ title: "레이어 추가됨" });
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-600" />
                        AI 에셋 생성기
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>프롬프트 (생성할 이미지 설명)</Label>
                        <Input
                            id="prompt"
                            placeholder="예: Cyberpunk city street at night, neon lights"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            disabled={isGenerating}
                        />
                    </div>

                    <Tabs defaultValue="auto" value={mode} onValueChange={(v) => setMode(v as any)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="auto" className="flex gap-2">
                                <Zap className="w-4 h-4" />
                                Fast (API)
                            </TabsTrigger>
                            <TabsTrigger value="quality" className="flex gap-2">
                                <Star className="w-4 h-4" />
                                Quality (Farm)
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {generatedImage && (
                        <div className="rounded-md border p-2 bg-gray-50 flex flex-col items-center gap-2">
                            <img src={generatedImage} alt="Generated" className="max-h-[200px] object-contain rounded shadow-sm" />
                            <div className="flex gap-2 w-full">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleAddToScene(false)}>
                                    레이어로 추가
                                </Button>
                                <Button size="sm" className="flex-1" onClick={() => handleAddToScene(true)}>
                                    배경으로 설정
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
                        취소
                    </Button>
                    <Button onClick={handleGenerate} disabled={!prompt || isGenerating} className="bg-purple-600 hover:bg-purple-700">
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isGenerating ? "생성 중..." : "생성하기"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
