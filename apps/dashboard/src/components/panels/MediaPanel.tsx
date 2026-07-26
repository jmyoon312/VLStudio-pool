import React, { useRef } from 'react';
import { useEditorStore, TrackType } from '../../hooks/useEditorStore';
import { Video, Upload, FileAudio, Image as ImageIcon, Trash2 } from 'lucide-react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import AudioWaveform from '../AudioWaveform';

const MediaPanel = () => {
    const { addClip, addAsset, removeAsset, assets, tracks } = useEditorStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('/api/editor/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.status === 'success') {
                let type: TrackType = 'video';
                if (file.type.startsWith('audio')) type = 'audio';
                else if (file.type.startsWith('image')) type = 'image';

                const newAsset: any = {
                    id: uuidv4(),
                    type: type,
                    name: file.name,
                    source: res.data.url,
                    path: res.data.path,
                    thumbnail: type === 'video' ? undefined : res.data.url // Simple thumbnail for images
                };
                addAsset(newAsset);
            }
        } catch (err) {
            console.error("Upload failed", err);
            // Fallback
            let type: TrackType = 'video';
            if (file.type.startsWith('audio')) type = 'audio';
            else if (file.type.startsWith('image')) type = 'image';

            const newAsset: any = {
                id: uuidv4(),
                type: type,
                name: file.name,
                source: URL.createObjectURL(file),
                path: file.name
            };
            addAsset(newAsset);
        }
    };

    const handleDragStart = (e: React.DragEvent, asset: any) => {
        e.dataTransfer.setData('application/json', JSON.stringify(asset));
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Hidden Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                accept="video/*,audio/*,image/*"
            />

            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                <Button
                    variant="outline"
                    className="w-full mb-4 gap-2 shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="w-4 h-4" /> 미디어 가져오기
                </Button>
                {assets.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-8 h-8 opacity-20" />
                        <span className="text-xs">미디어를 가져오세요</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {assets.map((asset) => (
                            <div
                                key={asset.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, asset)}
                                className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group cursor-grab active:cursor-grabbing border border-slate-200 hover:border-blue-400 shadow-sm"
                                onDoubleClick={() => {
                                    addClip(null, null, asset.path || null, asset.type, undefined, undefined, undefined, undefined, asset.source);
                                }}
                            >
                                {asset.type === 'video' ? (
                                    <video
                                        src={asset.source}
                                        className="w-full h-full object-cover pointer-events-none"
                                        muted
                                        preload="metadata"
                                    />
                                ) : asset.type === 'image' ? (
                                    <img src={asset.thumbnail || asset.source} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                                        <AudioWaveform src={asset.source} color="#3b82f6" height="60%" />
                                    </div>
                                )}

                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* Type Icon */}
                                <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] p-1 rounded backdrop-blur-sm">
                                    {asset.type === 'video' ? <Video className="w-3 h-3" /> : asset.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <FileAudio className="w-3 h-3" />}
                                </div>

                                {/* Delete Button */}
                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-1 bg-black/50 text-white rounded hover:bg-red-500 transition-colors backdrop-blur-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('정말 삭제하시겠습니까?')) {
                                                removeAsset(asset.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Filename */}
                                <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-[10px] truncate opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                    {asset.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaPanel;
