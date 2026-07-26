import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Globe, Languages } from 'lucide-react';

interface LocalizerInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const LocalizerInspector: React.FC<LocalizerInspectorProps> = ({ node, updateData }) => {
    const [targetLanguages, setTargetLanguages] = useState<string[]>(node.data.targetLanguages || ['en', 'ja']);
    const [translationEngine, setTranslationEngine] = useState(node.data.translationEngine || 'google');
    const [preserveFormatting, setPreserveFormatting] = useState(node.data.preserveFormatting !== false);

    const languages = [
        { code: 'en', name: '영어 (English)' },
        { code: 'ja', name: '일본어 (日本語)' },
        { code: 'zh', name: '중국어 (中文)' },
        { code: 'es', name: '스페인어 (Español)' },
        { code: 'fr', name: '프랑스어 (Français)' },
        { code: 'de', name: '독일어 (Deutsch)' },
        { code: 'vi', name: '베트남어 (Tiếng Việt)' },
        { code: 'th', name: '태국어 (ไทย)' },
    ];

    const addLanguage = (lang: string) => {
        if (!targetLanguages.includes(lang)) {
            setTargetLanguages([...targetLanguages, lang]);
        }
    };

    const removeLanguage = (lang: string) => {
        setTargetLanguages(targetLanguages.filter(l => l !== lang));
    };

    const handleSave = () => {
        updateData({ targetLanguages, translationEngine, preserveFormatting });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>번역 엔진</Label>
                    <Select value={translationEngine} onValueChange={setTranslationEngine}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="google">Google Translate</SelectItem>
                            <SelectItem value="deepl">DeepL</SelectItem>
                            <SelectItem value="papago">Papago</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label>대상 언어</Label>
                        <Badge>{targetLanguages.length}개 언어</Badge>
                    </div>

                    <div className="space-y-2">
                        {targetLanguages.map((lang) => {
                            const langInfo = languages.find(l => l.code === lang);
                            return (
                                <div key={lang} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 border-blue-200">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium">{langInfo?.name || lang}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeLanguage(lang)}
                                        className="h-7 text-red-500"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    <Select onValueChange={addLanguage}>
                        <SelectTrigger className="mt-2">
                            <SelectValue placeholder="언어 추가..." />
                        </SelectTrigger>
                        <SelectContent>
                            {languages
                                .filter(l => !targetLanguages.includes(l.code))
                                .map((lang) => (
                                    <SelectItem key={lang.code} value={lang.code}>
                                        {lang.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-2">
                        <Languages className="w-5 h-5 text-green-600 mt-0.5" />
                        <div className="text-sm text-green-800">
                            <p className="font-semibold">다국어 콘텐츠 생성</p>
                            <p className="text-xs mt-1">
                                선택한 {targetLanguages.length}개 언어로 자동 번역됩니다
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    <Globe className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default LocalizerInspector;
