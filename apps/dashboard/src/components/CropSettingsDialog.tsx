import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditorStore } from '../hooks/useEditorStore';
import Moveable, { OnDrag, OnResize } from "react-moveable";
import { Check, RotateCcw, X, Crop as CropIcon } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface CropSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type AspectRatio = 'free' | number;

const RATIOS: { label: string, value: AspectRatio }[] = [
    { label: '자유', value: 'free' },
    { label: '1:1', value: 1 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
];

const CropSettingsDialog: React.FC<CropSettingsDialogProps> = ({ open, onOpenChange }) => {
    const { selectedClipId, tracks, updateClip } = useEditorStore();

    // Find selected clip
    const selectedClip = React.useMemo(() => {
        if (!selectedClipId) return null;
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === selectedClipId);
            if (clip) return clip;
        }
        return null;
    }, [selectedClipId, tracks]);

    const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [sourceDim, setSourceDim] = useState({ width: 0, height: 0 });
    const [selectedRatio, setSelectedRatio] = useState<string>('free'); // 'free' or "1:1" string from Select
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

    // Initialize Crop State
    useEffect(() => {
        if (open && selectedClip) {
            if (selectedClip.crop) {
                setCrop(selectedClip.crop);
                if (selectedClip.sourceDimensions) setSourceDim(selectedClip.sourceDimensions);
            } else {
                setCrop({ x: 0, y: 0, width: 0, height: 0 });
            }
            setSelectedRatio('free');
        }
    }, [open, selectedClip]);

    const handleMediaLoad = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
        const el = e.currentTarget;
        let w = 0, h = 0;
        if (el instanceof HTMLVideoElement) {
            w = el.videoWidth;
            h = el.videoHeight;
        } else {
            w = (el as HTMLImageElement).naturalWidth;
            h = (el as HTMLImageElement).naturalHeight;
        }
        setSourceDim({ width: w, height: h });
        if (!selectedClip?.crop) {
            setCrop({ x: 0, y: 0, width: w, height: h });
        }
    };

    const handleRatioChange = (val: string) => {
        setSelectedRatio(val);
        if (val === 'free' || sourceDim.width === 0) return;

        // Parse Ratio
        let ratio = 1;
        if (val !== 'free') {
            const parts = val.split(':');
            if (parts.length === 2) {
                ratio = parseFloat(parts[0]) / parseFloat(parts[1]);
            } else {
                return; // Should not happen based on values
            }
        }

        // Apply Ratio to current crop center (roughly)
        // Or just fit to source
        let newW = crop.width;
        let newH = newW / ratio;

        if (newH > sourceDim.height) {
            newH = sourceDim.height;
            newW = newH * ratio;
        }
        if (newW > sourceDim.width) {
            newW = sourceDim.width;
            newH = newW / ratio;
        }

        // Center it
        const cx = crop.x + crop.width / 2;
        const cy = crop.y + crop.height / 2;

        let newX = cx - newW / 2;
        let newY = cy - newH / 2;

        // Bound check
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newW > sourceDim.width) newX = sourceDim.width - newW;
        if (newY + newH > sourceDim.height) newY = sourceDim.height - newH;

        setCrop({ x: newX, y: newY, width: newW, height: newH });
    };

    const handleSave = () => {
        if (!selectedClip) return;
        updateClip(selectedClip.trackId, selectedClip.id, {
            crop: crop,
            sourceDimensions: sourceDim,
            transform: {
                ...selectedClip.transform,
                width: crop.width,
                height: crop.height
            }
        });
        onOpenChange(false);
    };

    const handleReset = () => {
        setCrop({ x: 0, y: 0, width: sourceDim.width, height: sourceDim.height });
        setSelectedRatio('free');
    };

    if (!selectedClip || !['image', 'video'].includes(selectedClip.type)) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] bg-[#1e1e1e] text-white border-slate-200 flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b border-slate-200 shrink-0">
                    <DialogTitle className="flex items-center gap-2"><CropIcon className="w-5 h-5" /> 자르기 (Crop)</DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden p-8">
                    {/* WRAPPER: Matches image size exactly */}
                    <div className="relative shadow-2xl inline-block" style={{ width: 'fit-content', height: 'fit-content', maxWidth: '100%', maxHeight: '100%' }}>
                        {selectedClip.type === 'video' ? (
                            <video
                                ref={mediaRef as any}
                                src={selectedClip.source}
                                className="max-w-full max-h-[70vh] pointer-events-none block"
                                onLoadedMetadata={handleMediaLoad}
                            />
                        ) : (
                            <img
                                ref={mediaRef as any}
                                src={selectedClip.source}
                                className="max-w-full max-h-[70vh] pointer-events-none block"
                                onLoad={handleMediaLoad}
                            />
                        )}

                        {/* OVERLAY: Absolute over the image */}
                        <CropOverlay
                            wrapperRef={mediaRef} /* Use mediaRef to get clientWidth if needed, but flex wrapper handles size */
                            crop={crop}
                            sourceDim={sourceDim}
                            onCropChange={setCrop}
                            aspectRatio={selectedRatio === 'free' ? undefined : (() => {
                                const parts = selectedRatio.split(':');
                                return parseFloat(parts[0]) / parseFloat(parts[1]);
                            })()}
                        />
                    </div>
                </div>

                <div className="h-16 border-t border-slate-200 bg-[#1e1e1e] px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={handleReset} className="text-slate-600 hover:text-white">
                            <RotateCcw className="w-4 h-4 mr-2" /> 초기화
                        </Button>
                        <div className="w-px h-6 bg-white/10" />
                        <span className="text-sm text-slate-600">자르기 비율:</span>
                        <Select value={selectedRatio} onValueChange={handleRatioChange}>
                            <SelectTrigger className="w-[100px] bg-black/50 border-slate-600 text-white h-8">
                                <SelectValue placeholder="자유" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2e2e2e] border-slate-600 text-white">
                                {RATIOS.map(r => (
                                    <SelectItem key={r.label} value={r.value === 'free' ? 'free' : (r.label.includes(':') ? r.label : 'free')}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">확인</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const CropOverlay: React.FC<{
    wrapperRef: React.RefObject<HTMLElement>,
    crop: { x: number, y: number, width: number, height: number },
    sourceDim: { width: number, height: number },
    onCropChange: (c: { x: number, y: number, width: number, height: number }) => void,
    aspectRatio?: number
}> = ({ crop, sourceDim, onCropChange, aspectRatio, wrapperRef }) => {
    const targetRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerRect, setContainerRect] = useState<{ width: number, height: number } | null>(null);

    // Measure the displayed container size (the image wrapper)
    useEffect(() => {
        if (!wrapperRef.current) return;
        const update = () => {
            // We use clientWidth/Height of the media element because the wrapper fits it.
            setContainerRect({
                width: wrapperRef.current!.clientWidth,
                height: wrapperRef.current!.clientHeight
            });
        };
        update();
        const obs = new ResizeObserver(update);
        obs.observe(wrapperRef.current);
        window.addEventListener('resize', update);
        return () => { obs.disconnect(); window.removeEventListener('resize', update); }
    }, [wrapperRef.current, sourceDim]);

    if (!containerRect || sourceDim.width === 0) return null;

    // Conversions
    // crop (source units) -> display (px)
    const scale = containerRect.width / sourceDim.width;

    const dLeft = crop.x * scale;
    const dTop = crop.y * scale;
    const dWidth = crop.width * scale;
    const dHeight = crop.height * scale;
    const isZero = crop.width === 0;

    return (
        <div ref={containerRef} className="absolute inset-0 z-50 pointer-events-none">
            <style>{`
                .crop-moveable .moveable-control {
                    background: white !important;
                    border: 1px solid rgba(0,0,0,0.1) !important;
                    box-shadow: 0 0 2px rgba(0,0,0,0.2) !important;
                }
                .crop-moveable .moveable-line {
                    background: white !important;
                    height: 2px !important;
                }
                
                /* Corners: White Circles */
                .crop-moveable .moveable-control[data-direction="nw"], 
                .crop-moveable .moveable-control[data-direction="ne"], 
                .crop-moveable .moveable-control[data-direction="sw"], 
                .crop-moveable .moveable-control[data-direction="se"] {
                    width: 14px !important;
                    height: 14px !important;
                    border-radius: 50% !important;
                    margin-top: -7px !important;
                    margin-left: -7px !important;
                }

                /* Horizontal Edges: Pills */
                .crop-moveable .moveable-control[data-direction="n"], 
                .crop-moveable .moveable-control[data-direction="s"] {
                    width: 24px !important;
                    height: 6px !important;
                    border-radius: 4px !important;
                    margin-top: -3px !important;
                    margin-left: -12px !important;
                }

                /* Vertical Edges: Pills */
                .crop-moveable .moveable-control[data-direction="w"], 
                .crop-moveable .moveable-control[data-direction="e"] {
                    width: 6px !important;
                    height: 24px !important;
                    border-radius: 4px !important;
                    margin-top: -12px !important;
                    margin-left: -3px !important;
                }
            `}</style>

            {/* The Crop Box (Visual) */}
            <div
                ref={targetRef}
                className="absolute border-2 border-white bg-black/10 pointer-events-auto box-border"
                style={{
                    left: isZero ? 0 : dLeft,
                    top: isZero ? 0 : dTop,
                    width: isZero ? containerRect.width : dWidth,
                    height: isZero ? containerRect.height : dHeight,
                }}
            >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-r border-b border-white/30" />
                    <div className="border-b border-white/30" />
                    <div className="border-r border-white/30" />
                    <div className="border-r border-white/30" />
                    <div />
                </div>
            </div>

            <Moveable
                target={targetRef.current}
                container={containerRef.current} /* Bounds relative to this container */
                className="crop-moveable"
                resizable={true}
                draggable={true}
                keepRatio={!!aspectRatio}
                snappable={true}
                bounds={{ left: 0, top: 0, right: containerRect.width, bottom: containerRect.height }}
                onDrag={e => {
                    e.target.style.left = `${e.left}px`;
                    e.target.style.top = `${e.top}px`;
                }}
                onDragEnd={e => {
                    // Convert back to Source Units
                    const rect = e.target.getBoundingClientRect();
                    // We can't trust getBoundingClientRect() directly for calculation if we are in scaled context?
                    // Actually, rect is px. containerRect is px.
                    // But e.left / e.top are relative to container.
                    const newX = parseFloat(e.target.style.left || '0') / scale;
                    const newY = parseFloat(e.target.style.top || '0') / scale;
                    // width/height from style
                    const newW = parseFloat(e.target.style.width || e.target.scrollWidth.toString()) / scale;
                    const newH = parseFloat(e.target.style.height || e.target.scrollHeight.toString()) / scale;

                    onCropChange({ x: Math.max(0, newX), y: Math.max(0, newY), width: newW, height: newH });
                }}
                onResize={e => {
                    e.target.style.width = `${e.width}px`;
                    e.target.style.height = `${e.height}px`;
                    e.target.style.transform = e.drag.transform;
                }}
                onResizeEnd={e => {
                    // Parsing style directly is safer than rect if transforms are involved
                    // But Moveable puts transform on the element during drag/resize?
                    // e.drag.transform is `translate(...)`.
                    // We need to bake the transform into top/left for the next state

                    // Actually, let's use the helper provided by Moveable or just use the Style values
                    // But Wait! transform translate is used during interaction.
                    // We need to finalize it.
                    const rect = e.target.getBoundingClientRect();
                    // Actually, we know the containerRect.
                    // It's safest to get offsets relative to container.
                    // But container might be offset.
                    if (!containerRef.current) return;
                    const cRect = containerRef.current.getBoundingClientRect();

                    const relX = rect.left - cRect.left;
                    const relY = rect.top - cRect.top;

                    onCropChange({
                        x: Math.max(0, relX / scale),
                        y: Math.max(0, relY / scale),
                        width: rect.width / scale,
                        height: rect.height / scale
                    });
                }}
                renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
            />
        </div>
    );
};

export default CropSettingsDialog;
