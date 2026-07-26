import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export type SubtitleData = {
    text: string;
    position?: { top?: number | string; bottom?: number | string; left?: number | string };
    style?: React.CSSProperties;
    animationType?: 'fadeUp' | 'popIn' | 'typewriter';
};

export const SubtitleOverlay: React.FC<SubtitleData> = ({
    text,
    position = { bottom: 100, left: '50%' },
    style = {},
    animationType = 'popIn'
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Default Style: Centered horizontally if left is 50%
    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        ...position,
        transform: position.left === '50%' ? 'translateX(-50%)' : undefined,
        textAlign: 'center',
        padding: '10px 20px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: 'white',
        fontSize: 40,
        fontWeight: 'bold',
        fontFamily: 'HeirofLightOTF, "Noto Sans KR", sans-serif',
        whiteSpace: 'pre-wrap',
        zIndex: 10,
        ...style, // Override with props
    };

    // Animation Logic
    let animStyle: React.CSSProperties = {};

    if (animationType === 'popIn') {
        const scale = spring({
            frame,
            fps,
            config: { damping: 10 },
            from: 0,
            to: 1
        });
        animStyle = { transform: `${baseStyle.transform || ''} scale(${scale})` };
    }
    else if (animationType === 'fadeUp') {
        const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
        const translateY = interpolate(frame, [0, 10], [20, 0], { extrapolateRight: 'clamp' });
        animStyle = {
            opacity,
            transform: `${baseStyle.transform || ''} translateY(${translateY}px)`
        };
    }

    return (
        <div style={{ ...baseStyle, ...animStyle }}>
            {text}
        </div>
    );
};
