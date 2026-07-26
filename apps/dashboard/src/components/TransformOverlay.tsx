import React, { useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Clip, useEditorStore } from '../hooks/useEditorStore';
import { cn } from '@/lib/utils';
import { RotateCw } from 'lucide-react';

interface TransformOverlayProps {
    clip: Clip;
    containerRef: React.RefObject<HTMLDivElement>;
    isSelected: boolean;
    onSelect: () => void;
}

const TransformOverlay: React.FC<TransformOverlayProps> = ({ clip, containerRef, isSelected, onSelect }) => {
    const { updateClip } = useEditorStore();
    const [showGuides, setShowGuides] = useState<{ x: boolean, y: boolean, left: boolean, right: boolean, top: boolean, bottom: boolean }>({
        x: false, y: false, left: false, right: false, top: false, bottom: false
    });
    const [isRotating, setIsRotating] = useState(false);

    // Calculate initial position (Center + Offset)
    const containerW = containerRef.current?.clientWidth || 0;
    const containerH = containerRef.current?.clientHeight || 0;
    const centerX = containerW / 2;
    const centerY = containerH / 2;

    // Derived values from clip transform
    const width = clip.transform.width || 100;
    const height = clip.transform.height || 100;
    const scale = clip.transform.scale || 1;
    const rotation = clip.transform.rotation || 0;

    // Rnd uses top-left coordinates. 
    // Our store uses center-relative coordinates for x,y.
    const x = centerX + clip.transform.x - (width * scale) / 2;
    const y = centerY + clip.transform.y - (height * scale) / 2;

    const handleDrag = (e: any, d: any) => {
        const SNAP_THRESHOLD = 15;
        let newX = d.x;
        let newY = d.y;

        const currentW = width * scale;
        const currentH = height * scale;

        const elementCenterX = newX + currentW / 2;
        const elementCenterY = newY + currentH / 2;

        const guides = { x: false, y: false, left: false, right: false, top: false, bottom: false };

        // Snap Center X
        if (Math.abs(elementCenterX - centerX) < SNAP_THRESHOLD) {
            newX = centerX - currentW / 2;
            guides.x = true;
        }
        // Snap Center Y
        if (Math.abs(elementCenterY - centerY) < SNAP_THRESHOLD) {
            newY = centerY - currentH / 2;
            guides.y = true;
        }

        // Snap Edges (Left/Right to Canvas Edges)
        if (Math.abs(newX) < SNAP_THRESHOLD) { newX = 0; guides.left = true; } // Left
        if (Math.abs(newX + currentW - containerW) < SNAP_THRESHOLD) { newX = containerW - currentW; guides.right = true; } // Right

        // Snap Edges (Top/Bottom)
        if (Math.abs(newY) < SNAP_THRESHOLD) { newY = 0; guides.top = true; } // Top
        if (Math.abs(newY + currentH - containerH) < SNAP_THRESHOLD) { newY = containerH - currentH; guides.bottom = true; } // Bottom

        setShowGuides(guides);
    };

    const handleDragStop = (e: any, d: any) => {
        const SNAP_THRESHOLD = 15;
        let newX = d.x;
        let newY = d.y;
        const currentW = width * scale;
        const currentH = height * scale;

        // Apply Snap on Stop
        if (Math.abs((newX + currentW / 2) - centerX) < SNAP_THRESHOLD) newX = centerX - currentW / 2;
        if (Math.abs((newY + currentH / 2) - centerY) < SNAP_THRESHOLD) newY = centerY - currentH / 2;
        if (Math.abs(newX) < SNAP_THRESHOLD) newX = 0;
        if (Math.abs(newX + currentW - containerW) < SNAP_THRESHOLD) newX = containerW - currentW;
        if (Math.abs(newY) < SNAP_THRESHOLD) newY = 0;
        if (Math.abs(newY + currentH - containerH) < SNAP_THRESHOLD) newY = containerH - currentH;

        updateClip(clip.trackId, clip.id, {
            transform: {
                ...clip.transform,
                x: (newX + currentW / 2) - centerX,
                y: (newY + currentH / 2) - centerY
            }
        });
        setShowGuides({ x: false, y: false, left: false, right: false, top: false, bottom: false });
    };

    const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
        const newDisplayWidth = ref.offsetWidth;
        const newDisplayHeight = ref.offsetHeight;

        // For text, if resizing from sides (left/right), we update WIDTH, not scale.
        // For corners, we update SCALE.
        const isSideResize = direction === 'left' || direction === 'right';

        if (clip.type === 'text' && isSideResize) {
            // Update width, keep scale same
            // Recalculate center based on new width
            const newCenterX = position.x + newDisplayWidth / 2;
            const newCenterY = position.y + (height * scale) / 2; // Height shouldn't change much on side resize unless wrapping?

            // Actually, if text wraps, height WILL change. Rnd handles this visually.
            // We should update both width and height, but keep scale constant.

            updateClip(clip.trackId, clip.id, {
                transform: {
                    ...clip.transform,
                    width: newDisplayWidth / scale, // Store unscaled width
                    height: newDisplayHeight / scale, // Store unscaled height
                    x: newCenterX - centerX,
                    y: newCenterY - centerY
                }
            });
        } else {
            // Standard scaling behavior (corners)
            const newScale = newDisplayWidth / width;
            const newCenterX = position.x + newDisplayWidth / 2;
            const newCenterY = position.y + (height * newScale) / 2;

            updateClip(clip.trackId, clip.id, {
                transform: {
                    ...clip.transform,
                    scale: newScale,
                    x: newCenterX - centerX,
                    y: newCenterY - centerY
                }
            });
        }
    };

    // Rotation Logic
    const handleRotateStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRotating(true);
        // ... (rotation logic same as before)
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const elCenterX = rect.left + (x + (width * scale) / 2);
        const elCenterY = rect.top + (y + (height * scale) / 2);

        const onMouseMove = (ev: MouseEvent) => {
            const angle = Math.atan2(ev.clientY - elCenterY, ev.clientX - elCenterX);
            let deg = angle * (180 / Math.PI);
            deg += 90;

            updateClip(clip.trackId, clip.id, {
                transform: { ...clip.transform, rotation: deg }
            });
        };

        const onMouseUp = () => {
            setIsRotating(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Determine resize handles based on type
    const enableResizing = isSelected ? {
        top: false, bottom: false,
        right: clip.type === 'text', left: clip.type === 'text', // Enable side resizing for text
        topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
    } : false;

    return (
        <>
            {/* Magnetic Guides */}
            {isSelected && showGuides.x && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-blue-500 z-50 transform -translate-x-1/2" />}
            {isSelected && showGuides.y && <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-blue-500 z-50 transform -translate-y-1/2" />}
            {isSelected && showGuides.left && <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-blue-500 z-50" />}
            {isSelected && showGuides.right && <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-blue-500 z-50" />}
            {isSelected && showGuides.top && <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 z-50" />}
            {isSelected && showGuides.bottom && <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 z-50" />}

            <Rnd
                size={{ width: width * scale, height: height * scale }}
                position={{ x, y }}
                onDrag={handleDrag}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
                onDragStart={onSelect}
                lockAspectRatio={clip.type !== 'text'} // Lock aspect ratio for non-text
                bounds={undefined} // Allow moving outside
                enableResizing={enableResizing}
                className={cn(
                    "z-10 !static group/rnd",
                    isSelected ? "ring-2 ring-blue-500 ring-offset-0" : "hover:ring-1 hover:ring-blue-300"
                )}
                style={{
                    zIndex: clip.layer,
                    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`
                }}
            >
                <div className="w-full h-full cursor-move relative">
                    {/* Content */}
                    <div className="w-full h-full overflow-hidden" style={{
                        opacity: clip.transform.opacity ?? 1,
                        mixBlendMode: (clip.style?.blendMode as any) || 'normal',
                        filter: clip.filter ? `brightness(${clip.filter.brightness}) contrast(${clip.filter.contrast}) saturate(${clip.filter.saturation}) hue-rotate(${clip.filter.hue}deg) blur(${clip.filter.blur || 0}px)` : 'none'
                    }}>
                        {clip.type === 'text' && clip.style && (
                            <div className="w-full h-full flex items-center whitespace-pre-wrap break-words" style={{
                                fontFamily: clip.style.fontFamily,
                                fontSize: `${(clip.style.fontSize || 40) * (containerH / (containerW < containerH ? 1920 : 1080))}px`,
                                color: clip.style.color,
                                backgroundColor: clip.style.backgroundColor,
                                textAlign: clip.style.textAlign || 'center',
                                letterSpacing: `${(clip.style.letterSpacing || 0) * (containerH / (containerW < containerH ? 1920 : 1080))}px`,
                                lineHeight: clip.style.lineHeight || 1.2,
                                justifyContent: clip.style.textAlign === 'left' ? 'flex-start' : clip.style.textAlign === 'right' ? 'flex-end' : 'center',
                                textShadow: clip.style.shadow ? `${2 * (containerH / 1920)}px ${2 * (containerH / 1920)}px ${clip.style.shadow.blur * (containerH / 1920)}px ${clip.style.shadow.color}` : 'none',
                                WebkitTextStroke: clip.style.stroke ? `${clip.style.stroke.width * (containerH / 1920)}px ${clip.style.stroke.color}` : 'none'
                            }}>
                                {clip.name}
                            </div>
                        )}
                        {clip.type === 'image' && (
                            <img src={clip.source} alt={clip.name} className="w-full h-full object-contain pointer-events-none" />
                        )}
                        {clip.type === 'video' && (
                            <video src={clip.source} className="w-full h-full object-cover pointer-events-none" muted />
                        )}
                    </div>

                    {/* Rotation Handle */}
                    {isSelected && (
                        <div
                            className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform border border-slate-200 z-50"
                            onMouseDown={handleRotateStart}
                        >
                            <RotateCw className="w-3.5 h-3.5 text-slate-700" />
                        </div>
                    )}
                </div>
            </Rnd>
        </>
    );
};

export default TransformOverlay;
