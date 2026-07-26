import React from 'react';
import { useEditorStore } from '../../hooks/useEditorStore';
import { Smile } from 'lucide-react';

const StickerPanel = () => {
    const { addClip } = useEditorStore();

    // Mock stickers
    const stickers = [
        { id: 'st1', url: '/assets/stickers/smile.png', label: 'Smile' },
        { id: 'st2', url: '/assets/stickers/heart.png', label: 'Heart' },
        { id: 'st3', url: '/assets/stickers/fire.png', label: 'Fire' },
        { id: 'st4', url: '/assets/stickers/thumbsup.png', label: 'Like' },
    ];

    return (
        <div className="h-full p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">스티커</h3>
            <div className="grid grid-cols-3 gap-3">
                {stickers.map(sticker => (
                    <button
                        key={sticker.id}
                        className="aspect-square rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-all flex items-center justify-center p-2"
                        onClick={() => addClip('overlay-1', null, sticker.url, 'image')} // Treating stickers as images for now
                    >
                        {/* Placeholder for actual image */}
                        <div className="w-full h-full bg-slate-100 rounded-md flex items-center justify-center text-2xl">
                            {sticker.label === 'Smile' && '😊'}
                            {sticker.label === 'Heart' && '❤️'}
                            {sticker.label === 'Fire' && '🔥'}
                            {sticker.label === 'Like' && '👍'}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StickerPanel;
