import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface RenderConfig {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
}

export interface AudioTrack {
    src: string;
    filePath?: string;
    duration: number;
    volume: number;
    fadeIn?: number;
    fadeOut?: number;
}

export class VideoRenderer {
    private encoder: VideoEncoder | null = null;
    private muxer: Muxer<ArrayBufferTarget> | null = null;
    private config: RenderConfig | null = null;
    public onProgress?: (progress: number) => void;

    /**
     * Initialize the video renderer with configuration
     */
    async initialize(config: RenderConfig): Promise<void> {
        this.config = config;

        // Create MP4 Muxer
        this.muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: config.width,
                height: config.height
            },
            fastStart: 'in-memory'
        });

        // Create Video Encoder
        this.encoder = new VideoEncoder({
            output: (chunk, meta) => {
                this.muxer?.addVideoChunk(chunk, meta);
            },
            error: (e) => {
                console.error('Video encoding error:', e);
                throw e;
            }
        });

        // Try different codec configurations with fallback
        const codecConfigs = [
            {
                codec: 'avc1.42001f', // H.264 Baseline
                hardwareAcceleration: 'no-preference' as const, // Chrome이 자동으로 GPU 선택
                name: 'H.264 Baseline (자동 - GPU 우선)'
            },
            {
                codec: 'avc1.42001f', // H.264 Baseline
                hardwareAcceleration: 'prefer-software' as const,
                name: 'H.264 Baseline (CPU 폴백)'
            }
        ];

        let configured = false;
        let lastError: Error | null = null;

        for (const codecConfig of codecConfigs) {
            try {
                console.log(`🔧 Trying: ${codecConfig.name}`);

                this.encoder.configure({
                    codec: codecConfig.codec,
                    width: config.width,
                    height: config.height,
                    bitrate: config.bitrate,
                    framerate: config.fps,
                    hardwareAcceleration: codecConfig.hardwareAcceleration,
                    latencyMode: 'quality'
                });

                // Wait for encoder to be ready
                let attempts = 0;
                while (this.encoder.state !== 'configured' && attempts < 100) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    attempts++;
                }

                if (this.encoder.state === 'configured') {
                    console.log(`✅ VideoRenderer initialized with ${codecConfig.name}`);
                    console.log('  Encoder state:', this.encoder.state);
                    configured = true;
                    break;
                }
            } catch (e) {
                console.warn(`❌ Failed with ${codecConfig.name}:`, e);
                lastError = e as Error;
                // Try next config
            }
        }

        if (!configured) {
            throw new Error(`Failed to configure VideoEncoder. Last error: ${lastError?.message || 'Unknown'}`);
        }
    }

    /**
     * Render canvas to video file
     */
    async renderCanvas(
        canvas: HTMLCanvasElement,
        durationSeconds: number
    ): Promise<Blob> {
        if (!this.encoder || !this.muxer || !this.config) {
            throw new Error('VideoRenderer not initialized. Call initialize() first.');
        }

        // Check encoder state
        if (this.encoder.state !== 'configured') {
            throw new Error(`VideoEncoder is not ready. State: ${this.encoder.state}`);
        }

        const fps = this.config.fps;
        const totalFrames = Math.floor(durationSeconds * fps);
        const frameDuration = 1000 / fps; // ms per frame

        console.log(`🎬 Starting render: ${totalFrames} frames at ${fps}fps`);
        console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);
        console.log(`📐 Encoder size: ${this.config.width}x${this.config.height}`);

        let frameCount = 0;
        const startTime = Date.now();

        try {
            // Use canvas actual size for offscreen canvas
            const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
            const ctx = offscreen.getContext('2d');

            if (!ctx) {
                throw new Error('Failed to get 2D context');
            }

            // Encode frames with proper timing
            for (let i = 0; i < totalFrames; i++) {
                // Wait for next frame time to allow canvas to update
                const frameStartTime = Date.now();

                // Copy current canvas frame
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(canvas, 0, 0);

                // Create VideoFrame from canvas
                const videoFrame = new VideoFrame(offscreen, {
                    timestamp: i * frameDuration * 1000, // microseconds
                    duration: frameDuration * 1000
                });

                // Encode frame
                this.encoder.encode(videoFrame, {
                    keyFrame: i % 150 === 0 // Keyframe every 5 seconds
                });

                videoFrame.close();
                frameCount++;

                // Update progress every second
                if (frameCount % fps === 0) {
                    const progress = (frameCount / totalFrames) * 100;
                    this.onProgress?.(progress);

                    const elapsed = (Date.now() - startTime) / 1000;
                    const fps_actual = frameCount / elapsed;
                    console.log(`📊 Progress: ${progress.toFixed(1)}% (${fps_actual.toFixed(1)} fps)`);
                }

                // Wait for frame duration to allow canvas animation to update
                const frameElapsed = Date.now() - frameStartTime;
                const waitTime = Math.max(0, frameDuration - frameElapsed);
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }

            // Flush encoder
            await this.encoder.flush();
            console.log('✅ Video encoding complete');

            // Finalize muxer
            this.muxer.finalize();
            const buffer = this.muxer.target.buffer;

            const totalTime = (Date.now() - startTime) / 1000;
            console.log(`🎉 Render complete in ${totalTime.toFixed(1)}s`);

            return new Blob([buffer], { type: 'video/mp4' });

        } catch (error) {
            console.error('❌ Rendering failed:', error);
            throw error;
        }
    }

    /**
     * Check if WebCodecs is supported in current browser
     */
    static isSupported(): boolean {
        const hasVideoEncoder = 'VideoEncoder' in window;
        const hasVideoDecoder = 'VideoDecoder' in window;
        const hasVideoFrame = 'VideoFrame' in window;
        const hasOffscreenCanvas = 'OffscreenCanvas' in window;

        console.log('🔍 WebCodecs Support Check:');
        console.log('  VideoEncoder:', hasVideoEncoder);
        console.log('  VideoDecoder:', hasVideoDecoder);
        console.log('  VideoFrame:', hasVideoFrame);
        console.log('  OffscreenCanvas:', hasOffscreenCanvas);
        console.log('  User Agent:', navigator.userAgent);

        const isSupported = hasVideoEncoder && hasVideoDecoder && hasVideoFrame && hasOffscreenCanvas;

        if (!isSupported) {
            console.error('❌ WebCodecs not fully supported');
            if (!hasVideoEncoder) console.error('  Missing: VideoEncoder');
            if (!hasVideoDecoder) console.error('  Missing: VideoDecoder');
            if (!hasVideoFrame) console.error('  Missing: VideoFrame');
            if (!hasOffscreenCanvas) console.error('  Missing: OffscreenCanvas');
        } else {
            console.log('✅ WebCodecs fully supported');
        }

        return isSupported;
    }

    /**
     * Get supported codecs
     */
    static async getSupportedCodecs(): Promise<string[]> {
        const codecs = [
            'avc1.42001f', // H.264 Baseline
            'avc1.4d001f', // H.264 Main
            'avc1.64001f', // H.264 High
            'hev1.1.6.L93.B0', // H.265
            'av01.0.05M.08' // AV1
        ];

        const supported: string[] = [];

        for (const codec of codecs) {
            try {
                const config = {
                    codec,
                    width: 1280,
                    height: 720,
                    bitrate: 5_000_000,
                    framerate: 30
                };

                const result = await VideoEncoder.isConfigSupported(config);
                if (result.supported) {
                    supported.push(codec);
                }
            } catch (e) {
                // Codec not supported
            }
        }

        return supported;
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        if (this.encoder && this.encoder.state !== 'closed') {
            this.encoder.close();
        }
        this.encoder = null;
        this.muxer = null;
        this.config = null;
    }
}
