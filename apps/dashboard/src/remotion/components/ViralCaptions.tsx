import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export type Word = {
    word: string;
    start: number;
    end: number;
};

export const ViralCaptions: React.FC<{
    words: Word[];
    fontSize?: number;
    primaryColor?: string;
    highlightColor?: string;
}> = ({
    words,
    fontSize = 60,
    primaryColor = "white",
    highlightColor = "#FFD700" // Gold
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    return (
        <div style={{
            position: 'absolute',
            bottom: 250,
            left: 0,
            right: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '0 50px',
            fontFamily: 'Impact, "Noto Sans KR", sans-serif',
            textTransform: 'uppercase',
            textShadow: '3px 3px 0px black, -3px -3px 0px black, 3px -3px 0px black, -3px 3px 0px black',
            letterSpacing: '2px',
            lineHeight: 1.2
        }}>
            {words.map((w, idx) => {
                const isActive = currentTime >= w.start && currentTime <= w.end;
                
                // Pop animation for the active word
                const scale = spring({
                    frame: frame - (w.start * fps),
                    fps,
                    config: { damping: 10, stiffness: 200 },
                    from: 1,
                    to: isActive ? 1.3 : 1
                });

                return (
                    <span
                        key={idx}
                        style={{
                            display: 'inline-block',
                            margin: '0 10px',
                            fontSize: fontSize,
                            color: isActive ? highlightColor : primaryColor,
                            transform: `scale(${scale})`,
                            transition: 'color 0.1s ease-out'
                        }}
                    >
                        {w.word}
                    </span>
                );
            })}
        </div>
    );
};
