import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useGLTF } from '@react-three/drei';
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MotionCapture } from '../utils/mocap';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Camera, Video, Upload, Loader2, AlertCircle } from 'lucide-react';
import * as THREE from 'three';

// --- Avatar Component ---
const Avatar = ({ url, rig }: { url: string, rig: any }) => {
    const { scene } = useLoader(GLTFLoader, url, (loader) => {
        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });
    });

    const vrmRef = useRef<any>(null);

    useEffect(() => {
        if (scene) {
            // VRMUtils.removeUnnecessaryVertices(scene);
            // VRMUtils.removeUnnecessaryJoints(scene);

            // Get VRM instance
            if (scene.userData.vrm) {
                vrmRef.current = scene.userData.vrm;
                vrmRef.current.scene.rotation.y = Math.PI; // Face forward
                console.log("VRM Loaded", vrmRef.current);
            }
        }
    }, [scene]);

    useFrame((state, delta) => {
        if (vrmRef.current) {
            const vrm = vrmRef.current;
            vrm.update(delta);

            if (rig) {
                // Apply Rig (Simplified for demo)
                if (rig.face) {
                    const face = rig.face;
                    if (face.head) {
                        vrm.humanoid.getNormalizedBoneNode('neck').rotation.set(face.head.x, face.head.y, face.head.z);
                    }
                    if (face.mouth && face.mouth.shape) {
                        vrm.expressionManager.setValue('aa', face.mouth.shape.A || 0);
                        vrm.expressionManager.setValue('ih', face.mouth.shape.I || 0);
                        vrm.expressionManager.setValue('ou', face.mouth.shape.U || 0);
                        vrm.expressionManager.setValue('ee', face.mouth.shape.E || 0);
                        vrm.expressionManager.setValue('oh', face.mouth.shape.O || 0);
                    }
                }
            }
        }
    });

    return <primitive object={scene} />;
};

// --- Main Studio Component ---
const VirtualStudio = () => {
    const [vrmUrl, setVrmUrl] = useState<string | null>(null);
    const [webcamEnabled, setWebcamEnabled] = useState(false);
    const [rig, setRig] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mocapRef = useRef<MotionCapture | null>(null);

    useEffect(() => {
        if (webcamEnabled) {
            startWebcam();
        } else {
            stopWebcam();
        }
        return () => stopWebcam();
    }, [webcamEnabled]);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();

                try {
                    mocapRef.current = new MotionCapture((result) => {
                        setRig(result);
                    });

                    const loop = async () => {
                        if (videoRef.current && mocapRef.current && webcamEnabled) {
                            await mocapRef.current.send(videoRef.current);
                            requestAnimationFrame(loop);
                        }
                    };
                    loop();
                } catch (e) {
                    console.error("Mocap init failed", e);
                    setError("모션 캡처 초기화 실패 (Mocap Init Failed)");
                }
            }
        } catch (e) {
            console.error("Webcam failed", e);
            setError("웹캠 접근 실패 (Webcam Access Failed)");
            setWebcamEnabled(false);
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        if (mocapRef.current) {
            mocapRef.current.close();
            mocapRef.current = null;
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            setVrmUrl(url);
            setError(null);
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 p-6">
                <AlertCircle className="w-6 h-6 mr-2" />
                <span>{error}</span>
                <Button variant="outline" size="sm" className="ml-4" onClick={() => setError(null)}>닫기</Button>
            </div>
        );
    }

    return (
        <div className="w-full h-[80vh] relative bg-card rounded-xl overflow-hidden shadow-2xl border border-border">
            {/* 3D Canvas */}
            <Canvas camera={{ position: [0, 1.5, 2], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[1, 2, 3]} intensity={1} />
                <Environment preset="studio" />

                <Suspense fallback={<Html center><div className="text-foreground flex items-center"><Loader2 className="animate-spin mr-2" /> 3D 로딩중...</div></Html>}>
                    {vrmUrl ? <Avatar url={vrmUrl} rig={rig} /> : (
                        <Html center>
                            <div className="text-muted-foreground text-center">
                                <p className="mb-2">VRM 아바타 파일을 업로드해주세요</p>
                                <p className="text-xs opacity-50">(.vrm 파일)</p>
                            </div>
                        </Html>
                    )}
                    <gridHelper args={[10, 10]} />
                </Suspense>

                <OrbitControls target={[0, 1, 0]} />
            </Canvas>

            {/* UI Overlay */}
            <div className="absolute top-4 left-4 w-80 space-y-4">
                <Card className="p-4 bg-card/90 backdrop-blur shadow-lg border-border">
                    {/* Neural Rig Interface */}

                    <div className="space-y-4">
                        {/* Avatar Upload */}
                        <div>
                            <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">아바타 파일 (.vrm)</label>
                            <div className="flex gap-2">
                                <input type="file" accept=".vrm" onChange={handleFileChange} className="text-xs cursor-pointer text-foreground" />
                            </div>
                        </div>

                        {/* Webcam Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-foreground">
                                <Video className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">모션 캡처 (Motion Capture)</span>
                            </div>
                            <Switch checked={webcamEnabled} onCheckedChange={setWebcamEnabled} />
                        </div>
                    </div>
                </Card>

                {/* Webcam Preview */}
                <div className={`relative rounded-lg overflow-hidden border-2 border-primary bg-black transition-all duration-300 ${webcamEnabled ? 'h-48 opacity-100' : 'h-0 opacity-0 border-0'}`}>
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover transform scale-x-[-1]"
                        muted
                        playsInline
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded animate-pulse">
                        LIVE
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VirtualStudio;
