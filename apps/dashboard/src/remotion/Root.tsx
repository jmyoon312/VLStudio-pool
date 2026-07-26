import React from 'react';
import { Composition } from 'remotion';
import { UniversalVideo, UniversalVideoSchema } from './compositions/UniversalVideo';
import { DynamicShortsTemplate, DynamicShortsSchema } from './compositions/DynamicShortsTemplate';
import { AIMovie, AIMovieSchema } from './compositions/AIMovie';
import { SovereignShorts, SovereignShortsSchema } from './compositions/SovereignShorts';
import { EliteSequence, EliteSequenceSchema } from './compositions/EliteSequence';

// Mock Data for Universal Video
const defaultProps = {
    title: "ViraLoop 3.0 Preview",
    clips: [
        { type: "text", text: "Intro Scene", durationInFrames: 90, style: { backgroundColor: '#3b82f6' } },
        { type: "image", src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?ixlib=rb-1.2.1&auto=format&fit=crop&w=1280&q=80", durationInFrames: 150 },
        { type: "text", text: "The End", durationInFrames: 60, style: { backgroundColor: '#ef4444' } }
    ],
    audio: {
        src: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/WFMU/Broke_For_Free/Directionless_EP/Broke_For_Free_-_01_-_Night_Owl.mp3",
        volume: 0.5
    },
    subtitles: [
        { start: 0, end: 3, text: "Welcome to ViraLoop" },
        { start: 3, end: 6, text: "This is AI-Generated Video" },
        { start: 6, end: 8, text: "Powered by Remotion" }
    ]
};

// Mock Data for Dynamic Shorts
const dynamicShortsDefaultProps = {
    topBar: {
        height: 150,
        backgroundColor: "black",
        text: "🔥 NEW SHORT!",
        textStyle: { color: "white", fontSize: "40px", fontWeight: "bold" }
    },
    bottomBar: {
        height: 150,
        backgroundColor: "black"
    },
    mainVideo: {
        src: "https://joy1.videvo.net/videvo_files/video/free/2019-11/large_watermarked/190301_1_25_11_preview.mp4",
        scaleMode: "1:1",
        volume: 1
    },
    subtitles: [
        {
            text: "This is a 1:1 Dynamic Template!",
            startFrame: 0,
            durationFrames: 60,
            position: { bottom: 200, left: '50%' },
            animationType: "popIn"
        },
        {
            text: "Perfect for Social Media!",
            startFrame: 60,
            durationFrames: 60,
            position: { bottom: 200, left: '50%' },
            animationType: "fadeUp"
        }
    ]
};

// Mock Data for Sovereign Shorts
const sovereignShortsDefaultProps = {
    backgroundVideo: "https://joy1.videvo.net/videvo_files/video/free/2019-11/large_watermarked/190301_1_25_11_preview.mp4",
    syncVideo: "https://your-server.com/static/actors/korean_female_01.mp4",
    title: "ViraLoop Sovereign AI",
    words: [
        { word: "Sovereign", start: 0, end: 1 },
        { word: "Intelligence", start: 1, end: 2 },
        { word: "is", start: 2, end: 2.5 },
        { word: "here", start: 2.5, end: 3 }
    ]
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="EliteSequence"
                component={EliteSequence}
                durationInFrames={900} // Default 30s
                fps={30}
                width={1080}
                height={1920}
                schema={EliteSequenceSchema}
                defaultProps={{ beats: [], audio_src: '', bgm_src: '', aspect_ratio: '9:16' } as any}
            />
            <Composition
                id="UniversalVideo"
                component={UniversalVideo}
                durationInFrames={300}
                fps={30}
                width={1920}
                height={1080}
                schema={UniversalVideoSchema}
                defaultProps={defaultProps as any}
            />

            <Composition
                id="DynamicShorts"
                component={DynamicShortsTemplate}
                durationInFrames={150}
                fps={30}
                width={1080}
                height={1920}
                schema={DynamicShortsSchema}
                defaultProps={dynamicShortsDefaultProps as any}
            />

            <Composition
                id="AIMovie"
                component={AIMovie}
                durationInFrames={900} // Default 30s
                fps={30}
                width={1280}
                height={720}
                schema={AIMovieSchema}
                defaultProps={{ scenes: [] } as any}
            />

            <Composition
                id="SovereignShorts"
                component={SovereignShorts}
                durationInFrames={450} // 15s
                fps={30}
                width={1080}
                height={1920}
                schema={SovereignShortsSchema}
                defaultProps={sovereignShortsDefaultProps as any}
            />
        </>
    );
};
