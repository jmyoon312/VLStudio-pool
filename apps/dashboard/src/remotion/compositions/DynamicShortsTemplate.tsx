import React from 'react';
import { AbsoluteFill, Video, Sequence } from 'remotion';
import { z } from 'zod';
import { SubtitleOverlay } from '../components/SubtitleOverlay';

// Zod Schema for Validation
export const DynamicShortsSchema = z.object({
    topBar: z.object({
        height: z.number(),
        backgroundColor: z.string(),
        text: z.string().optional(),
        textStyle: z.record(z.any()).optional()
    }).optional(),

    bottomBar: z.object({
        height: z.number(),
        backgroundColor: z.string()
    }).optional(),

    mainVideo: z.object({
        src: z.string(),
        scaleMode: z.enum(['fit', 'fill', '1:1']),
        volume: z.number().optional()
    }),

    // Subtitles array
    subtitles: z.array(z.object({
        text: z.string(),
        startFrame: z.number(),
        durationFrames: z.number(),
        position: z.any().optional(),
        style: z.any().optional(),
        animationType: z.any().optional()
    })).optional()
});

export const DynamicShortsTemplate: React.FC<z.infer<typeof DynamicShortsSchema>> = ({
    topBar,
    bottomBar,
    mainVideo,
    subtitles = []
}) => {

    const videoContainerStyle: React.CSSProperties = {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative'
    };

    let videoStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    };

    if (mainVideo.scaleMode === 'fit') {
        videoStyle.objectFit = 'contain';
    }

    return (
        <AbsoluteFill style={{ backgroundColor: 'white', flexDirection: 'column' }}>

            {/* Top Bar */}
            {topBar && (
                <div style={{
                    height: topBar.height,
                    backgroundColor: topBar.backgroundColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    color: 'white', // Default text color
                    fontSize: '32px',
                    fontWeight: 'bold'
                }}>
                    {topBar.text && (
                        <h1 style={{ margin: 0, ...topBar.textStyle }}>{topBar.text}</h1>
                    )}
                </div>
            )}

            {/* Main Video Area */}
            <div style={videoContainerStyle}>
                {mainVideo.scaleMode === '1:1' ? (
                    <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative' }}>
                        <Video
                            src={mainVideo.src}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            volume={mainVideo.volume}
                        />
                    </div>
                ) : (
                    <Video src={mainVideo.src} style={videoStyle} volume={mainVideo.volume} />
                )}
            </div>

            {/* Bottom Bar */}
            {bottomBar && (
                <div style={{
                    height: bottomBar.height,
                    backgroundColor: bottomBar.backgroundColor,
                    zIndex: 2
                }} />
            )}

            {/* Subtitles Overlay Layer (Using Sequence for Logic) */}
            {subtitles && subtitles.map((sub, idx) => (
                <Sequence key={idx} from={sub.startFrame} durationInFrames={sub.durationFrames}>
                    <SubtitleOverlay
                        text={sub.text}
                        position={sub.position}
                        style={sub.style}
                        animationType={sub.animationType}
                    />
                </Sequence>
            ))}

        </AbsoluteFill>
    );
};
