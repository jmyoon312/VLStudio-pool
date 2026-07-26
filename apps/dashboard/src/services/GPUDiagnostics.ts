/**
 * GPU 하드웨어 가속 진단 도구
 * 브라우저 콘솔에서 실행: await diagnoseGPU()
 */

export async function diagnoseGPU() {
    console.log('🔍 GPU 하드웨어 가속 진단 시작...\n');

    // 1. 기본 WebCodecs 지원 확인
    console.log('1️⃣ WebCodecs API 지원 확인:');
    console.log('  VideoEncoder:', 'VideoEncoder' in window ? '✅' : '❌');
    console.log('  VideoDecoder:', 'VideoDecoder' in window ? '✅' : '❌');
    console.log('  VideoFrame:', 'VideoFrame' in window ? '✅' : '❌');
    console.log('  OffscreenCanvas:', 'OffscreenCanvas' in window ? '✅' : '❌');
    console.log('');

    // 2. Chrome GPU 정보 확인
    console.log('2️⃣ Chrome GPU 정보:');
    console.log('  chrome://gpu 페이지를 열어서 확인하세요');
    console.log('  주요 확인 사항:');
    console.log('    - Graphics Feature Status: Hardware accelerated');
    console.log('    - Video Decode: Hardware accelerated');
    console.log('    - Video Encode: Hardware accelerated');
    console.log('');

    // 3. 코덱 지원 테스트
    console.log('3️⃣ H.264 코덱 지원 테스트:');

    const codecs = [
        { codec: 'avc1.42001f', hw: 'prefer-hardware', name: 'H.264 Baseline (GPU 우선)' },
        { codec: 'avc1.42001f', hw: 'prefer-software', name: 'H.264 Baseline (CPU 우선)' },
        { codec: 'avc1.42001f', hw: 'no-preference', name: 'H.264 Baseline (자동)' },
        { codec: 'avc1.4d001f', hw: 'prefer-hardware', name: 'H.264 Main (GPU 우선)' },
        { codec: 'avc1.64001f', hw: 'prefer-hardware', name: 'H.264 High (GPU 우선)' },
    ];

    for (const config of codecs) {
        try {
            const result = await VideoEncoder.isConfigSupported({
                codec: config.codec,
                width: 1280,
                height: 720,
                bitrate: 5_000_000,
                framerate: 30,
                hardwareAcceleration: config.hw as any
            });

            if (result.supported) {
                console.log(`  ✅ ${config.name}`);
                console.log(`     Config:`, result.config);
            } else {
                console.log(`  ❌ ${config.name} - 지원 안 됨`);
            }
        } catch (e) {
            console.log(`  ❌ ${config.name} - 오류:`, e);
        }
    }
    console.log('');

    // 4. 실제 인코더 생성 테스트
    console.log('4️⃣ 실제 인코더 생성 테스트:');

    const testConfigs = [
        { codec: 'avc1.42001f', hw: 'prefer-hardware', name: 'GPU 가속' },
        { codec: 'avc1.42001f', hw: 'no-preference', name: 'CPU/GPU 자동' },
    ];

    for (const config of testConfigs) {
        try {
            const encoder = new VideoEncoder({
                output: () => { },
                error: (e) => console.error('Encoder error:', e)
            });

            encoder.configure({
                codec: config.codec,
                width: 1280,
                height: 720,
                bitrate: 5_000_000,
                framerate: 30,
                hardwareAcceleration: config.hw as any,
                latencyMode: 'quality'
            });

            // 상태 확인
            await new Promise(resolve => setTimeout(resolve, 100));

            if (encoder.state === 'configured') {
                console.log(`  ✅ ${config.name} - 성공`);
                console.log(`     State: ${encoder.state}`);
                encoder.close();
            } else {
                console.log(`  ❌ ${config.name} - 실패 (state: ${encoder.state})`);
            }
        } catch (e: any) {
            console.log(`  ❌ ${config.name} - 오류:`, e.message);
        }
    }
    console.log('');

    // 5. GPU 정보 (가능한 경우)
    console.log('5️⃣ GPU 정보 (WebGL):');
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

        if (gl) {
            const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log(`  GPU Vendor: ${vendor}`);
                console.log(`  GPU Renderer: ${renderer}`);
            } else {
                console.log('  ⚠️ WEBGL_debug_renderer_info 확장 없음');
            }
        } else {
            console.log('  ❌ WebGL 지원 안 됨');
        }
    } catch (e) {
        console.log('  ❌ GPU 정보 가져오기 실패:', e);
    }
    console.log('');

    // 6. 권장 사항
    console.log('6️⃣ 권장 조치:');
    console.log('  1. chrome://gpu 확인');
    console.log('     - Video Encode가 "Hardware accelerated"인지 확인');
    console.log('     - 만약 "Software only"라면:');
    console.log('       → GPU 드라이버 업데이트');
    console.log('       → Chrome 하드웨어 가속 활성화 (chrome://settings/system)');
    console.log('');
    console.log('  2. Chrome 플래그 확인 (chrome://flags)');
    console.log('     - #enable-webcodecs → Enabled');
    console.log('     - #enable-accelerated-video-decode → Enabled');
    console.log('');
    console.log('  3. GPU 드라이버');
    console.log('     - NVIDIA: GeForce Experience로 최신 드라이버 설치');
    console.log('     - AMD: Radeon Software로 최신 드라이버 설치');
    console.log('     - Intel: Intel Driver & Support Assistant 사용');
    console.log('');

    console.log('✅ 진단 완료!');
}

// 전역으로 노출
(window as any).diagnoseGPU = diagnoseGPU;

console.log('💡 GPU 진단 도구 로드됨. 콘솔에서 "await diagnoseGPU()" 실행하세요.');
