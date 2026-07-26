import React from 'react';
import { AbsoluteFill, Sequence, Audio, Video, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';

// --- Zod Schema ---
export const UniversalVideoSchema = z.object({
    title: z.string(),
    clips: z.array(z.object({
        type: z.enum(['video', 'image', 'text']),
        src: z.string().optional(),
        text: z.string().optional(),
        durationInFrames: z.number(),
        style: z.record(z.any()).optional(),
    })),
    audio: z.object({
        src: z.string(),
        volume: z.number(),
    }),
    subtitles: z.array(z.object({
        start: z.number(), // in seconds
        end: z.number(),   // in seconds
        text: z.string(),
    })),
});

type UniversalVideoProps = z.infer<typeof UniversalVideoSchema>;

// --- Components ---
const SubtitleOverlay: React.FC<{ subtitles: UniversalVideoProps['subtitles'] }> = ({ subtitles }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    const currentSubtitle = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);

    if (!currentSubtitle) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: 100,
            width: '100%',
            textAlign: 'center',
            fontSize: 60,
            fontFamily: 'Arial', // Fallback font
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
        }}>
            {currentSubtitle.text}
        </div>
    );
};

export const UniversalVideo: React.FC<UniversalVideoProps> = ({ title, clips, audio, subtitles }) => {
    let currentStart = 0;

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* 1. Visual Track */}
            {clips.map((clip, index) => {
                const start = currentStart;
                currentStart += clip.durationInFrames;

                return (
                    <Sequence key={index} from={start} durationInFrames={clip.durationInFrames}>
                        {clip.type === 'video' && clip.src && <Video src={clip.src} style={{ width: '100%', height: '100%', objectFit: 'cover', ...clip.style }} />}
                        {clip.type === 'image' && clip.src && <Img src={clip.src} style={{ width: '100%', height: '100%', objectFit: 'cover', ...clip.style }} />}
                        {clip.type === 'text' && (
                            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', ...clip.style }}>
                                <h1 style={{ color: 'white', fontSize: 80, fontFamily: 'Arial' }}>{clip.text}</h1>
                            </AbsoluteFill>
                        )}
                    </Sequence>
                );
            })}

            {/* 2. Audio Track (Background) */}
            {audio && audio.src && (
                <Audio src={audio.src} volume={audio.volume} />
            )}

            {/* 3. Title Overlay (Intro) */}
            <Sequence from={0} durationInFrames={90}>
                <div style={{
                    position: 'absolute',
                    top: 50,
                    left: 50,
                    fontSize: 40,
                    color: 'white',
                    fontWeight: 'bold',
                    opacity: 0.8
                }}>
                    {title}
                </div>
            </Sequence>

            {/* 4. Subtitles Overlay */}
            <SubtitleOverlay subtitles={subtitles} />
        </AbsoluteFill>
    );
};
