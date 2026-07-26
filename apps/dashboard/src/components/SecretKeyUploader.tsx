import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileJson, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import GoogleAuthGuide from './GoogleAuthGuide';

interface SecretKeyUploaderProps {
    isConfigured: boolean;
    onUploadSuccess: () => void;
}

const SecretKeyUploader: React.FC<SecretKeyUploaderProps> = ({ isConfigured, onUploadSuccess }) => {
    const { toast } = useToast();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/auth/config/secrets', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast({
                title: "설정 완료!",
                description: "시크릿 키가 성공적으로 업데이트되었습니다."
            });
            onUploadSuccess();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "업로드 실패",
                description: "올바른 JSON 파일인지 확인해주세요."
            });
        }
    }, [onUploadSuccess, toast]);

    const handleDelete = async () => {
        if (!confirm("정말 인증 키를 삭제하시겠습니까? 다시 설정해야 합니다.")) return;
        try {
            await api.delete('/auth/config/secrets');
            toast({ title: "삭제 완료", description: "설정이 초기화되었습니다." });
            onUploadSuccess(); // Reload parent state
        } catch (e) {
            toast({ variant: "destructive", title: "오류", description: "삭제 실패" });
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/json': ['.json'] },
        maxFiles: 1
    });

    if (isConfigured) {
        return (
            <div className="bg-white border border-green-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-green-800">시스템 설정 완료</h3>
                        <p className="text-xs text-green-700">Google OAuth 인증 키가 정상적으로 로드되었습니다.</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <GoogleAuthGuide />
                    <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <Button variant="outline" size="sm" className="text-xs h-8">
                            <Upload className="w-3 h-3 mr-2" /> 키 교체하기
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleDelete} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <ShieldAlert className="w-32 h-32 text-amber-500" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" /> 1단계: 인증 설정 마법사
                        </h3>
                        <p className="text-sm text-amber-800 max-w-lg leading-relaxed">
                            ViraLoop가 유튜브 채널에 접근하기 위해서는 <strong>Google Cloud Console</strong>에서 발급받은
                            <code>client_secret.json</code> 파일이 필요합니다.
                        </p>
                    </div>
                    <GoogleAuthGuide />
                </div>

                <div
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                        ${isDragActive ? 'border-amber-500 bg-amber-100' : 'border-amber-300 bg-white/50 hover:bg-white/80'}
                    `}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-amber-100 rounded-full">
                            <FileJson className="w-8 h-8 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">
                                {isDragActive ? '여기에 파일을 놓으세요' : 'client_secret.json 파일을 여기에 드래그하세요'}
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                                또는 클릭하여 파일을 선택할 수 있습니다
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex gap-4 text-xs text-amber-700">
                    <a
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-amber-900"
                    >
                        Google Cloud Console 바로가기 ↗
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SecretKeyUploader;
