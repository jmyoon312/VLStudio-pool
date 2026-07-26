import React from 'react';
import { Group } from 'react-konva';
import { Layer } from '../store/useLofiStudioStore';
import { VideoLayer, ImageLayer, TextLayer, WidgetLayer, ParticleLayer } from './layers';

interface SharedSceneRendererProps {
    layers: Layer[];
    selectedLayerIds?: string[];
    onSelectLayer?: (id: string, isMulti?: boolean) => void;
    onLayerChange?: (id: string, newAttrs: Partial<Layer>) => void;
    onLayerDblClick?: (id: string) => void;
    currentTime?: number; // Added for Remotion sync
    activeAudioSrc?: string; // Added for Visualizer
    isStudio?: boolean; // Added for Environment Context
    crossfadeDuration?: number; // Added for Video Loop Crossfade
}

export const SharedSceneRenderer: React.FC<SharedSceneRendererProps> = ({
    layers,
    selectedLayerIds = [],
    onSelectLayer,
    onLayerChange,
    onLayerDblClick,
    currentTime,
    activeAudioSrc,
    isStudio,
    crossfadeDuration
}) => {
    // Sort by zIndex
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    return (
        <Group>
            {sortedLayers.map((layer) => {
                const isSelected = selectedLayerIds.includes(layer.id);

                const handleSelect = () => {
                    onSelectLayer?.(layer.id);
                };

                const handleChange = (updates: Partial<Layer>) => {
                    onLayerChange?.(layer.id, updates);
                };

                const handleDblClick = () => {
                    onLayerDblClick?.(layer.id);
                };

                const commonProps = {
                    layer,
                    onSelect: handleSelect,
                    onChange: onLayerChange ? handleChange : undefined,
                    onDblClick: handleDblClick,
                    currentTime,
                    isStudio,
                    activeAudioSrc, // Also pass audio src for widgets
                    crossfadeDuration
                };

                switch (layer.type) {
                    case 'video': return <VideoLayer key={layer.id} {...commonProps} />;
                    case 'image': return <ImageLayer key={layer.id} {...commonProps} />;
                    default: return null;
                }
            })}
        </Group>
    );
};
