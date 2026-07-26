import React, { useRef } from 'react';
import { Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { Layer } from '../../store/useLofiStudioStore';

interface TextLayerProps {
    layer: Layer;
    onSelect?: () => void;
    onChange?: (newAttrs: Partial<Layer>) => void;
    onDblClick?: () => void;
}

export const TextLayer = ({ layer, onSelect, onChange, onDblClick }: TextLayerProps) => {
    const shapeRef = useRef<Konva.Text>(null);

    if (!layer.visible) return null;

    return (
        <KonvaText
            id={layer.id}
            name={layer.id}
            text={layer.text || ''}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            fontSize={layer.fontSize || 24}
            fontFamily={layer.fontFamily || 'Arial'}
            fill={layer.fill || '#000000'}
            align={layer.textAlign || 'left'}
            fontStyle={layer.fontStyle || 'normal'}
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

                // Reset scale and update fontSize/width directly
                node.scaleX(1);
                node.scaleY(1);

                onChange?.({
                    x: node.x(),
                    y: node.y(),
                    rotation: node.rotation(),
                    fontSize: (layer.fontSize || 24) * scaleX,
                    width: node.width() * scaleX
                });
            }}
        />
    );
};
