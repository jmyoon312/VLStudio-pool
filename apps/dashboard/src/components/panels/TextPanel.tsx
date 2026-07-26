import React from 'react';
import { useEditorStore } from '../../hooks/useEditorStore';
import { Type } from 'lucide-react';

const TextPanel = () => {
    const { addClip } = useEditorStore();

    const presets = [
        {
            id: 'default',
            label: '기본 텍스트',
            style: {
                fontFamily: 'Inter',
                fontSize: 60,
                color: '#ffffff',
                shadow: { blur: 2, color: '#000000', offset: 2 }
            }
        },
        {
            id: 'title',
            label: '제목',
            style: {
                fontFamily: 'Do Hyeon',
                fontSize: 100,
                color: '#fbbf24',
                stroke: { width: 2, color: '#000000' },
                shadow: { blur: 4, color: '#000000', offset: 4 }
            }
        },
        {
            id: 'subtitle',
            label: '자막',
            style: {
                fontFamily: 'Nanum Gothic',
                fontSize: 40,
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.5)',
            }
        },
        {
            id: 'neon',
            label: '네온',
            style: {
                fontFamily: 'Courier New',
                fontSize: 70,
                color: '#a855f7',
                shadow: { blur: 10, color: '#d8b4fe', offset: 0 },
                stroke: { width: 1, color: '#ffffff' }
            }
        },
    ];

    const handleAddText = (preset: any) => {
        addClip(null, null, null, 'text', undefined, undefined, preset.label, preset.style);
    };

    return (
        <div className="h-full p-4 overflow-y-auto space-y-6">
            <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-4">Text Presets</h3>
                <div className="grid grid-cols-2 gap-3">
                    {presets.map(preset => (
                        <button
                            key={preset.id}
                            className="aspect-square rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group"
                            onClick={() => handleAddText(preset)}
                        >
                            <Type className="w-8 h-8 text-slate-600 group-hover:text-blue-500" />
                            <span className="text-xs font-medium text-slate-600 group-hover:text-blue-600">{preset.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TextPanel;
