import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Flame, Shield, Globe, TrendingUp, Users, Clock } from 'lucide-react';

interface IncubationGuideProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const IncubationGuide: React.FC<IncubationGuideProps> = ({ open, onOpenChange }) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Flame className="w-6 h-6 text-orange-600" />
                        YouTube 계정 인큐베이팅 완전 가이드
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[calc(90vh-100px)] pr-4">
                    <div className="space-y-6">
                        {/* Overview */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">개요</h3>
                            <p className="text-sm text-gray-600">
                                YouTube 브랜드 채널의 안전하고 효과적인 운영을 위한 종합 인큐베이팅 전략입니다.
                                웜업은 가장 중요한 첫 단계이지만, 지속 가능한 계정 운영을 위해서는 다양한 보안 및 운영 전략이 필요합니다.
                            </p>
                        </section>

                        {/* Core Components */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">핵심 구성 요소</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <ComponentCard
                                    icon={<Flame className="w-5 h-5" />}
                                    title="웜업 (Warmup)"
                                    importance="10/10"
                                    description="새로운 계정을 인간처럼 활성화"
                                    color="orange"
                                />
                                <ComponentCard
                                    icon={<Globe className="w-5 h-5" />}
                                    title="IP 로테이션"
                                    importance="9/10"
                                    description="각 채널마다 고유 IP 사용"
                                    color="blue"
                                />
                                <ComponentCard
                                    icon={<Shield className="w-5 h-5" />}
                                    title="프로필 격리"
                                    importance="9/10"
                                    description="독립적인 브라우저 프로필"
                                    color="green"
                                />
                                <ComponentCard
                                    icon={<TrendingUp className="w-5 h-5" />}
                                    title="콘텐츠 전략"
                                    importance="8/10"
                                    description="일관된 업로드 패턴"
                                    color="purple"
                                />
                                <ComponentCard
                                    icon={<Users className="w-5 h-5" />}
                                    title="참여 패턴"
                                    importance="7/10"
                                    description="자연스러운 참여 활동"
                                    color="pink"
                                />
                                <ComponentCard
                                    icon={<Clock className="w-5 h-5" />}
                                    title="휴면 관리"
                                    importance="6/10"
                                    description="장기 미사용 계정 재활성화"
                                    color="gray"
                                />
                            </div>
                        </section>

                        {/* Warmup Process */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">웜업 프로세스 (7일)</h3>
                            <div className="space-y-3">
                                <DayCard
                                    day={1}
                                    title="탐색 (Discovery)"
                                    duration="5-10분"
                                    activities={[
                                        "홈 피드 탐색",
                                        "1-2개 영상 시청 (45-90초)",
                                        "검색 시도 (실패 시)",
                                        "❌ 좋아요/댓글/구독 없음"
                                    ]}
                                    goal="초기 시청 기록 생성, 추천 알고리즘 학습 시작"
                                />
                                <DayCard
                                    day={2}
                                    title="관심사 형성 (Interest Building)"
                                    duration="10-15분"
                                    activities={[
                                        "2-3개 영상 시청 (60-240초)",
                                        "첫 좋아요 (50% 확률)",
                                        "Shorts 3-5개 시청",
                                        "❌ 아직 댓글/구독 없음"
                                    ]}
                                    goal="관심사 프로필 구축, 추천 정확도 향상"
                                />
                                <DayCard
                                    day={3}
                                    title="커뮤니티 참여 (Community Engagement)"
                                    duration="15-20분"
                                    activities={[
                                        "3-4개 영상 시청 (120-300초)",
                                        "좋아요 (70%), 댓글 (50%), 구독 (30%)",
                                        "Shorts 5-7개",
                                        "✅ 커뮤니티 멤버 활동 시작"
                                    ]}
                                    goal="활성 사용자 인식, 커뮤니티 일원 확립"
                                />
                                <DayCard
                                    day={4}
                                    title="심화 탐색 (Deep Dive)"
                                    duration="20-30분"
                                    activities={[
                                        "4-5개 영상 시청 (180-420초)",
                                        "관련 영상 탐색 (30% 확률)",
                                        "좋아요 (80%), 댓글 (60%), 구독 (40%)",
                                        "Shorts 7-10개"
                                    ]}
                                    goal="강력한 관심사 프로필, 높은 참여 신호"
                                />
                                <DayCard
                                    day={5}
                                    title="안정화 (Stabilization)"
                                    duration="15-25분"
                                    activities={[
                                        "3-4개 영상 시청",
                                        "재생목록 탐색",
                                        "일관된 참여 패턴",
                                        "Shorts 5-8개"
                                    ]}
                                    goal="패턴 안정화, 알고리즘 신뢰 강화"
                                />
                                <DayCard
                                    day={6}
                                    title="다양화 (Diversification)"
                                    duration="25-35분"
                                    activities={[
                                        "5-6개 영상 (다양한 카테고리)",
                                        "검색 3-4회 (다른 키워드)",
                                        "커뮤니티 탭 방문",
                                        "Shorts 8-12개"
                                    ]}
                                    goal="다차원적 프로필, 자연스러운 사용자"
                                />
                                <DayCard
                                    day={7}
                                    title="성숙 (Maturation)"
                                    duration="30-45분"
                                    activities={[
                                        "6-8개 영상 (긴 영상 포함, 4-10분)",
                                        "재생목록 생성/추가",
                                        "프로필 설정 확인",
                                        "Shorts 10-15개"
                                    ]}
                                    goal="완전 활성화, 최대 신뢰도, 안전한 운영 준비"
                                />
                            </div>
                        </section>

                        {/* Scientific Basis */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">웜업의 과학적 근거</h3>
                            <div className="space-y-3">
                                <PrincipleCard
                                    title="1. 점진적 신뢰 구축"
                                    description="인간은 점진적으로 플랫폼에 익숙해집니다. Day 1은 탐색만, Day 2는 첫 좋아요, Day 3는 첫 댓글/구독으로 자연스러운 학습 곡선을 만듭니다."
                                />
                                <PrincipleCard
                                    title="2. 행동 패턴 다양성"
                                    description="실제 사용자는 예측 불가능합니다. 랜덤 시청 시간, 확률 기반 참여, 조기 종료 등으로 패턴 인식을 방지합니다."
                                />
                                <PrincipleCard
                                    title="3. 시간 분산"
                                    description="봇은 즉각적이지만 인간은 점진적입니다. 24시간 간격, 액션 간 지연, 불규칙한 활동 시간으로 자동화 의심을 감소시킵니다."
                                />
                            </div>
                        </section>

                        {/* Expected Results */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">예상 결과</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <ResultCard
                                    period="7일 후"
                                    metrics={[
                                        "계정 신뢰도: 85-95%",
                                        "봇 감지 위험: 5% 이하",
                                        "정지 위험: 거의 없음"
                                    ]}
                                />
                                <ResultCard
                                    period="1개월 후"
                                    metrics={[
                                        "완전 활성화",
                                        "정상 추천 수신",
                                        "안정적인 성장"
                                    ]}
                                />
                                <ResultCard
                                    period="3개월 후"
                                    metrics={[
                                        "성숙한 계정",
                                        "높은 참여율",
                                        "장기 운영 가능"
                                    ]}
                                />
                            </div>
                        </section>

                        {/* Warnings */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3">주의사항</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <h4 className="font-semibold text-red-700 mb-2">❌ 절대 금지</h4>
                                    <ul className="text-sm text-red-600 space-y-1">
                                        <li>• 웜업 생략 (즉시 차단 위험)</li>
                                        <li>• 같은 IP에서 여러 계정</li>
                                        <li>• 프로필 공유/복사</li>
                                        <li>• <strong>신규 계정 5일 쿨다운 무시</strong></li>
                                    </ul>
                                </div>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <h4 className="font-semibold text-yellow-700 mb-2">⚠️ 신규 계정 필독</h4>
                                    <p className="text-xs text-yellow-800 mb-2">
                                        최근 생성된 계정은 로그인 시 <strong>"5일 후 다시 시도"</strong> 메시지가 뜰 수 있습니다.
                                    </p>
                                    <ul className="text-xs text-yellow-700 space-y-1">
                                        <li>• 현상: 본인 인증 반복 요구</li>
                                        <li>• 대처: 5일간 웜업 일시 중지</li>
                                        <li>• 원인: Google 신규 가입자 보호 정책</li>
                                    </ul>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <h4 className="font-semibold text-green-700 mb-2">✅ 권장 사항</h4>
                                    <ul className="text-sm text-green-600 space-y-1">
                                        <li>• 점진적 활동 증가</li>
                                        <li>• 자연스러운 패턴</li>
                                        <li>• 정기 모니터링</li>
                                        <li>• 백업 전략</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Conclusion */}
                        <section className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-2">결론</h3>
                            <p className="text-sm text-gray-700 mb-3">
                                YouTube 계정 인큐베이팅은 <strong>웜업을 중심으로 한 종합적인 전략</strong>입니다.
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <strong>핵심 원칙:</strong>
                                    <ul className="mt-1 space-y-1 text-gray-600">
                                        <li>1. 인간처럼 행동 (웜업)</li>
                                        <li>2. 독립성 유지 (IP + 프로필)</li>
                                        <li>3. 일관성 유지 (콘텐츠 + 참여)</li>
                                        <li>4. 점진적 성장 (시간 + 신뢰)</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong>성공의 열쇠:</strong>
                                    <ul className="mt-1 space-y-1 text-gray-600">
                                        <li>• 인내심 (7일 웜업 필수)</li>
                                        <li>• 일관성 (매일 24시간 간격)</li>
                                        <li>• 자연스러움 (랜덤 + 확률)</li>
                                        <li>• 모니터링 (로그 + 분석)</li>
                                    </ul>
                                </div>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

// Helper Components
const ComponentCard = ({ icon, title, importance, description, color }: any) => {
    const colorClasses: Record<string, string> = {
        orange: "bg-orange-50 border-orange-200 text-orange-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
        green: "bg-green-50 border-green-200 text-green-700",
        purple: "bg-purple-50 border-purple-200 text-purple-700",
        pink: "bg-pink-50 border-pink-200 text-pink-700",
        gray: "bg-gray-50 border-gray-200 text-gray-700"
    };

    return (
        <div className={`border rounded-lg p-3 ${colorClasses[color]}`}>
            <div className="flex items-start gap-2 mb-1">
                {icon}
                <div className="flex-1">
                    <div className="font-semibold text-sm">{title}</div>
                    <Badge variant="outline" className="text-xs mt-1">중요도: {importance}</Badge>
                </div>
            </div>
            <p className="text-xs mt-2 opacity-80">{description}</p>
        </div>
    );
};

const DayCard = ({ day, title, duration, activities, goal }: any) => {
    return (
        <div className="border border-gray-200 rounded-lg p-3 hover:border-orange-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Badge className="bg-orange-600">Day {day}</Badge>
                    <span className="font-semibold">{title}</span>
                </div>
                <span className="text-xs text-gray-500">{duration}</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 mb-2">
                {activities.map((activity: string, idx: number) => (
                    <li key={idx}>• {activity}</li>
                ))}
            </ul>
            <div className="text-xs bg-blue-50 text-blue-700 rounded p-2 mt-2">
                <strong>목표:</strong> {goal}
            </div>
        </div>
    );
};

const PrincipleCard = ({ title, description }: any) => {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-1">{title}</h4>
            <p className="text-xs text-gray-600">{description}</p>
        </div>
    );
};

const ResultCard = ({ period, metrics }: any) => {
    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="font-semibold text-green-700 mb-2">{period}</h4>
            <ul className="text-xs text-green-600 space-y-1">
                {metrics.map((metric: string, idx: number) => (
                    <li key={idx}>✅ {metric}</li>
                ))}
            </ul>
        </div>
    );
};

export default IncubationGuide;
