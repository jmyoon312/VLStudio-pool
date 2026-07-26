import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Languages, Globe2 } from 'lucide-react';

const LocalizerNode = ({ data, selected }: NodeProps) => {
    // Default languages if not in data
    const [selectedLangs, setSelectedLangs] = useState<string[]>(data.targetLanguages || ['JP', 'EN']);

    const availableLangs = [
        { id: 'JP', label: 'Japanese (JP)' },
        { id: 'EN', label: 'English (EN)' },
        { id: 'ES', label: 'Spanish (ES)' },
        { id: 'CN', label: 'Chinese (CN)' },
        { id: 'KR', label: 'Korean (KR)' }
    ];

    const toggleLang = (id: string) => {
        setSelectedLangs(prev => {
            const next = prev.includes(id)
                ? prev.filter(l => l !== id)
                : [...prev, id];
            // Update node data (in a real app, use useReactFlow to update node data)
            data.targetLanguages = next;
            return next;
        });
    };

    return (
        <Card className={`w-[280px] border-2 ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-indigo-200'}`}>
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500" />

            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center text-indigo-700">
                        <Globe2 className="w-4 h-4 mr-2" />
                        {data.label || 'Global Localizer'}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-white/50 text-xs">
                        {selectedLangs.length} Selected
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Target Languages</p>
                    <div className="grid grid-cols-2 gap-2">
                        {availableLangs.map(lang => (
                            <div key={lang.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`lang-${lang.id}`}
                                    checked={selectedLangs.includes(lang.id)}
                                    onCheckedChange={() => toggleLang(lang.id)}
                                />
                                <label
                                    htmlFor={`lang-${lang.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {lang.id}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                    Generating localized script & metadata for selected markets.
                </div>
            </CardContent>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500" />
        </Card>
    );
};

export default memo(LocalizerNode);
