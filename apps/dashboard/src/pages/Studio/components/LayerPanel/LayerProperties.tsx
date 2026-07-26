import React from 'react';
import { Layer } from '../../store/useLofiStudioStore';
import { useLofiStudioStore } from '../../store/useLofiStudioStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, ScanLine, Maximize, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LayerPropertiesProps {
    layer: Layer;
}

export const LayerProperties: React.FC<LayerPropertiesProps> = ({ layer }) => {
    const { updateLayer } = useLofiStudioStore();

    const handleUpdate = (updates: Partial<Layer>) => {
        updateLayer(layer.id, updates);
    };

    const handleFill = (mode: 'width' | 'height') => {
        const canvasW = 1280;
        const canvasH = 720;
        const currentW = layer.width || 100;
        const currentH = layer.height || 100;

        // Original aspect ratio
        const ratio = currentW / currentH;

        let newW, newH;

        if (mode === 'width') {
            newW = canvasW;
            newH = canvasW / ratio;
        } else {
            newH = canvasH;
            newW = canvasH * ratio;
        }

        const newX = (canvasW - newW) / 2;
        const newY = (canvasH - newH) / 2;

        handleUpdate({ x: newX, y: newY, width: newW, height: newH });
    };

    return (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg h-full overflow-y-auto">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">레이어 속성</h3>
            </div>

            {/* Name */}
            <div className="space-y-2">
                <Label htmlFor="layer-name" className="text-xs">이름</Label>
                <Input
                    id="layer-name"
                    value={layer.name}
                    onChange={(e) => handleUpdate({ name: e.target.value })}
                    className="h-8 text-sm"
                />
            </div>

            <Separator />

            {/* Position */}
            <div className="space-y-2">
                <Label className="text-xs font-semibold">위치</Label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor="layer-x" className="text-xs text-gray-500">X</Label>
                        <Input
                            id="layer-x"
                            type="number"
                            value={Math.round(layer.x)}
                            onChange={(e) => handleUpdate({ x: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label htmlFor="layer-y" className="text-xs text-gray-500">Y</Label>
                        <Input
                            id="layer-y"
                            type="number"
                            value={Math.round(layer.y)}
                            onChange={(e) => handleUpdate({ y: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">크기</Label>
                    <div className="flex gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 hover:bg-gray-200"
                                        onClick={() => handleFill('width')}
                                    >
                                        <ArrowLeftRight className="h-3 w-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">가로 채우기</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 hover:bg-gray-200"
                                        onClick={() => handleFill('height')}
                                    >
                                        <ArrowUpDown className="h-3 w-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">세로 채우기</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor="layer-width" className="text-xs text-gray-500">너비</Label>
                        <Input
                            id="layer-width"
                            type="number"
                            value={Math.round(layer.width)}
                            onChange={(e) => handleUpdate({ width: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label htmlFor="layer-height" className="text-xs text-gray-500">높이</Label>
                        <Input
                            id="layer-height"
                            type="number"
                            value={Math.round(layer.height)}
                            onChange={(e) => handleUpdate({ height: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="layer-rotation" className="text-xs font-semibold">회전</Label>
                    <span className="text-xs text-gray-500">{Math.round(layer.rotation)}°</span>
                </div>
                <Slider
                    id="layer-rotation"
                    value={[layer.rotation]}
                    onValueChange={([value]) => handleUpdate({ rotation: value })}
                    min={0}
                    max={360}
                    step={1}
                    className="w-full"
                />
            </div>

            {/* Opacity */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="layer-opacity" className="text-xs font-semibold">투명도</Label>
                    <span className="text-xs text-gray-500">{Math.round(layer.opacity * 100)}%</span>
                </div>
                <Slider
                    id="layer-opacity"
                    value={[layer.opacity * 100]}
                    onValueChange={([value]) => handleUpdate({ opacity: value / 100 })}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                />
            </div>

            {/* Text-specific properties */}
            {layer.type === 'text' && (
                <>
                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="layer-text" className="text-xs font-semibold">텍스트 내용</Label>
                        <Input
                            id="layer-text"
                            value={layer.text || ''}
                            onChange={(e) => handleUpdate({ text: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="텍스트 입력..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="layer-font-size" className="text-xs font-semibold">글자 크기</Label>
                        <Input
                            id="layer-font-size"
                            type="number"
                            value={layer.fontSize || 24}
                            onChange={(e) => handleUpdate({ fontSize: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="layer-font-family" className="text-xs font-semibold">글꼴</Label>
                        <Select
                            value={layer.fontFamily || 'Arial'}
                            onValueChange={(value) => handleUpdate({ fontFamily: value })}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Arial">Arial</SelectItem>
                                <SelectItem value="Helvetica">Helvetica</SelectItem>
                                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                <SelectItem value="Courier New">Courier New</SelectItem>
                                <SelectItem value="Verdana">Verdana</SelectItem>
                                <SelectItem value="Georgia">Georgia</SelectItem>
                                <SelectItem value="Poppins">Poppins</SelectItem>
                                <SelectItem value="Roboto">Roboto</SelectItem>
                                <SelectItem value="Roboto Mono">Roboto Mono</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Font Style & Align */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">스타일</Label>
                            <div className="flex gap-1">
                                <Toggle
                                    size="sm"
                                    variant="outline"
                                    pressed={layer.fontStyle?.includes('bold')}
                                    onPressedChange={(pressed) => {
                                        let current = layer.fontStyle || 'normal';
                                        if (pressed) {
                                            if (current === 'normal') current = 'bold';
                                            else if (!current.includes('bold')) current += ' bold';
                                        } else {
                                            current = current.replace('bold', '').trim();
                                        }
                                        if (!current) current = 'normal';
                                        handleUpdate({ fontStyle: current });
                                    }}
                                    aria-label="Bold"
                                >
                                    <Bold className="h-3 w-3" />
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    variant="outline"
                                    pressed={layer.fontStyle?.includes('italic')}
                                    onPressedChange={(pressed) => {
                                        let current = layer.fontStyle || 'normal';
                                        if (pressed) {
                                            if (current === 'normal') current = 'italic';
                                            else if (!current.includes('italic')) current += ' italic';
                                        } else {
                                            current = current.replace('italic', '').trim();
                                        }
                                        if (!current) current = 'normal';
                                        handleUpdate({ fontStyle: current });
                                    }}
                                    aria-label="Italic"
                                >
                                    <Italic className="h-3 w-3" />
                                </Toggle>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">정렬</Label>
                            <ToggleGroup type="single" value={layer.textAlign || 'left'} onValueChange={(v) => { if (v) handleUpdate({ textAlign: v as any }) }}>
                                <ToggleGroupItem value="left" size="sm" aria-label="Left"><AlignLeft className="h-3 w-3" /></ToggleGroupItem>
                                <ToggleGroupItem value="center" size="sm" aria-label="Center"><AlignCenter className="h-3 w-3" /></ToggleGroupItem>
                                <ToggleGroupItem value="right" size="sm" aria-label="Right"><AlignRight className="h-3 w-3" /></ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="layer-color" className="text-xs font-semibold">색상</Label>
                        <div className="flex gap-2">
                            <Input
                                id="layer-color"
                                type="color"
                                value={layer.fill || '#000000'}
                                onChange={(e) => handleUpdate({ fill: e.target.value })}
                                className="h-8 w-16 p-1"
                            />
                            <Input
                                value={layer.fill || '#000000'}
                                onChange={(e) => handleUpdate({ fill: e.target.value })}
                                className="h-8 flex-1 text-sm"
                                placeholder="#000000"
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Video Propertes */}
            {layer.type === 'video' && (
                <>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">반복 재생</Label>
                        <input
                            type="checkbox"
                            checked={layer.loop}
                            onChange={(e) => handleUpdate({ loop: e.target.checked })}
                            className="toggle"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">음소거</Label>
                        <input
                            type="checkbox"
                            checked={layer.muted}
                            onChange={(e) => handleUpdate({ muted: e.target.checked })}
                            className="toggle"
                        />
                    </div>
                </>
            )}
        </div>
    );
};
