import React from 'react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Group, Rect } from 'react-konva';
import { Layer } from '../../store/useLofiStudioStore';

interface VisualizerRendererProps {
    layer: Layer;
    // We can pass audioUrl source if needed for local analysis,
    // but Remotion usually analyzes the composition's audio track.
    audioSrc?: string;
    isStudio?: boolean;
}

// 1. Studio Implementation (No Hooks, Safe for Canvas)
const StudioVisualizer = ({ layer }: { layer: Layer }) => {
    const variant = layer.widgetConfig?.variant || 'bars';
    const color = layer.widgetConfig?.color || '#ffffff';

    if (variant === 'circle') {
        return (
            <Group
                x={0} y={0} // WidgetLayer handles positioning
                opacity={layer.opacity}
            >
                <Rect
                    width={layer.width}
                    height={layer.height}
                    stroke={color}
                    strokeWidth={2}
                    cornerRadius={layer.width / 2}
                />
            </Group>
        );
    }

    // Static Bars Mockup
    const numberOfBars = 32;
    const barWidth = 8;
    const gap = 4;
    const roundness = 2;

    // Generate mock data pattern
    const mockBars = Array.from({ length: numberOfBars }).map((_, i) => {
        // Sine wave pattern
        return Math.abs(Math.sin(i * 0.2)) * 0.8 + 0.2;
    });

    return (
        <Group>
            {mockBars.map((amplitude, i) => {
                const height = amplitude * 100 * (layer.height / 100);
                const barHeight = Math.min(height * 2, layer.height);

                const x = i * (barWidth + gap);
                const y = layer.height - barHeight;

                return (
                    <Rect
                        key={i}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        opacity={0.7}
                        cornerRadius={roundness}
                    />
                );
            })}
        </Group>
    );
};

// 2. Remotion Implementation (Uses Hooks, Crashes outside composition)
const RemotionVisualizer = ({ layer, audioSrc }: VisualizerRendererProps) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Use Remotion audio hook
    // Note: This requires <Audio/> tag or specific context setup
    // passing null prevents fetching if source is missing
    const audioData = useAudioData(audioSrc || null as any);

    if (!audioData) {
        return null;
    }

    // Determine visualization type (future proofing)
    const variant = layer.widgetConfig?.variant || 'bars';

    if (variant === 'circle') {
        return (
            <Group
                width={layer.width}
                height={layer.height}
                opacity={layer.opacity}
            >
                <Rect
                    width={layer.width}
                    height={layer.height}
                    stroke="white"
                    strokeWidth={2}
                    cornerRadius={layer.width / 2}
                />
            </Group>
        );
    }

    // Default: Bars visualization
    const numberOfBars = 64;
    const frequencyData = visualizeAudio({
        fps,
        frame,
        audioData,
        numberOfSamples: numberOfBars,
    });

    const barWidth = 8;
    const gap = 4;
    const color = layer.widgetConfig?.color || '#ffffff';
    const roundness = 2;

    return (
        <Group>
            {frequencyData.map((amplitude, i) => {
                const height = amplitude * 100 * (layer.height / 100);
                const barHeight = Math.min(height * 5, layer.height);

                const x = i * (barWidth + gap);
                const y = layer.height - barHeight;

                return (
                    <Rect
                        key={i}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={color}
                        cornerRadius={roundness}
                    />
                );
            })}
        </Group>
    );
};

// 3. Main Switcher
export const VisualizerRenderer: React.FC<VisualizerRendererProps> = (props) => {
    // If in Studio mode, render static/mock version to avoid Hook errors
    if (props.isStudio) {
        return <StudioVisualizer layer={props.layer} />;
    }

    // Otherwise, assume Remotion context and use hooks
    return <RemotionVisualizer {...props} />;
};
