import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer as KonvaLayer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useLofiStudioStore, getActiveSceneLayers, Layer } from './store/useLofiStudioStore';


// Constants
const ARTBOARD_WIDTH = 1280;
const ARTBOARD_HEIGHT = 720;

interface LiveStudioStageProps {
    // We ignore passed width/height and use container size
    width?: number;
    height?: number;
}

// =============================================================================
// Layer Components
// =============================================================================

// Imported from shared library
// Imported from shared library
import { SharedSceneRenderer } from './components/SharedSceneRenderer';


// =============================================================================
// Main Stage
// =============================================================================

export const LiveStudioStage: React.FC<LiveStudioStageProps> = () => {
    const { selectedLayerIds, selectLayers, updateLayer, deleteLayer, scenes, activeSceneId } = useLofiStudioStore();
    const layers = getActiveSceneLayers();
    const activeScene = scenes.find(s => s.id === activeSceneId);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<any>(null);
    const trRef = useRef<any>(null);

    // State for Stage Size & Scale
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [artboardTransform, setArtboardTransform] = useState({ x: 0, y: 0, scale: 1 });

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (!isPlaying) return;

        let lastTime = performance.now();
        let handle = 0;

        const loop = (now: number) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            setCurrentTime(t => t + dt);
            handle = requestAnimationFrame(loop);
        };

        handle = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(handle);
    }, [isPlaying]);

    // Handle Double Click to Play
    const handleDblClickLogic = () => {
        setIsPlaying(p => !p);
    };

    // 1. Handle Resize with ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width: w, height: h } = entry.contentRect;

                // Avoid zero-size updates
                if (w === 0 || h === 0) return;

                setDimensions({ width: w, height: h });

                // Calculate Artboard Fit
                const padding = 40;
                const availableW = w - padding * 2;
                const availableH = h - padding * 2;

                const scaleW = availableW / ARTBOARD_WIDTH;
                const scaleH = availableH / ARTBOARD_HEIGHT;
                const scale = Math.min(scaleW, scaleH);

                const x = (w - ARTBOARD_WIDTH * scale) / 2;
                const y = (h - ARTBOARD_HEIGHT * scale) / 2;

                setArtboardTransform({ x, y, scale });
            }
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // 2. Transformer Update Logic
    useEffect(() => {
        if (!trRef.current || !stageRef.current) return;

        const stage = stageRef.current;
        const transformer = trRef.current;

        const selectedNodes = selectedLayerIds
            .map(id => stage.findOne('#' + id))
            .filter(node => node !== undefined);

        transformer.nodes(selectedNodes);
        transformer.getLayer().batchDraw();
    }, [selectedLayerIds, layers]); // Update if layers change (re-render)

    // 3. Deselect
    const checkDeselect = (e: any) => {
        // If clicked on Stage (parent of ArtboardGroup) or Artboard Background (Rect)
        const clickedStage = e.target === stageRef.current;
        const clickedBg = e.target.name() === 'artboard-bg';

        if (clickedStage || clickedBg) {
            selectLayers([]);
        }
    };

    // 4. Double Click handling
    const handleDblClick = (layerId: string) => {
        handleDblClickLogic();
    };

    // 5. Keyboard Events (Delete)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            const tagName = (e.target as HTMLElement).tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedLayerIds.length > 0) {
                    e.preventDefault();
                    // Delete all selected layers
                    selectedLayerIds.forEach(id => deleteLayer(id));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLayerIds, deleteLayer]);

    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    return (
        <div ref={containerRef} className="w-full h-full bg-[#1e1e1e] overflow-hidden relative">
            {/* Playback Controls Overlay */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/50 p-2 rounded text-white">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="hover:text-blue-400"
                >
                    {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 19h4V5h-4v14zm-8 0h4V5H6v14z" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>
                <span className="font-mono text-xs">{currentTime.toFixed(2)}s</span>
                <button onClick={() => setCurrentTime(0)} className="text-xs hover:text-red-400 ml-2">Reset</button>
            </div>

            <Stage
                width={dimensions.width}
                height={dimensions.height}
                onMouseDown={checkDeselect}
                onTouchStart={checkDeselect}
                ref={stageRef}
            >
                {/* Content Layer */}
                <KonvaLayer>
                    {/* Artboard Group - Clipped */}
                    <Group
                        x={artboardTransform.x}
                        y={artboardTransform.y}
                        scaleX={artboardTransform.scale}
                        scaleY={artboardTransform.scale}
                        clipX={0}
                        clipY={0}
                        clipWidth={ARTBOARD_WIDTH}
                        clipHeight={ARTBOARD_HEIGHT}
                    >
                        {/* Artboard Background */}
                        <Rect
                            name="artboard-bg"
                            x={0} y={0}
                            width={ARTBOARD_WIDTH}
                            height={ARTBOARD_HEIGHT}
                            fill="#000000"
                        />

                        {/* Shared Renderer */}
                        <SharedSceneRenderer
                            layers={sortedLayers}
                            selectedLayerIds={selectedLayerIds}
                            onSelectLayer={(id: string) => selectLayers([id])}
                            onLayerChange={updateLayer}
                            onLayerDblClick={handleDblClick}
                            currentTime={currentTime}
                            isStudio={true}
                            crossfadeDuration={activeScene?.crossfadeDuration}
                        />
                    </Group>
                </KonvaLayer>

                {/* UI Layer - Transformer (Unclipped) */}
                <KonvaLayer>
                    <Transformer
                        ref={trRef}
                        boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 5 || newBox.height < 5) return oldBox;
                            return newBox;
                        }}
                    />
                </KonvaLayer>
            </Stage>

            {/* HUD */}
            <div className="absolute top-4 left-4 text-xs text-gray-500 pointer-events-none">
                {Math.round(artboardTransform.scale * 100)}%
            </div>
        </div>
    );
};
