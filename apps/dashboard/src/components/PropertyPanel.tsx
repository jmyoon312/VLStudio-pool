import React, { useState, useEffect } from 'react';
import { useEditorStore, Clip } from '../hooks/useEditorStore';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    AlignLeft, AlignCenter, AlignRight,
    Bold, Italic, Type, Palette,
    Move, Maximize, RotateCw, Layers,
    Sun, Contrast, Droplet, Aperture,
    Volume2, VolumeX, Mic, Sparkles,
    Gauge, Wand2, Diamond, Pipette
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PropertyPanel = () => {
    const {
        selectedClipId, tracks, updateClip, currentTime,
        availableFonts, fetchAvailableFonts,
        applyToAllCaptions, setCaptionConfig, captionConfig,
        aspectRatio
    } = useEditorStore();

    useEffect(() => {
        fetchAvailableFonts();
    }, []);

    // Find the selected clip
    const selectedTrack = tracks.find(t => t.clips.some(c => c.id === selectedClipId));
    const selectedClip = selectedTrack?.clips.find(c => c.id === selectedClipId);

    if (!selectedClip || !selectedTrack) {
        return (
            <div className="h-full flex items-center justify-center text-slate-600">
                <div className="text-center">
                    <p>클립을 선택하여 속성을 편집하세요</p>
                </div>
            </div>
        );
    }

    const handleUpdate = (updates: Partial<Clip>) => {
        if (selectedTrack && selectedClip) {
            updateClip(selectedTrack.id, selectedClip.id, updates);
        }
    };

    const handleStyleUpdate = (updates: Partial<Clip['style']> & { position?: 'top' | 'middle' | 'bottom' }) => {
        // If "Apply to All" is checked and this is a caption clip, update global config
        const isCaption = (selectedTrack.type === 'text' && selectedTrack.label === '자막') || selectedTrack.type === 'caption';

        if (isCaption && applyToAllCaptions) {
            // Map ClipStyle updates to SubtitleConfig keys where possible
            const configUpdates: any = {};
            if (updates.fontFamily) configUpdates.font = updates.fontFamily;
            if (updates.fontSize) configUpdates.fontSize = updates.fontSize;
            if (updates.color) configUpdates.textColor = updates.color;
            if (updates.backgroundColor) {
                configUpdates.useBox = updates.backgroundColor !== 'transparent';
                configUpdates.boxColor = updates.backgroundColor === 'transparent' ? '#000000' : updates.backgroundColor;
            }
            if (updates.stroke?.color) configUpdates.outlineColor = updates.stroke.color;
            if (updates.stroke?.width !== undefined) configUpdates.outlineSize = updates.stroke.width;
            if (updates.shadow?.color) configUpdates.shadowColor = updates.shadow.color;
            if (updates.shadow?.blur !== undefined) configUpdates.shadowSize = updates.shadow.blur;
            if (updates.fontWeight) configUpdates.isBold = updates.fontWeight === 'bold';
            if (updates.fontStyle) configUpdates.isItalic = updates.fontStyle === 'italic';

            // Animations
            if (updates.animationEntrance) configUpdates.animationEntrance = updates.animationEntrance;
            if (updates.animationExit) configUpdates.animationExit = updates.animationExit;
            if (updates.animationEmphasis) configUpdates.animationEmphasis = updates.animationEmphasis;

            // Vertical Margin
            if (updates.marginV !== undefined) configUpdates.marginV = updates.marginV;

            // Handle Position Preset Update
            if (updates.position) {
                configUpdates.position = updates.position;
            }

            setCaptionConfig(configUpdates);
        } else {
            // Local Update
            const styleUpdates = { ...updates };
            const positionPreset = updates.position || selectedClip.style.positionPreset;

            // If updating position or margin, we might need to update reset Y
            if (updates.position || updates.marginV !== undefined) {
                const marginV = updates.marginV !== undefined ? updates.marginV : (selectedClip.style.marginV || 50);
                let newY = selectedClip.transform.y;

                // Pixel-based coordinates
                const stageH = aspectRatio === '9:16' ? 1920 : 1080;
                const h = selectedClip.transform.height || 100;

                if (updates.position === 'top' || (positionPreset === 'top' && updates.marginV !== undefined)) {
                    newY = marginV + 100;
                } else if (updates.position === 'middle' || (positionPreset === 'middle' && updates.marginV !== undefined)) {
                    newY = (stageH - h) / 2;
                } else if (updates.position === 'bottom' || (positionPreset === 'bottom' && updates.marginV !== undefined)) {
                    newY = stageH - h - marginV - 100;
                }

                // If explicit position update, save the preset
                if (updates.position) {
                    styleUpdates.positionPreset = updates.position;
                }
                delete styleUpdates.position; // Remove helper prop

                handleUpdate({
                    style: { ...selectedClip.style, ...styleUpdates },
                    transform: { ...selectedClip.transform, y: newY }
                });
            } else {
                // Check for position prop removal just in case
                delete styleUpdates.position;
                handleUpdate({ style: { ...selectedClip.style, ...styleUpdates } });
            }
        }
    };

    const handleTransformUpdate = (updates: Partial<Clip['transform']>) => {
        handleUpdate({ transform: { ...selectedClip.transform, ...updates } });
    };

    const handleFilterUpdate = (updates: Partial<Clip['filter']>) => {
        handleUpdate({ filter: { ...selectedClip.filter, ...updates } });
    };

    const handleAudioUpdate = (updates: Partial<Clip['audio']>) => {
        handleUpdate({ audio: { ...selectedClip.audio, ...updates } });
    };

    const handleSpeedUpdate = (speed: number) => {
        handleUpdate({ speed });
    };

    const handleChromaKeyUpdate = (updates: Partial<NonNullable<Clip['chromakey']>>) => {
        handleUpdate({
            chromakey: {
                enabled: false,
                color: '#00FF00',
                similarity: 0.1,
                blend: 0.1,
                ...selectedClip.chromakey,
                ...updates
            }
        });
    };

    const addKeyframe = (property: string) => {
        // Placeholder for keyframe logic
        console.log(`Add keyframe for ${property} at ${currentTime}`);
        // In a real implementation, we'd add to selectedClip.keyframes
    };

    // Helper for Keyframe Button
    const KeyframeBtn = ({ property }: { property: string }) => (
        <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-1 text-slate-600 hover:text-blue-500"
            onClick={() => addKeyframe(property)}
            title="Add Keyframe"
        >
            <Diamond className="w-3 h-3" />
        </Button>
    );

    return (
        <div className="pb-10">
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                    {selectedClip.type === 'video' && <div className="w-4 h-4 rounded bg-blue-500" />}
                    {selectedClip.type === 'image' && <div className="w-4 h-4 rounded bg-purple-500" />}
                    {selectedClip.type === 'text' && <div className="w-4 h-4 rounded bg-orange-500" />}
                    {selectedClip.type === 'audio' && <div className="w-4 h-4 rounded bg-green-500" />}
                    <h2 className="font-semibold text-slate-800 truncate">{selectedClip.name}</h2>
                </div>
                <div className="flex gap-4 text-xs text-slate-600 font-mono">
                    <span>{selectedClip.id.slice(0, 8)}</span>
                    <span>{selectedClip.duration.toFixed(1)}s</span>
                </div>
            </div>

            <div className="p-4 space-y-6">

                {/* Speed Control (Video/Audio) */}
                {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 font-semibold text-sm text-slate-700 mb-4">
                            <Gauge className="w-4 h-4" /> 속도 (Speed)
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs text-slate-500">재생 속도</Label>
                                <div className="flex items-center gap-2 flex-1 mx-4">
                                    <Slider
                                        value={[selectedClip.speed]}
                                        min={0.1} max={5} step={0.1}
                                        onValueChange={(v) => handleSpeedUpdate(v[0])}
                                        className="flex-1"
                                    />
                                </div>
                                <span className="text-xs text-slate-600 w-8 text-right">{selectedClip.speed.toFixed(1)}x</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 px-1">
                                <span>0.1x</span>
                                <span>1x</span>
                                <span>5x</span>
                            </div>
                            <Button variant="outline" size="sm" className="w-full text-xs h-7">
                                <Sparkles className="w-3 h-3 mr-2" />
                                오디오에 스마트 싱크
                            </Button>
                        </div>
                    </div>
                )}

                <Accordion type="multiple" defaultValue={['style', 'transform', 'adjust', 'audio', 'chromakey']} className="space-y-4">

                    {/* Text Style Section */}
                    {(selectedClip.type === 'text' || selectedClip.type === 'caption') && (
                        <AccordionItem value="style" className="border rounded-lg px-3">
                            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                                <span className="flex items-center gap-2"><Type className="w-4 h-4" /> 스타일 (Style)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">내용</Label>
                                    <textarea
                                        value={selectedClip.content || ''}
                                        onChange={(e) => handleUpdate({ content: e.target.value })}
                                        className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">폰트</Label>
                                        <Select
                                            value={selectedClip.style.fontFamily}
                                            onValueChange={(v) => handleStyleUpdate({ fontFamily: v })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Font" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(availableFonts).map(([category, fonts]) => (
                                                    <React.Fragment key={category}>
                                                        {Object.keys(availableFonts).length > 1 && (
                                                            <div className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-50">
                                                                {category}
                                                            </div>
                                                        )}
                                                        {fonts.map((font) => (
                                                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                                                                {font}
                                                            </SelectItem>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                                {/* Fallback if empty */}
                                                {Object.keys(availableFonts).length === 0 && (
                                                    <>
                                                        <SelectItem value="Arial">Arial</SelectItem>
                                                        <SelectItem value="Malgun Gothic">맑은 고딕</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">크기</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={selectedClip.style.fontSize}
                                                onChange={(e) => handleStyleUpdate({ fontSize: Number(e.target.value) })}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 p-1 bg-slate-50 rounded border border-slate-100">
                                    <div className="flex gap-1">
                                        <Button
                                            variant={selectedClip.style.fontWeight === 'bold' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleStyleUpdate({ fontWeight: selectedClip.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                        >
                                            <Bold className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant={selectedClip.style.fontStyle === 'italic' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleStyleUpdate({ fontStyle: selectedClip.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                        >
                                            <Italic className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="w-px h-4 bg-slate-200" />
                                    <div className="flex gap-1">
                                        <Button
                                            variant={selectedClip.style.textAlign === 'left' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleStyleUpdate({ textAlign: 'left' })}
                                        >
                                            <AlignLeft className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant={selectedClip.style.textAlign === 'center' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleStyleUpdate({ textAlign: 'center' })}
                                        >
                                            <AlignCenter className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            variant={selectedClip.style.textAlign === 'right' ? 'secondary' : 'ghost'}
                                            size="icon" className="h-7 w-7"
                                            onClick={() => handleStyleUpdate({ textAlign: 'right' })}
                                        >
                                            <AlignRight className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">자간 (Letter Spacing)</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={selectedClip.style.letterSpacing || 0}
                                                onChange={(e) => handleStyleUpdate({ letterSpacing: Number(e.target.value) })}
                                                className="h-7 text-xs"
                                            />
                                            <span className="text-xs text-slate-600">px</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">행간 (Line Height)</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number" step="0.1"
                                                value={selectedClip.style.lineHeight || 1.2}
                                                onChange={(e) => handleStyleUpdate({ lineHeight: Number(e.target.value) })}
                                                className="h-7 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">색상</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded border border-slate-200 overflow-hidden shrink-0">
                                                <input
                                                    type="color"
                                                    value={selectedClip.style.color}
                                                    onChange={(e) => handleStyleUpdate({ color: e.target.value })}
                                                    className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                />
                                            </div>
                                            <Input
                                                value={selectedClip.style.color}
                                                onChange={(e) => handleStyleUpdate({ color: e.target.value })}
                                                className="h-7 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">배경 (Box)</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded border border-slate-200 overflow-hidden shrink-0">
                                                <input
                                                    type="color"
                                                    value={selectedClip.style.backgroundColor === 'transparent' ? '#000000' : selectedClip.style.backgroundColor}
                                                    onChange={(e) => handleStyleUpdate({ backgroundColor: e.target.value })}
                                                    className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <Slider
                                                    value={selectedClip.style.backgroundColor === 'transparent' ? [0] : [0.5]} // Should derive from actual alpha channel ideally, simplifying for now
                                                    min={0} max={1} step={0.1}
                                                    onValueChange={(v) => {
                                                        const color = selectedClip.style.backgroundColor === 'transparent' ? '#000000' : selectedClip.style.backgroundColor;
                                                        // This is a simplification; in a real app we'd parse the Hex/RGBA.
                                                        // For now, let's assume if user drags slider they want a box. 
                                                        // If v=0, transparent.
                                                        if (v[0] === 0) handleStyleUpdate({ backgroundColor: 'transparent' });
                                                        else handleStyleUpdate({ backgroundColor: color }); // In reality need to handle opacity mixing
                                                    }}
                                                    className="w-20"
                                                />
                                            </div>
                                            <span className="text-xs text-slate-600 font-mono">
                                                {selectedClip.style.backgroundColor === 'transparent' ? 'Off' : 'On'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Caption Position Presets (Sync with Editor) */}
                                {(selectedClip.type === 'text' && selectedTrack.label === '자막') && (
                                    <div className="space-y-4 pt-2 border-t border-slate-100">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-500">자막 위치 (Position)</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleStyleUpdate({ position: 'top' } as any)}>상단</Button>
                                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleStyleUpdate({ position: 'middle' } as any)}>중앙</Button>
                                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleStyleUpdate({ position: 'bottom' } as any)}>하단</Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-500">수직 여백 (Vertical Margin)</Label>
                                            <div className="flex items-center gap-2">
                                                <Slider
                                                    value={[selectedClip.style.marginV || 50]}
                                                    min={0} max={500} step={10}
                                                    onValueChange={(v) => handleStyleUpdate({ marginV: v[0] } as any)} // Cast as any because marginV is new
                                                />
                                                <span className="text-xs text-slate-600 w-8">{selectedClip.style.marginV || 50}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">테두리 (Outline)</Label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded border border-slate-200 overflow-hidden shrink-0">
                                                <input
                                                    type="color"
                                                    value={selectedClip.style.stroke?.color || '#000000'}
                                                    onChange={(e) => handleStyleUpdate({ stroke: { ...(selectedClip.style.stroke || { width: 0 }), color: e.target.value } })}
                                                    className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                />
                                            </div>
                                            <Input
                                                type="color"
                                                value={selectedClip.style.stroke?.color || '#000000'}
                                                onChange={(e) => handleStyleUpdate({ stroke: { ...(selectedClip.style.stroke || { width: 0 }), color: e.target.value } })}
                                                className="h-7 text-xs w-full p-0 border-0 opacity-0 absolute w-0 h-0"
                                            />
                                        </div>
                                        <Slider
                                            value={[selectedClip.style.stroke?.width || 0]}
                                            max={20} step={1}
                                            onValueChange={(v) => handleStyleUpdate({ stroke: { ...(selectedClip.style.stroke || { color: '#000000' }), width: v[0] } })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">그림자 (Shadow)</Label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded border border-slate-200 overflow-hidden shrink-0">
                                                <input
                                                    type="color"
                                                    value={selectedClip.style.shadow?.color || '#000000'}
                                                    onChange={(e) => handleStyleUpdate({ shadow: { ...(selectedClip.style.shadow || { blur: 0, offset: 0 }), color: e.target.value } })}
                                                    className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <Slider
                                            value={[selectedClip.style.shadow?.blur || 0]}
                                            max={20} step={1}
                                            onValueChange={(v) => handleStyleUpdate({ shadow: { ...(selectedClip.style.shadow || { color: '#000000', offset: 0 }), blur: v[0] } })}
                                        />
                                    </div>
                                </div>

                                {/* Apply to All Toggle inside Property Panel */}
                                {(selectedClip.type === 'text' && selectedTrack.label === '자막') && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <Label className="text-xs text-slate-600">전체 자막에 적용</Label>
                                        <Switch
                                            checked={applyToAllCaptions}
                                            onCheckedChange={(c) => useEditorStore.getState().setApplyToAllCaptions(c)}
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <Label className="text-xs text-slate-500">블렌드 모드 (Blend Mode)</Label>
                                    <Select
                                        value={selectedClip.style.blendMode || 'normal'}
                                        onValueChange={(v) => handleStyleUpdate({ blendMode: v })}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Blend Mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="multiply">Multiply</SelectItem>
                                            <SelectItem value="screen">Screen</SelectItem>
                                            <SelectItem value="overlay">Overlay</SelectItem>
                                            <SelectItem value="darken">Darken</SelectItem>
                                            <SelectItem value="lighten">Lighten</SelectItem>
                                            <SelectItem value="color-dodge">Color Dodge</SelectItem>
                                            <SelectItem value="color-burn">Color Burn</SelectItem>
                                            <SelectItem value="hard-light">Hard Light</SelectItem>
                                            <SelectItem value="soft-light">Soft Light</SelectItem>
                                            <SelectItem value="difference">Difference</SelectItem>
                                            <SelectItem value="exclusion">Exclusion</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <Label className="text-xs font-semibold text-slate-700">애니메이션 (Animation)</Label>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-green-600">등장 (Entrance)</Label>
                                        <Select
                                            value={selectedClip.style.animationEntrance || 'none'}
                                            onValueChange={(v) => handleStyleUpdate({ animationEntrance: v } as any)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="None" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">없음</SelectItem>
                                                <SelectItem value="fade">페이드 인</SelectItem>
                                                <SelectItem value="pop_up">팝업</SelectItem>
                                                <SelectItem value="elastic_pop">탄성 팝업</SelectItem>
                                                <SelectItem value="slide_up">위로 슬라이드</SelectItem>
                                                <SelectItem value="slide_down">아래로 슬라이드</SelectItem>
                                                <SelectItem value="typewriter">타자기</SelectItem>
                                                <SelectItem value="blur_in">블러 인</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-red-600">퇴장 (Exit)</Label>
                                        <Select
                                            value={selectedClip.style.animationExit || 'none'}
                                            onValueChange={(v) => handleStyleUpdate({ animationExit: v } as any)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="None" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">없음</SelectItem>
                                                <SelectItem value="fade_out">페이드 아웃</SelectItem>
                                                <SelectItem value="zoom_out">줌 아웃</SelectItem>
                                                <SelectItem value="slide_out_down">아래로 슬라이드 아웃</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-blue-600">강조 (Emphasis)</Label>
                                        <Select
                                            value={selectedClip.style.animationEmphasis || 'none'}
                                            onValueChange={(v) => handleStyleUpdate({ animationEmphasis: v } as any)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="None" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">없음</SelectItem>
                                                <SelectItem value="pulse">펄스</SelectItem>
                                                <SelectItem value="shake">쉐이크</SelectItem>
                                                <SelectItem value="flip_x">가로 회전</SelectItem>
                                                <SelectItem value="neon">네온</SelectItem>
                                                <SelectItem value="bounce">바운스</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {/* Transform Section */}
                    {['video', 'image', 'text', 'caption', 'sticker'].includes(selectedClip.type) && (
                        <AccordionItem value="transform" className="border rounded-lg px-3">
                            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                                <span className="flex items-center gap-2"><Move className="w-4 h-4" /> 변형 (Transform)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 flex items-center">X <KeyframeBtn property="x" /></Label>
                                        <Input
                                            type="number"
                                            value={Math.round(selectedClip.transform.x)}
                                            onChange={(e) => handleTransformUpdate({ x: Number(e.target.value) })}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 flex items-center">Y <KeyframeBtn property="y" /></Label>
                                        <Input
                                            type="number"
                                            value={Math.round(selectedClip.transform.y)}
                                            onChange={(e) => handleTransformUpdate({ y: Number(e.target.value) })}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center">크기 (Scale) <KeyframeBtn property="scale" /></Label>
                                            <span className="text-[10px] text-slate-600">{Math.round(selectedClip.transform.scale * 100)}%</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.transform.scale]}
                                            min={0.1} max={3} step={0.1}
                                            onValueChange={(v) => handleTransformUpdate({ scale: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center">회전 <KeyframeBtn property="rotation" /></Label>
                                            <span className="text-[10px] text-slate-600">{Math.round(selectedClip.transform.rotation)}°</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.transform.rotation]}
                                            min={0} max={360} step={1}
                                            onValueChange={(v) => handleTransformUpdate({ rotation: v[0] })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-xs text-slate-500 flex items-center">불투명도 <KeyframeBtn property="opacity" /></Label>
                                        <span className="text-[10px] text-slate-600">{Math.round(selectedClip.transform.opacity * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[selectedClip.transform.opacity]}
                                        min={0} max={1} step={0.01}
                                        onValueChange={(v) => handleTransformUpdate({ opacity: v[0] })}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {/* Chroma Key Section (Pro Feature) */}
                    {selectedClip.type === 'video' && (
                        <AccordionItem value="chromakey" className="border rounded-lg px-3">
                            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                                <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> 크로마키 (Chroma Key)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-slate-500">활성화</Label>
                                    <Switch
                                        checked={selectedClip.chromakey?.enabled || false}
                                        onCheckedChange={(c) => handleChromaKeyUpdate({ enabled: c })}
                                    />
                                </div>
                                {selectedClip.chromakey?.enabled && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-500 flex items-center gap-2"><Pipette className="w-3 h-3" /> 제거할 색상</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden shrink-0">
                                                    <input
                                                        type="color"
                                                        value={selectedClip.chromakey?.color || '#00FF00'}
                                                        onChange={(e) => handleChromaKeyUpdate({ color: e.target.value })}
                                                        className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                    />
                                                </div>
                                                <Input
                                                    value={selectedClip.chromakey?.color || '#00FF00'}
                                                    onChange={(e) => handleChromaKeyUpdate({ color: e.target.value })}
                                                    className="h-8 text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-slate-500">유사도 (Similarity)</Label>
                                                <span className="text-[10px] text-slate-600">{((selectedClip.chromakey?.similarity || 0.1) * 100).toFixed(0)}%</span>
                                            </div>
                                            <Slider
                                                value={[selectedClip.chromakey?.similarity || 0.1]}
                                                min={0.01} max={1.0} step={0.01}
                                                onValueChange={(v) => handleChromaKeyUpdate({ similarity: v[0] })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-slate-500">블렌드 (Blend)</Label>
                                                <span className="text-[10px] text-slate-600">{((selectedClip.chromakey?.blend || 0.1) * 100).toFixed(0)}%</span>
                                            </div>
                                            <Slider
                                                value={[selectedClip.chromakey?.blend || 0.1]}
                                                min={0.0} max={1.0} step={0.01}
                                                onValueChange={(v) => handleChromaKeyUpdate({ blend: v[0] })}
                                            />
                                        </div>
                                    </>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {/* Adjust Section */}
                    {['video', 'image'].includes(selectedClip.type) && (
                        <AccordionItem value="adjust" className="border rounded-lg px-3">
                            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                                <span className="flex items-center gap-2"><Sun className="w-4 h-4" /> 보정 (Adjust)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-4">
                                <Button variant="outline" size="sm" className="w-full text-xs h-7 mb-2">
                                    <Wand2 className="w-3 h-3 mr-2 text-purple-500" /> 자동 보정
                                </Button>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center gap-1"><Sun className="w-3 h-3" /> 밝기</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.filter.brightness.toFixed(2)}</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.filter.brightness]}
                                            min={0} max={2} step={0.05}
                                            onValueChange={(v) => handleFilterUpdate({ brightness: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center gap-1"><Contrast className="w-3 h-3" /> 대비</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.filter.contrast.toFixed(2)}</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.filter.contrast]}
                                            min={0} max={2} step={0.05}
                                            onValueChange={(v) => handleFilterUpdate({ contrast: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center gap-1"><Droplet className="w-3 h-3" /> 채도</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.filter.saturation.toFixed(2)}</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.filter.saturation]}
                                            min={0} max={2} step={0.05}
                                            onValueChange={(v) => handleFilterUpdate({ saturation: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500 flex items-center gap-1"><Palette className="w-3 h-3" /> 색조</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.filter.hue}°</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.filter.hue]}
                                            min={0} max={360} step={10}
                                            onValueChange={(v) => handleFilterUpdate({ hue: v[0] })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between">
                                        <Label className="text-xs text-slate-500 flex items-center gap-1"><Aperture className="w-3 h-3" /> 흐림 (Blur)</Label>
                                        <span className="text-[10px] text-slate-600">{selectedClip.filter.blur}px</span>
                                    </div>
                                    <Slider
                                        value={[selectedClip.filter.blur]}
                                        min={0} max={20} step={1}
                                        onValueChange={(v) => handleFilterUpdate({ blur: v[0] })}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {/* Audio Section */}
                    {(selectedClip.type === 'audio' || selectedClip.type === 'video') && (
                        <AccordionItem value="audio" className="border rounded-lg px-3">
                            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                                <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> 오디오 (Audio)</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-slate-500">음소거</Label>
                                    <Switch
                                        checked={selectedClip.audio.muted}
                                        onCheckedChange={(c) => handleAudioUpdate({ muted: c })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-xs text-slate-500">볼륨</Label>
                                        <span className="text-[10px] text-slate-600">{Math.round(selectedClip.audio.volume * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[selectedClip.audio.volume]}
                                        min={0} max={2} step={0.05}
                                        onValueChange={(v) => handleAudioUpdate({ volume: v[0] })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500">페이드 인</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.audio.fadeIn}s</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.audio.fadeIn]}
                                            min={0} max={5} step={0.1}
                                            onValueChange={(v) => handleAudioUpdate({ fadeIn: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-slate-500">페이드 아웃</Label>
                                            <span className="text-[10px] text-slate-600">{selectedClip.audio.fadeOut}s</span>
                                        </div>
                                        <Slider
                                            value={[selectedClip.audio.fadeOut]}
                                            min={0} max={5} step={0.1}
                                            onValueChange={(v) => handleAudioUpdate({ fadeOut: v[0] })}
                                        />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {/* Advanced Section */}
                    <AccordionItem value="advanced" className="border rounded-lg px-3">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                            <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> 고급 (Advanced)</span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 space-y-4">
                            {(selectedClip.type === 'audio' || selectedClip.type === 'video') && (
                                <div className="space-y-4 border-b border-slate-100 pb-4 mb-4">
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">오디오 효과</Label>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3 h-3 text-yellow-500" />
                                            <Label className="text-xs text-slate-500">노이즈 제거 (Denoise)</Label>
                                        </div>
                                        <Switch
                                            checked={selectedClip.audio.denoise || false}
                                            onCheckedChange={(c) => handleAudioUpdate({ denoise: c })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">음성 변조</Label>
                                        <Select
                                            value={selectedClip.audio.voiceEffect || 'none'}
                                            onValueChange={(v) => handleAudioUpdate({ voiceEffect: v })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="None" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">없음</SelectItem>
                                                <SelectItem value="chipmunk">다람쥐</SelectItem>
                                                <SelectItem value="robot">로봇</SelectItem>
                                                <SelectItem value="deep">저음</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <Label className="text-xs font-semibold text-slate-700 mb-2 block">비디오 효과</Label>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-slate-500">흔들림 보정 (Stabilization)</Label>
                                    <Switch
                                        checked={selectedClip.stabilization || false}
                                        onCheckedChange={(c) => handleUpdate({ stabilization: c })}
                                    />
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </div >
        </div >
    );
};

export default PropertyPanel;
