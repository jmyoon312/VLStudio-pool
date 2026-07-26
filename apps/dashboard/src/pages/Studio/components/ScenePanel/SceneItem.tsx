import React, { useState } from 'react';
import { Scene } from '../../store/useLofiStudioStore';
import { MoreVertical, Copy, Trash2, Edit2, Play, Image as ImageIcon, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface SceneItemProps {
    scene: Scene;
    isActive: boolean;
    index: number;
    isDirectorMode?: boolean; // [NEW]
    onSelect: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onRename: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

export const SceneItem: React.FC<SceneItemProps> = ({
    scene,
    isActive,
    index,
    isDirectorMode = false, // [NEW]
    onSelect,
    onDuplicate,
    onDelete,
    onRename,
    onDragStart,
    onDragOver,
    onDrop,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false); // [NEW] Loading State

    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        onDragStart(e);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const formatDuration = (duration: number | null): string => {
        if (duration === null) return '∞';
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // [NEW] Director Re-Roll Action
    const handleReRoll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!scene.visualPrompt) return;
        setIsGenerating(true);

        try {
            // This requires calling the Backend API directly from here or via Store.
            // For simplicity, let's use fetch/axios directly here or assume a prop function.
            // But we don't have axios imported here.
            // Let's emit an event or better, import axios since we are simple.
            // Actually, best to use a store action, but we didn't add one.
            // Let's import axios dynamically or add it to file imports.
            const axios = (await import('axios')).default;
            const res = await axios.post('/api/image-gen/generate', {
                prompt: scene.visualPrompt,
                mode: 'fast' // Director mode Re-Roll uses fast initially
            });

            if (res.data.success && res.data.image_url) {
                // We need to update the scene. But we don't have updateScene passed here.
                // ScenePanel passes functions? No, it uses store directly.
                // SceneItem doesn't receive updateScene.
                // We should assume the parent handles updates or we use store here.
                // Let's use useLofiStudioStore here to get updateScene.
                const { updateScene } = (await import('../../store/useLofiStudioStore')).useLofiStudioStore.getState();

                updateScene(scene.id, {
                    backgroundVideo: res.data.image_url,
                    generatedAssetPath: res.data.image_url
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    // Director View Render
    if (isDirectorMode) {
        return (
            <div
                onClick={onSelect}
                className={cn(
                    'group relative p-3 rounded-lg border transition-all cursor-pointer flex gap-3 items-start',
                    isActive ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
                )}
            >
                {/* 1. Thumbnail / Asset Status */}
                <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded overflow-hidden relative border border-gray-300">
                    {scene.backgroundVideo || scene.thumbnail ? (
                        <img
                            src={scene.backgroundVideo || scene.thumbnail}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-700">
                            <ImageIcon className="w-8 h-8" />
                        </div>
                    )}
                    {isGenerating && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-white animate-spin" />
                        </div>
                    )}
                </div>

                {/* 2. Director Controls & Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-gray-700">#{index + 1} {scene.name}</span>
                        <div className="flex gap-1">
                            <button onClick={handleReRoll} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Re-Generate Image">
                                <Layers className="w-4 h-4" /> {/* Reroll Icon substitute */}
                            </button>
                        </div>
                    </div>

                    {/* Script & Visual Prompt Preview */}
                    <div className="text-[10px] text-gray-600 bg-gray-50 p-1 rounded border">
                        <p className="font-semibold text-gray-800">Script:</p>
                        <p className="line-clamp-2 italic">{scene.script || "(No script)"}</p>
                    </div>

                    <div className="text-[10px] text-gray-500 bg-gray-50 p-1 rounded border">
                        <p className="font-semibold text-gray-800">Visual:</p>
                        <p className="line-clamp-2">{scene.visualPrompt || "(No visual prompt)"}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'group relative p-3 rounded-lg border transition-all cursor-pointer',
                isActive && 'bg-blue-50 border-blue-500 shadow-sm',
                !isActive && 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm',
                isDragging && 'opacity-50'
            )}
        >
            {/* Active Indicator */}
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    {isActive ? (
                        <Play className="w-4 h-4 text-blue-600 fill-blue-600" />
                    ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                </div>

                {/* Scene Info */}
                <div className="flex-1 min-w-0">
                    {/* Name & Index */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-500">
                            {index + 1}.
                        </span>
                        <h4 className={cn(
                            'text-sm font-semibold truncate',
                            isActive ? 'text-blue-900' : 'text-gray-900'
                        )}>
                            {scene.name}
                        </h4>
                    </div>

                    {/* Thumbnail */}
                    {scene.thumbnail ? (
                        <div className="mb-2 rounded overflow-hidden bg-gray-100 aspect-video">
                            <img
                                src={scene.thumbnail}
                                alt={scene.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="mb-2 rounded bg-gray-100 aspect-video flex flex-col items-center justify-center gap-1 text-slate-700">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(scene.duration)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <span>{scene.layers.length} 레이어</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className={cn(
                    'flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                    isHovered && 'opacity-100'
                )}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <MoreVertical className="w-4 h-4 text-gray-500" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onRename();
                            }}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                이름 변경
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onDuplicate();
                            }}>
                                <Copy className="w-4 h-4 mr-2" />
                                복제
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="text-red-600"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
};
