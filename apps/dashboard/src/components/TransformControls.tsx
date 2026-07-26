import React, { useEffect, useRef, useState } from 'react';
import { Clip } from '../hooks/useEditorStore';

interface TransformControlsProps {
    clip: Clip;
    containerWidth: number;
    containerHeight: number;
    zoomScale: number;
    onUpdate: (updates: Partial<Clip['transform']>) => void;
    onInteractionStart?: () => void;
    onInteractionEnd?: () => void;
}

export const TransformControls: React.FC<TransformControlsProps> = ({
    clip,
    containerWidth,
    containerHeight,
    zoomScale = 1,
    onUpdate,
    onInteractionStart,
    onInteractionEnd
}) => {
    const [dimensions, setDimensions] = useState({ width: 100, height: 100 });

    // Refs for drag calculations
    const startPos = useRef({ x: 0, y: 0 });
    const startTransform = useRef(clip.transform);
    const boxRef = useRef<HTMLDivElement>(null);

    // Measure element size
    useEffect(() => {
        const measure = () => {
            const el = document.getElementById(`clip-${clip.id}`);
            if (el) {
                setDimensions({
                    width: el.offsetWidth || 100,
                    height: el.offsetHeight || 100
                });
            }
        };
        measure();
        const observer = new MutationObserver(measure);
        const el = document.getElementById(`clip-${clip.id}`);
        if (el) {
            observer.observe(el, { attributes: true, childList: true, subtree: true });
        }
        return () => observer.disconnect();
    }, [clip.id, clip.content, clip.style, clip.source]);

    // Calculate screen position
    const left = (clip.transform?.x || 0) + containerWidth / 2;
    const top = (clip.transform?.y || 0) + containerHeight / 2;
    const width = clip.transform?.width || dimensions.width;
    const height = clip.transform?.height || dimensions.height;
    const rotation = clip.transform?.rotation || 0;
    const scale = clip.transform?.scale || 1;

    // Handle Size (Inverse scale for constant visual size)
    const handleSize = 10 / zoomScale;
    const strokeWidth = 2 / zoomScale;

    // --- Dragging ---
    const handleDragStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        startPos.current = { x: e.clientX, y: e.clientY };
        startTransform.current = { ...clip.transform };
        onInteractionStart?.();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - startPos.current.x) / zoomScale;
            const dy = (moveEvent.clientY - startPos.current.y) / zoomScale;

            onUpdate({
                ...startTransform.current,
                x: startTransform.current.x + dx,
                y: startTransform.current.y + dy
            });
        };

        const handleMouseUp = () => {
            onInteractionEnd?.();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- Resizing ---
    const handleResizeStart = (e: React.MouseEvent, corner: string) => {
        e.stopPropagation();
        e.preventDefault();
        startPos.current = { x: e.clientX, y: e.clientY };
        startTransform.current = { ...clip.transform };
        onInteractionStart?.();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - startPos.current.x) / zoomScale;
            const dy = (moveEvent.clientY - startPos.current.y) / zoomScale;

            // Simple uniform scaling sensitivity
            const sensitivity = 0.005;
            let scaleDelta = 0;

            // Adjust based on corner to make dragging outward increase scale
            if (corner === 'br') scaleDelta = (dx + dy) * sensitivity;
            else if (corner === 'tl') scaleDelta = -(dx + dy) * sensitivity;
            else if (corner === 'tr') scaleDelta = (dx - dy) * sensitivity;
            else if (corner === 'bl') scaleDelta = (-dx + dy) * sensitivity;

            const newScale = Math.max(0.1, (startTransform.current.scale || 1) + scaleDelta);

            onUpdate({
                ...startTransform.current,
                scale: newScale
            });
        };

        const handleMouseUp = () => {
            onInteractionEnd?.();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- Rotating ---
    const handleRotateStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onInteractionStart?.();

        const rect = boxRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            const degrees = angle * (180 / Math.PI);
            let newRotation = degrees + 90;

            onUpdate({
                ...startTransform.current,
                rotation: newRotation
            });
        };

        const handleMouseUp = () => {
            onInteractionEnd?.();
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={boxRef}
            className="absolute pointer-events-none"
            style={{
                left: left,
                top: top,
                width: width,
                height: height,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
                zIndex: 100
            }}
        >
            {/* SVG Overlay for Handles */}
            <svg
                className="absolute overflow-visible"
                style={{
                    left: 0, top: 0, width: '100%', height: '100%',
                    pointerEvents: 'none'
                }}
            >
                {/* Border */}
                <rect
                    x={0} y={0} width="100%" height="100%"
                    fill="none" stroke="#3b82f6" strokeWidth={strokeWidth}
                    vectorEffect="non-scaling-stroke"
                />

                {/* Rotation Line */}
                <line
                    x1="50%" y1="0" x2="50%" y2={-30 / zoomScale}
                    stroke="#3b82f6" strokeWidth={strokeWidth}
                />
            </svg>

            {/* Interactive Areas (HTML for easier event handling, positioned absolutely) */}

            {/* Drag Area (Invisible) */}
            <div
                className="absolute inset-0 cursor-move pointer-events-auto"
                onMouseDown={handleDragStart}
            />

            {/* Resize Handles */}
            <div
                className="absolute -top-1.5 -left-1.5 bg-white border border-blue-500 rounded-full pointer-events-auto cursor-nwse-resize"
                style={{ width: handleSize, height: handleSize, borderWidth: strokeWidth, transform: 'translate(-50%, -50%)' }}
                onMouseDown={(e) => handleResizeStart(e, 'tl')}
            />
            <div
                className="absolute -top-1.5 -right-1.5 bg-white border border-blue-500 rounded-full pointer-events-auto cursor-nesw-resize"
                style={{ width: handleSize, height: handleSize, borderWidth: strokeWidth, transform: 'translate(50%, -50%)', left: '100%' }}
                onMouseDown={(e) => handleResizeStart(e, 'tr')}
            />
            <div
                className="absolute -bottom-1.5 -left-1.5 bg-white border border-blue-500 rounded-full pointer-events-auto cursor-nesw-resize"
                style={{ width: handleSize, height: handleSize, borderWidth: strokeWidth, transform: 'translate(-50%, 50%)', top: '100%' }}
                onMouseDown={(e) => handleResizeStart(e, 'bl')}
            />
            <div
                className="absolute -bottom-1.5 -right-1.5 bg-white border border-blue-500 rounded-full pointer-events-auto cursor-nwse-resize"
                style={{ width: handleSize, height: handleSize, borderWidth: strokeWidth, transform: 'translate(50%, 50%)', left: '100%', top: '100%' }}
                onMouseDown={(e) => handleResizeStart(e, 'br')}
            />

            {/* Rotation Handle */}
            <div
                className="absolute left-1/2 bg-white border border-blue-500 rounded-full pointer-events-auto cursor-pointer hover:bg-blue-50 flex items-center justify-center"
                style={{
                    width: handleSize * 2, height: handleSize * 2, borderWidth: strokeWidth,
                    top: -30 / zoomScale, transform: 'translate(-50%, -50%)'
                }}
                onMouseDown={handleRotateStart}
            >
                <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
            </div>

        </div>
    );
};
