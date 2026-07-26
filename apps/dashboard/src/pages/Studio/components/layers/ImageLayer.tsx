import React, { useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { Layer } from '../../store/useLofiStudioStore';

interface ImageLayerProps {
    layer: Layer;
    onSelect?: () => void;
    onChange?: (newAttrs: Partial<Layer>) => void;
    onDblClick?: () => void;
}

export const ImageLayer = ({ layer, onSelect, onChange, onDblClick }: ImageLayerProps) => {
    // Only load if src exists. 'anonymous' is for CORS (crucial for exports)
    const [image] = useImage(layer.src || '', 'anonymous');
    const shapeRef = useRef<Konva.Image>(null);

    if (!layer.visible) return null;

    return (
        <KonvaImage
            id={layer.id}
            name={layer.id}
            image={image}
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
                    y: e.target.y(),
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
        />
    );
};
