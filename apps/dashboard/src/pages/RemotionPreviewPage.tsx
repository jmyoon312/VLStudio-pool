import React from 'react';
import { Player } from '@remotion/player';
import { UniversalVideo } from '../remotion/compositions/UniversalVideo';

const RemotionPreviewPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-950 p-8 min-h-[calc(100vh-10rem)]">
            <Player
                component={UniversalVideo}
                durationInFrames={300}
                compositionWidth={1920}
                compositionHeight={1080}
                fps={30}
                controls
                style={{
                    width: '80%',
                    aspectRatio: '16/9',
                    borderRadius: '10px',
                    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                }}
                inputProps={{
                    title: "ViraLoop Remotion Test",
                    clips: [
                        {
                            type: 'text',
                            text: "Scene 1: Introduction",
                            durationInFrames: 90,
                            style: { backgroundColor: '#4f46e5' }
                        },
                        {
                            type: 'image',
                            src: "https://images.unsplash.com/photo-1620641788421-7f717dbda5f3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1280&q=80",
                            durationInFrames: 120
                        },
                        {
                            type: 'text',
                            text: "Scene 2: Outro",
                            durationInFrames: 90,
                            style: { backgroundColor: '#dc2626' }
                        }
                    ],
                    audio: {
                        src: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/WFMU/Broke_For_Free/Directionless_EP/Broke_For_Free_-_01_-_Night_Owl.mp3",
                        volume: 0.3
                    },
                    subtitles: [
                        { start: 0.5, end: 2.5, text: "Testing Subtitle 1" },
                        { start: 3.5, end: 6.0, text: "This is a dynamic image scene" },
                        { start: 7.0, end: 9.0, text: "Ending Sequence" }
                    ]
                }}
            />
        </div>
    );
};

export default RemotionPreviewPage;
