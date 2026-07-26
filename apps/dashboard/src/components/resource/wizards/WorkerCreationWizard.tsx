import React from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useWizardProgress, WizardSession } from '@/hooks/useWizardProgress';
import WizardDialog from './WizardDialog';
import { ShieldAlert, Globe, UserPlus, PlayCircle, Eye, Server, Key, FileJson } from 'lucide-react';

interface WorkerCreationWizardProps {
    session: WizardSession | undefined;
    isOpen: boolean;
    onClose: () => void;
}

interface TaskDef {
    id: string;
    title: string;
    description: React.ReactNode;
    icon: React.ReactNode;
    badge?: string;
}

const WORKER_TASKS: Record<number, TaskDef[]> = {
    1: [
        {
            id: 'factory_reset',
            title: '휴대폰 공장 초기화 (Factory Reset)',
            description: '이전에 사용된 구글 계정이나 활동 기록을 완전히 지우기 위해 휴대폰을 공장 초기화해주세요. 초기화 후 언어 설정을 바로 "영어(English)"로 설정하면 더 안전합니다.',
            icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
            badge: '필수/Essential'
        },
        {
            id: 'ip_change',
            title: 'IP 변경 (LTE/5G 데이터 사용)',
            description: '와이파이(Wi-Fi)를 끄고, LTE/5G 데이터를 껐다 켜서 새로운 IP를 할당받으세요. 비행기 모드를 5초간 켰다 끄면 IP가 변경됩니다.',
            icon: <Globe className="w-5 h-5 text-blue-500" />,
            badge: '중요'
        },
        {
            id: 'create_account',
            title: '새 구글 계정 생성 (로그인 건너뛰기)',
            description: '새로운 구글 계정을 생성하세요. *주의: 전화번호 인증을 요구하면 다른 기기나 IP를 시도해보세요. 계정 생성 직후에는 유튜브 앱에 바로 로그인하지 마세요.*',
            icon: <UserPlus className="w-5 h-5 text-green-500" />,
        },
    ],
    2: [
        {
            id: 'login_youtube',
            title: '유튜브 로그인 및 알고리즘 탐색',
            description: '이제 유튜브 앱에 로그인하세요. 검색창에 관심 있는 키워드(예: tech, news)를 검색하고 영상을 시청하여 알고리즘을 학습시킵니다.',
            icon: <PlayCircle className="w-5 h-5 text-red-600" />,
        },
        {
            id: 'watch_verify',
            title: '영상 3개 시청 및 좋아요',
            description: '3분 이상의 영상을 3개 이상 시청하고 "좋아요"를 누르세요. 너무 빠르게 넘기면 봇으로 의심받을 수 있습니다.',
            icon: <Eye className="w-5 h-5 text-slate-500" />,
            badge: 'Warm-up'
        },
    ],
    3: [
        {
            id: 'gcp_project',
            title: '구글 클라우드 플랫폼(GCP) 프로젝트 생성',
            description: 'Google Cloud Console(console.cloud.google.com)에 접속하여 새 프로젝트를 생성하세요. 프로젝트 이름은 워커 이름과 비슷하게 설정하면 관리하기 편합니다.',
            icon: <Server className="w-5 h-5 text-blue-600" />,
        },
        {
            id: 'enable_api',
            title: 'YouTube Data API v3 활성화',
            description: 'API 라이브러리에서 "YouTube Data API v3"를 검색하고 [사용(Enable)] 버튼을 누르세요.',
            icon: <PlayCircle className="w-5 h-5 text-red-500" />, // Using PlayCircle as PlaySquare substitute
        },
        {
            id: 'create_consent',
            title: 'OAuth 동의 화면 구성',
            description: 'OAuth 동의 화면 설정에서 "External(외부)"을 선택하고, 필수 정보(앱 이름, 이메일)만 입력하여 저장하세요. 테스트 사용자에 본인 이메일을 추가할 필요는 없습니다.',
            icon: <ShieldAlert className="w-5 h-5 text-orange-500" />,
        }
    ],
    4: [
        {
            id: 'create_credentials',
            title: 'OAuth 클라이언트 ID 생성',
            description: '사용자 인증 정보(Credentials) > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID를 선택하세요. 애플리케이션 유형은 "데스크톱 앱(Desktop App)"을 선택하세요.',
            icon: <Key className="w-5 h-5 text-yellow-500" />,
        },
        {
            id: 'upload_secret',
            title: 'Client Secret 다운로드 및 업로드',
            description: '생성된 JSON 파일을 다운로드(client_secret_....json) 받고, ViraLoop의 "리소스 커맨드 센터" 설정 페이지에 업로드하세요.',
            icon: <FileJson className="w-5 h-5 text-slate-600" />,
            badge: 'Final Step'
        }
    ]
};

const WorkerCreationWizard: React.FC<WorkerCreationWizardProps> = ({ session, isOpen, onClose }) => {
    const { toggleTask, completeDay } = useWizardProgress();

    if (!session) return null;

    const currentTasks = WORKER_TASKS[session.currentDay] || [];
    const completedTasks = session.completedTasks || [];
    const isDayOne = session.currentDay === 1;

    // Check if all tasks for the current day are completed
    const canComplete = currentTasks.every(task => completedTasks.includes(task.id));

    return (
        <WizardDialog
            session={session}
            isOpen={isOpen}
            onClose={onClose}
            onCompleteDay={() => completeDay(session.id)}
            canComplete={canComplete}
        >
            {isDayOne && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 mb-4 animate-in fade-in slide-in-from-top-2">
                    <p className="font-bold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> 경고: 로그인은 나중에!
                    </p>
                    <p className="mt-1">
                        1일차에는 절대 로그인하지 마세요. 구글은 기기 초기화 직후의 로그인 시도를 의심스럽게 봅니다.
                        계정만 생성하고 하루 정도 기기를 방치하는 것이 가장 안전합니다.
                    </p>
                </div>
            )}

            <Accordion type="multiple" defaultValue={currentTasks.map(t => t.id)} className="w-full">
                {currentTasks.map((task) => {
                    const isChecked = completedTasks.includes(task.id);
                    return (
                        <AccordionItem key={task.id} value={task.id} className="border-b-0 mb-4 border rounded-lg bg-white shadow-sm overflow-hidden data-[state=open]:border-blue-200 transition-all">
                            <div className="flex items-center px-4 py-2 hover:bg-slate-50 transition-colors">
                                <Checkbox
                                    id={task.id}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => toggleTask(session.id, task.id, checked === true)}
                                    className="mr-3 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5"
                                />
                                <AccordionTrigger className="hover:no-underline flex-1 py-2">
                                    <div className="flex items-center gap-3 text-left">
                                        {task.icon}
                                        <span className={`font-medium ${isChecked ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                                            {task.title}
                                        </span>
                                        {task.badge && (
                                            <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal">
                                                {task.badge}
                                            </Badge>
                                        )}
                                    </div>
                                </AccordionTrigger>
                            </div>
                            <AccordionContent className="px-12 pb-4 pt-0 text-slate-600 bg-slate-50/30">
                                {task.description}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </WizardDialog>
    );
};

export default WorkerCreationWizard;
