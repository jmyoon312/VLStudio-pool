import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, AlertCircle } from "lucide-react";
import axios from 'axios';
import { Scene } from '../store/useLofiStudioStore';

interface RenderVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    scene: Scene | null;
}

export const RenderVideoModal: React.FC<RenderVideoModalProps> = ({ isOpen, onClose, scene }) => {
    const [hours, setHours] = useState(1);
    const [minutes, setMinutes] = useState(0);
    const [status, setStatus] = useState<'idle' | 'rendering' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const [outputPath, setOutputPath] = useState<string>('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setTaskId(null);
            setProgress(0);
            setErrorMsg('');
            setDownloadUrl('');
            setOutputPath('');
        }
    }, [isOpen]);

    // Poll status
    useEffect(() => {
        let interval: any;
        if (status === 'rendering' && taskId) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`/api/render/status/${taskId}`);
                    const taskState = res.data.status;

                    if (taskState === 'COMPLETED') {
                        setStatus('completed');
                        const absPath = res.data.output_path || '';
                        setOutputPath(absPath);

                        const filename = absPath.split(/[\\/]/).pop();
                        if (filename) {
                            // Backend saves to 'downloads/rendered' which is mounted to '/files'
                            // So URL should be /files/rendered/{filename}

                            // Prefer output_filename from response if available, else derive
                            let filename = res.data.output_filename;
                            if (!filename && res.data.output_path) {
                                filename = res.data.output_path.split(/[\\/]/).pop();
                            }

                            if (filename) {
                                if (!filename.endsWith('.mp4')) filename += '.mp4';
                                setDownloadUrl(`/files/rendered/${filename}`);
                            }
                        }
                    } else if (taskState === 'FAILED') {
                        setStatus('error');
                        setErrorMsg(res.data.error || 'Render failed on server.');
                    } else if (taskState === 'PROCESSING') {
                        setProgress(res.data.progress || 0);
                    }
                } catch (e) {
                    // ignore transient error
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [status, taskId]);

    const handleStartRender = async () => {
        if (!scene) return;
        setStatus('rendering');
        setErrorMsg('');
        setProgress(0);
        setOutputPath('');

        try {
            const totalMinutes = (hours * 60) + minutes;
            if (totalMinutes <= 0) {
                setErrorMsg("Duration must be greater than 0.");
                setStatus('idle');
                return;
            }

            const res = await axios.post('/api/render/generate', {
                scene: scene,
                playlist: scene.playlist.map(t => ({ ...t, file_path: t.filePath || t.src })),
                duration_minutes: totalMinutes,
                output_filename: `render_${Date.now()}`,
                crossfade_duration: scene.crossfadeDuration ?? 1.0
            });

            setTaskId(res.data.task_id);

        } catch (e: any) {
            setStatus('error');
            setErrorMsg(e.message || "Failed to start render");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>영상 추출 (Video Export)</DialogTitle>
                    <DialogDescription>
                        현재 씬과 플레이리스트를 반복하여 긴 영상을 생성합니다.
                    </DialogDescription>
                </DialogHeader>

                {status === 'idle' && (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>시간 (Hours)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={hours}
                                    onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>분 (Minutes)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            예상 길이: {hours}시간 {minutes}분
                        </p>
                        <p className="text-xs text-blue-600">
                            💡 배경 비디오가 반복되고 플레이리스트 음악이 믹싱됩니다.
                        </p>
                    </div>
                )}

                {status === 'rendering' && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm font-medium">영상을 생성하고 있습니다...</p>
                        {progress > 0 && (
                            <div className="w-full max-w-xs">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>진행률</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-slate-600">서버에서 FFmpeg로 렌더링 중입니다. 창을 닫아도 작업은 계속됩니다.</p>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="py-6 flex flex-col items-center space-y-4">
                        <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                            <Download className="h-6 w-6" />
                        </div>
                        <p className="text-lg font-bold text-green-700">생성 완료!</p>

                        <div className="w-full bg-gray-50 p-3 rounded text-sm break-all font-mono border">
                            {downloadUrl.replace("/files/rendered/", "Saved to: .../rendered/")}
                        </div>

                        <Button
                            className="w-full"
                            variant="outline"
                            onClick={async () => {
                                try {
                                    // Robust Logic: Use absolute path if available (like Gallery), else absolute fallback text logic
                                    // Logic: backend open-folder takes 'path'. It resolves relative to project root or absolute.
                                    // Gallery sends: "C:/.../file.mp4" (and slices filename).
                                    // We now have 'outputPath' (absolute path to file).
                                    const pathToSend = outputPath ? outputPath : 'downloads/rendered';

                                    // If strictly file path, backend logic in Gallery strips filename. 
                                    // Here let's mimic Gallery: send the folder of the file if possible.
                                    // If outputPath is "C:/.../foo.mp4", send "C:/.../".
                                    // Wait, Gallery sends 'dirPath' in openFolder helper.
                                    // Backend handles full path by opening parent? No, Gallery strips it on frontend.
                                    // Let's strip it here too if it ends in .mp4 or has extension
                                    let dirPath = pathToSend;
                                    if (dirPath.toLowerCase().endsWith('.mp4')) {
                                        const lastSlash = Math.max(dirPath.lastIndexOf('/'), dirPath.lastIndexOf('\\'));
                                        if (lastSlash !== -1) dirPath = dirPath.substring(0, lastSlash);
                                    }

                                    await axios.post('/api/system/open-folder', { path: dirPath });
                                } catch (e) {
                                    alert("폴더 열기 실패. (탐색기에서 'downloads/rendered'를 확인하세요)");
                                }
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                            폴더 열기
                        </Button>

                        <Button className="w-full" asChild variant="secondary">
                            <a href={downloadUrl} download>
                                <Download className="mr-2 h-4 w-4" />
                                파일 직접 다운로드 (브라우저)
                            </a>
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="py-6 text-center space-y-2">
                        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                        <p className="text-red-600 font-bold">오류 발생</p>
                        <p className="text-sm text-gray-600">{errorMsg}</p>
                    </div>
                )}

                <DialogFooter>
                    {status === 'idle' && (
                        <Button onClick={handleStartRender} className="w-full">
                            생성 시작
                        </Button>
                    )}
                    {status === 'rendering' && (
                        <Button disabled className="w-full">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            렌더링 중...
                        </Button>
                    )}
                    {(status === 'completed' || status === 'error') && (
                        <Button onClick={onClose} className="w-full">
                            닫기
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
