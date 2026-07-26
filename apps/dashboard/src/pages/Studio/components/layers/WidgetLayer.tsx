import React, { useRef, useState, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import { Layer } from '../../store/useLofiStudioStore';
import { VisualizerRenderer } from '../VisualizerRenderer/VisualizerRenderer';

interface WidgetLayerProps {
    layer: Layer;
    onSelect?: () => void;
    onChange?: (newAttrs: Partial<Layer>) => void;
    onDblClick?: () => void;
    audioSrc?: string;
    currentTime?: number;
    isStudio?: boolean;
}

export const WidgetLayer = ({ layer, onSelect, onChange, onDblClick, audioSrc, currentTime, isStudio }: WidgetLayerProps) => {
    const shapeRef = useRef<Konva.Group>(null);
    const [systemTime, setSystemTime] = useState(new Date());

    useEffect(() => {
        if (layer.widgetType === 'clock' && currentTime === undefined) {
            const timer = setInterval(() => setSystemTime(new Date()), 1000);
            return () => clearInterval(timer);
        }
    }, [layer.widgetType, currentTime]);

    if (!layer.visible) return null;

    const renderWidgetContent = () => {
        switch (layer.widgetType) {
            case 'clock':
                // Frame-perfect clock based on video time, not system time
                // Assuming FPS=30. Logic: standard time + frame based glitch offsets
                // We'll calculate a static start time offset + frame/FPS

                let timeString = '';
                let glitchFactor = 0;

                if (currentTime !== undefined) {
                    // Remotion Mode
                    // Arbitrary start time for the "clock" look? Or 00:00:00?
                    // Let's use a fixed base date + currentTime
                    const baseDate = new Date();
                    baseDate.setHours(12, 0, 0, 0); // Start at 12:00
                    const targetDate = new Date(baseDate.getTime() + currentTime * 1000);

                    const h = targetDate.getHours();
                    const m = targetDate.getMinutes();
                    const s = targetDate.getSeconds();
                    timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

                    glitchFactor = (currentTime * 30) % 60; // Mock frame count
                } else {
                    // Studio Mode
                    const now = systemTime;
                    const h = now.getHours();
                    const m = now.getMinutes();
                    const s = now.getSeconds();
                    timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    glitchFactor = Math.random() * 60;
                }

                // Simple Glitch Effect: Random offset every ~60 frames
                const isGlitch = glitchFactor < 5;
                const offsetX = isGlitch ? (Math.random() - 0.5) * 10 : 0;

                return (
                    <Group x={offsetX}>
                        <Rect width={layer.width} height={layer.height} fill="#000000" opacity={0.6} cornerRadius={8} />
                        <Text
                            text={timeString}
                            width={layer.width}
                            height={layer.height}
                            fontSize={layer.fontSize || 40}
                            fontFamily={layer.fontFamily || 'monospace'}
                            fill={layer.fill || '#00FF00'}
                            align="center"
                            verticalAlign="middle"
                            shadowColor="#00FF00"
                            shadowBlur={isGlitch ? 20 : 0}
                            shadowOpacity={0.8}
                        />
                    </Group>
                );
            case 'nowPlaying':
                return (
                    <Group>
                        <Rect width={layer.width} height={layer.height} fill="#1E293B" cornerRadius={12} shadowColor="black" shadowBlur={10} shadowOpacity={0.3} />
                        <Rect x={10} y={10} width={100} height={100} fill="#334155" cornerRadius={8} />
                        <Text x={120} y={35} text="Lofi Hip Hop Radio" fontSize={20} fontFamily="Poppins" fill="white" fontStyle="bold" />
                        <Text x={120} y={65} text="Beats to Relax/Study to" fontSize={16} fontFamily="Poppins" fill="#94A3B8" />
                    </Group>
                );
            case 'visualizer':
                return <VisualizerRenderer layer={layer} isStudio={isStudio} audioSrc={audioSrc} />;
            default:
                return (
                    <Rect width={layer.width} height={layer.height} fill="rgba(100, 100, 255, 0.3)" stroke="rgba(100, 100, 255, 0.8)" strokeWidth={2} cornerRadius={8} />
                );
        }
    };

    return (
        <Group
            id={layer.id}
            name={layer.id}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
            rotation={layer.rotation}
            scaleX={layer.scaleX}
            scaleY={layer.scaleY}
            opacity={layer.opacity}
            draggable={!layer.locked && !!onChange}
            ref={shapeRef}
            onClick={onSelect}
            onTap={onSelect}
            onDblClick={onDblClick}
            onDragEnd={(e) => {
                onChange?.({
                    x: e.target.x(),
                    y: e.target.y()
                });
            }}
            onTransformEnd={() => {
                const node = shapeRef.current;
                if (!node) return;

                const scaleX = node.scaleX();
                const scaleY = node.scaleY();
                node.scaleX(1);
                node.scaleY(1);

                onChange?.({
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, node.width() * scaleX),
                    height: Math.max(node.height() * scaleY),
                    rotation: node.rotation(),
                });
            }}
        >
            {renderWidgetContent()}
        </Group>
    );
};
