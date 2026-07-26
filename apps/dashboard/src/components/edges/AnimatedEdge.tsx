import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow';
import useNodeStore from '../../hooks/useNodeStore';

export default function AnimatedEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    source,
    target,
    selected
}: EdgeProps) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const { mode, nodes } = useNodeStore();

    // Logic: Is this connection "active"?
    // In Op Mode, animate if the Target Channel is UPLOADING
    const targetNode = nodes.find(n => n.id === target);
    const isUploading = targetNode?.data.upload_status === 'UPLOADING';

    const isAnimated = mode === 'op' && isUploading;

    // Style Logic
    const strokeColor = selected || isAnimated ? '#3b82f6' : '#94a3b8';
    const strokeWidth = selected ? 3 : 2; // Thicker when selected

    return (
        <>
            {/* Invisible wider path for easier clicking */}
            <BaseEdge path={edgePath} style={{ strokeWidth: 20, stroke: 'transparent' }} />

            <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth, stroke: strokeColor }} />
            {isAnimated && (
                <circle r="4" fill="#3b82f6">
                    <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
                </circle>
            )}
        </>
    );
}
