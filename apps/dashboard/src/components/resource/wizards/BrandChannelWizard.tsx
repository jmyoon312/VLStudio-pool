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
import { Tv, Phone, Image, Search, ThumbsUp, Smartphone, UploadCloud, UserPlus, LogOut } from 'lucide-react';

interface BrandChannelWizardProps {
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

const BRAND_TASKS: Record<number, TaskDef[]> = {
    1: [
        {
            id: 'create_channel',
            title: '브랜드 채널 생성',
            description: '유튜브 스튜디오에서 "채널 만들기"를 선택하고 "브랜드 계정"을 선택하세요. 이때 개인 계정을 브랜드 채널로 변환하지 않도록 주의하세요.',
            icon: <Tv className="w-5 h-5 text-purple-600" />,
        },
        {
            id: 'verify_phone',
            title: '전화번호 인증 (필수)',
            description: '채널 설정 > 기능 사용 자격요건 > 중급 기능에서 전화번호 인증을 완료하세요. 이것이 없으면 썸네일 업로드와 15분 이상 영상 업로드가 불가능합니다.',
            icon: <Phone className="w-5 h-5 text-green-600" />,
            badge: 'Critical'
        },
        {
            id: 'profile_setup',
            title: '프로필 및 배너 업로드',
            description: '채널의 신뢰도를 높이기 위해 프로필 사진과 배너 이미지를 반드시 업로드하세요. 비어있는 채널은 스팸으로 분류될 확률이 높습니다.',
            icon: <Image className="w-5 h-5 text-pink-500" />,
        },
    ],
    2: [
        {
            id: 'search_intent',
            title: '경쟁 채널 키워드 검색',
            description: '운영하려는 채널의 주제와 관련된 키워드를 검색하고, 상위에 노출되는 경쟁 채널 3~5개를 찾아 들어가세요.',
            icon: <Search className="w-5 h-5 text-blue-500" />,
        },
        {
            id: 'interaction',
            title: '경쟁 영상 시청 및 좋아요',
            description: '경쟁 채널의 영상을 끝까지 시청하고 좋아요와 구독을 눌러주세요. 이는 유튜브 알고리즘에게 "이 채널은 ~주제에 관심이 있다"는 신호를 줍니다.',
            icon: <ThumbsUp className="w-5 h-5 text-red-500" />,
        },
    ],
    3: [
        {
            id: 'interaction_2',
            title: '관련 커뮤니티 활동 (댓글)',
            description: '관련 영상에 긍정적인 댓글을 1~2개 남기세요. 너무 기계적인 댓글("좋아요", "구독해요")은 피하고 영상 내용에 대한 짧은 감상을 남기세요.',
            icon: <ThumbsUp className="w-5 h-5 text-orange-500" />,
            badge: 'Optional'
        },
    ],
    4: [
        {
            id: 'mobile_upload',
            title: '모바일 앱으로 쇼츠(Shorts) 업로드',
            description: '첫 업로드는 PC보다 모바일 앱에서 하는 것이 신뢰도가 높습니다. 준비된 쇼츠 영상을 모바일 유튜브 앱을 통해 업로드하세요.',
            icon: <Smartphone className="w-5 h-5 text-slate-700" />,
            badge: 'Mobile Only'
        },
        {
            id: 'set_thumbnail',
            title: '썸네일 설정 확인',
            description: '쇼츠 업로드 시 커버 이미지를 선택했는지 확인하세요. 매력적인 썸네일은 클릭률을 높입니다.',
            icon: <Image className="w-5 h-5 text-indigo-500" />,
        }
    ],
    5: [
        {
            id: 'wait_warmup',
            title: '휴식 및 반응 관찰',
            description: '첫 영상 업로드 후 하루 정도는 추가 활동 없이 반응을 지켜보세요. 조회수가 0이어도 정상입니다.',
            icon: <Tv className="w-5 h-5 text-slate-600" />,
        }
    ],
    6: [
        {
            id: 'second_upload',
            title: '두 번째 영상 업로드',
            description: '두 번째 쇼츠 영상을 업로드하세요. 이번에는 예약 업로드 기능을 테스트해보아도 좋습니다.',
            icon: <UploadCloud className="w-5 h-5 text-cyan-600" />,
        }
    ],
    7: [
        {
            id: 'invite_manager',
            title: '워커 계정을 관리자로 초대',
            description: '유튜브 스튜디오 > 설정 > 권한에서 생성해둔 "워커 구글 계정"을 "관리자(Manager)" 또는 "편집자(Editor)"로 초대하세요.',
            icon: <UserPlus className="w-5 h-5 text-green-600" />,
            badge: 'Key Step'
        },
        {
            id: 'logout_master',
            title: '마스터 계정 로그아웃',
            description: '초대 수락이 완료되면, 보안을 위해 메인 브라우저(마스터 계정)에서는 해당 채널 사용을 중지하고 워커 환경에서만 접속하세요.',
            icon: <LogOut className="w-5 h-5 text-red-600" />,
        }
    ]
};

const BrandChannelWizard: React.FC<BrandChannelWizardProps> = ({ session, isOpen, onClose }) => {
    const { toggleTask, completeDay } = useWizardProgress();

    if (!session) return null;

    // Merge Days 2-3 logic if needed, but keeping separate for clear days is better UI
    // If the user wants 2-3 combined visually, we can map multiple days, but simple Day 1, 2, 3... structure is clearer.
    // I will use day mapping from state directly.

    const currentTasks = BRAND_TASKS[session.currentDay] || [];
    const completedTasks = session.completedTasks || [];

    const canComplete = currentTasks.every(task => completedTasks.includes(task.id));

    return (
        <WizardDialog
            session={session}
            isOpen={isOpen}
            onClose={onClose}
            onCompleteDay={() => completeDay(session.id)}
            canComplete={canComplete}
        >
            <Accordion type="multiple" defaultValue={currentTasks.map(t => t.id)} className="w-full">
                {currentTasks.map((task) => {
                    const isChecked = completedTasks.includes(task.id);
                    return (
                        <AccordionItem key={task.id} value={task.id} className="border-b-0 mb-4 border rounded-lg bg-white shadow-sm overflow-hidden data-[state=open]:border-purple-200 transition-all">
                            <div className="flex items-center px-4 py-2 hover:bg-slate-50 transition-colors">
                                <Checkbox
                                    id={task.id}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => toggleTask(session.id, task.id, checked === true)}
                                    className="mr-3 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 w-5 h-5"
                                />
                                <AccordionTrigger className="hover:no-underline flex-1 py-2">
                                    <div className="flex items-center gap-3 text-left">
                                        {task.icon}
                                        <span className={`font-medium ${isChecked ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                                            {task.title}
                                        </span>
                                        {task.badge && (
                                            <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal bg-purple-100 text-purple-700">
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

export default BrandChannelWizard;
