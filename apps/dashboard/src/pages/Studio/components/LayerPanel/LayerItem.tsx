import React, { useState } from 'react';
import { Layer } from '../../store/useLofiStudioStore';
import { Eye, EyeOff, Lock, Unlock, MoreVertical, Copy, Trash2, Edit2, Type, Image as ImageIcon, Video, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface LayerItemProps {
    layer: Layer;
    isSelected: boolean;
    index: number;
    onSelect: () => void;
    onToggleVisibility: () => void;
    onToggleLock: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onRename: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onReorder: (direction: 'up' | 'down') => void;
}

export const LayerItem: React.FC<LayerItemProps> = ({
    layer,
    isSelected,
    index,
    onSelect,
    onToggleVisibility,
    onToggleLock,
    onDuplicate,
    onDelete,
    onRename,
    onDragStart,
    onDragOver,
    onDrop,
    onReorder
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        onDragStart(e);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const getLayerIcon = () => {
        switch (layer.type) {
            case 'text':
                return <Type className="w-4 h-4" />;
            case 'image':
                return <ImageIcon className="w-4 h-4" />;
            case 'video':
                return <Video className="w-4 h-4" />;
            case 'widget':
                return <Sparkles className="w-4 h-4" />;
            default:
                return null;
        }
    };

    const getLayerPreview = () => {
        if (layer.type === 'text' && layer.text) {
            return (
                <div className="text-xs text-gray-600 truncate" style={{ fontFamily: layer.fontFamily }}>
                    {layer.text}
                </div>
            );
        }
        if (layer.type === 'image' && layer.src) {
            return (
                <img
                    src={layer.src}
                    alt={layer.name}
                    className="w-12 h-8 object-cover rounded"
                />
            );
        }
        if (layer.type === 'video') {
            // Removing broken image preview for video as requested
            return null;
        }
        if (layer.type === 'widget' && layer.widgetType) {
            return (
                <div className="text-xs text-purple-600 font-medium">
                    {layer.widgetType}
                </div>
            );
        }
        return null;
    };

    return (
        <div
            draggable={!layer.locked}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'group relative p-2 rounded border transition-all cursor-pointer',
                isSelected && 'bg-blue-50 border-blue-500',
                !isSelected && 'bg-white border-gray-200 hover:border-gray-300',
                isDragging && 'opacity-50',
                layer.locked && 'cursor-not-allowed'
            )}
        >
            <div className="flex items-center gap-2">
                {/* Visibility & Lock Controls */}
                <div className="flex flex-col gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility();
                        }}
                        className={cn(
                            'p-0.5 hover:bg-gray-100 rounded transition-colors',
                            !layer.visible && 'text-slate-600'
                        )}
                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                    >
                        {layer.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                        ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleLock();
                        }}
                        className={cn(
                            'p-0.5 hover:bg-gray-100 rounded transition-colors',
                            layer.locked && 'text-red-500'
                        )}
                        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    >
                        {layer.locked ? (
                            <Lock className="w-3.5 h-3.5" />
                        ) : (
                            <Unlock className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>

                {/* Layer Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                            'flex-shrink-0',
                            isSelected ? 'text-blue-600' : 'text-gray-500'
                        )}>
                            {getLayerIcon()}
                        </div>
                        <span className={cn(
                            'text-sm font-medium truncate',
                            isSelected ? 'text-blue-900' : 'text-gray-900'
                        )}>
                            {layer.name}
                        </span>
                    </div>

                    {/* Preview */}
                    <div className="ml-6">
                        {getLayerPreview()}
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
                                onReorder('up');
                            }}>
                                <ArrowUp className="w-4 h-4 mr-2" />
                                Move Forward
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onReorder('down');
                            }}>
                                <ArrowDown className="w-4 h-4 mr-2" />
                                Move Backward
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onRename();
                            }}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onDuplicate();
                            }}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
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
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Opacity Indicator */}
            {layer.opacity < 1 && (
                <div className="absolute bottom-1 right-1 text-xs text-slate-600">
                    {Math.round(layer.opacity * 100)}%
                </div>
            )}
        </div>
    );
};
