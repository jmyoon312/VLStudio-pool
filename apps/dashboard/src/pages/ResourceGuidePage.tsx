import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    BookOpen,
    ChevronLeft,
    Shield,
    Server,
    Smartphone,
    AlertTriangle,
    Zap,
    Layout,
    ArrowRight,
    PlaySquare,
    CheckCircle2,
    Lock,
    Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ResourceGuidePage = () => {
    const navigate = useNavigate();

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col h-full sticky top-0">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    <Badge variant="outline" className="text-[10px] font-black uppercase border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10">SOP Intelligence</Badge>
                </div>
                <div className="p-4 space-y-1">
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scrollToSection('architecture')}>
                        1. 시스템 아키텍처
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scrollToSection('hardware')}>
                        2. 하드웨어 운영 전략
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scrollToSection('api-strategy')}>
                        3. API 쿼터 무한 확장
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scrollToSection('incubation')}>
                        4. 브랜드 채널 숙성
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scrollToSection('risk-mgmt')}>
                        5. 위기 관리 (Troubleshoot)
                    </Button>
                </div>
                <div className="mt-auto p-4 border-t border-border">
                    <Button variant="outline" className="w-full gap-2 border-border" onClick={() => navigate(-1)}>
                        <ChevronLeft className="w-4 h-4" /> 뒤로 가기
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                {/* Tactical Knowledge Base */}

                <ScrollArea className="flex-1 px-8 py-8 md:px-12 lg:px-20 bg-background">
                    <div className="max-w-4xl mx-auto space-y-16 pb-20">

                        {/* Section 1: Architecture */}
                        <section id="architecture" className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-500/10 rounded-lg">
                                    <Layout className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">01 | System Architecture</span>
                            </div>
                            <Card className="mb-6 bg-card border-border">
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-8 bg-muted rounded-xl border-2 border-dashed border-border">

                                        {/* Owner Node */}
                                        <div className="flex flex-col items-center gap-2 text-center p-4 bg-card rounded-lg shadow-sm border border-border w-full md:w-auto">
                                            <Badge variant="outline" className="mb-2 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Safe Zone</Badge>
                                            <Shield className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">Owner (자산 소유자)</span>
                                                <span className="text-xs text-muted-foreground">Master Account</span>
                                            </div>
                                        </div>

                                        {/* Connection Arrow */}
                                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Delegate</span>
                                            <ArrowRight className="w-6 h-6" />
                                            <div className="h-px w-20 bg-border hidden md:block"></div>
                                        </div>

                                        {/* Worker Node */}
                                        <div className="flex flex-col items-center gap-2 text-center p-4 bg-card rounded-lg shadow-sm border border-border w-full md:w-auto">
                                            <Badge variant="outline" className="mb-2 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">Active Zone</Badge>
                                            <Server className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">Worker (작업자)</span>
                                                <span className="text-xs text-muted-foreground">API Operator</span>
                                            </div>
                                        </div>

                                        {/* Connection Arrow */}
                                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                            <span className="text-xs font-semibold uppercase tracking-wider">Upload</span>
                                            <ArrowRight className="w-6 h-6" />
                                            <div className="h-px w-20 bg-border hidden md:block"></div>
                                        </div>

                                        {/* YouTube Node */}
                                        <div className="flex flex-col items-center gap-2 text-center p-4 bg-card rounded-lg shadow-sm border border-border w-full md:w-auto">
                                            <Badge variant="outline" className="mb-2 border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">Target</Badge>
                                            <PlaySquare className="w-10 h-10 text-red-600 dark:text-red-400" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">YouTube</span>
                                                <span className="text-xs text-muted-foreground">Platform</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 text-muted-foreground space-y-2 leading-relaxed">
                                        <p>
                                            <strong className="text-foreground">연좌제(Chain Ban) 방지 원칙:</strong> 유튜브는 하나의 계정이 정지되면 연결된 모든 계정(같은 기기, 같은 IP)을 추적하여 '연쇄 정지'시킵니다.
                                        </p>
                                        <p>
                                            이를 막기 위해 우리는 <strong>자산(채널 소유권)</strong>과 <strong>작업(동영상 업로드)</strong>을 철저히 분리합니다. 오너 계정은 채널만 만들고 로그아웃하며, 모든 위험한 작업(API 연동, 대량 업로드)은 '버리는 패'인 워커 계정에 위임합니다.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <Separator className="bg-border" />

                        {/* Section 2: Hardware Strategy */}
                        <section id="hardware" className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-cyan-500/10 rounded-lg">
                                    <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">02 | Hardware Strategy</span>
                            </div>
                            <p className="mb-6 text-muted-foreground">
                                안전한 확장을 위해서는 최소 2대 이상의 기기가 필요합니다. 용도에 따라 기기를 엄격히 구분하여 사용하십시오.
                            </p>

                            <Tabs defaultValue="incubator" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4 h-12 bg-muted border border-border">
                                    <TabsTrigger value="incubator" className="text-base">💊 인큐베이터 (Incubator)</TabsTrigger>
                                    <TabsTrigger value="operator" className="text-base">🏭 오퍼레이터 (Operator)</TabsTrigger>
                                </TabsList>
                                <TabsContent value="incubator">
                                    <Card className="bg-card border-border">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-foreground">
                                                <AlertTriangle className="w-5 h-5 text-orange-500" /> The "Dirty" Environment
                                            </CardTitle>
                                            <CardDescription className="text-muted-foreground">계정 생성 및 초기 육성을 담당하는 기기입니다.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="bg-muted p-4 rounded-lg border border-border text-sm text-muted-foreground">
                                                <ul className="list-disc pl-5 space-y-2">
                                                    <li><strong>용도:</strong> 구글 계정 생성, 브랜드 채널 생성, 초기 시청 활동.</li>
                                                    <li><strong>필수 행동:</strong> 계정 생성 전 반드시 <span className="text-red-600 dark:text-red-400 font-bold">공장 초기화(Factory Reset)</span>를 수행해야 합니다.</li>
                                                    <li><strong>IP 전략:</strong> 와이파이 금지. LTE/5G 데이터를 껐다 켜서 IP를 변경하며 사용합니다.</li>
                                                    <li><strong>경고:</strong> 이 기기에 중요한 메인 계정(Owner)을 절대 로그인하지 마십시오.</li>
                                                </ul>
                                            </div>
                                            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                                                <Shield className="h-4 w-4 text-destructive" />
                                                <AlertTitle className="text-destructive font-semibold">교차 오염 주의</AlertTitle>
                                                <AlertDescription className="text-destructive-foreground/90">
                                                    인큐베이터 폰은 '생성'만을 위한 도구입니다. 여기서 만든 계정을 '오퍼레이터'로 옮긴 후에는 인큐베이터에서 해당 계정을 삭제(로그아웃)하고 다시 초기화하십시오.
                                                </AlertDescription>
                                            </Alert>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="operator">
                                    <Card className="bg-card border-border">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-foreground">
                                                <CheckCircle2 className="w-5 h-5 text-green-500" /> The "Clean" Environment
                                            </CardTitle>
                                            <CardDescription className="text-muted-foreground">안정된 워커 계정이 상주하며 작업을 수행하는 기기입니다.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="bg-muted p-4 rounded-lg border border-border text-sm text-muted-foreground">
                                                <ul className="list-disc pl-5 space-y-2">
                                                    <li><strong>용도:</strong> ViraLoop API 연동, 업로드 관리, 댓글 관리.</li>
                                                    <li><strong>특징:</strong> 공장 초기화가 필요 없습니다. 한 번 로그인한 워커 계정은 계속 유지합니다.</li>
                                                    <li><strong>안전 수칙:</strong> 검증되지 않은 막 만든 계정을 이 기기에 로그인하지 마십시오. (인큐베이터에서 4일 이상 검증된 계정만 수용)</li>
                                                </ul>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </section>

                        <Separator className="bg-border" />

                        {/* Section 3: API Strategy */}
                        <section id="api-strategy" className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-yellow-500/10 rounded-lg">
                                    <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">03 | API Scalability</span>
                            </div>
                            <p className="mb-6 text-muted-foreground">
                                유튜브 API의 기본 할당량은 프로젝트당 하루 10,000 unit입니다. 이를 극대화하는 전략입니다.
                            </p>

                            <Alert className="bg-indigo-500/10 border-indigo-500/20 mb-6">
                                <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <AlertTitle className="text-indigo-600 dark:text-indigo-400 font-bold">1 Worker = 6 GCP Projects 공식</AlertTitle>
                                <AlertDescription className="text-muted-foreground mt-2">
                                    <div className="space-y-1 font-mono text-sm">
                                        <p>• 1 Worker Account (Phone Verified) can create up to 6~10 Projects.</p>
                                        <p>• 1 Project = 10,000 Units/day</p>
                                        <div className="w-full h-px bg-indigo-500/20 my-2"></div>
                                        <p className="font-bold border-l-4 border-indigo-600 dark:border-indigo-400 pl-2 text-foreground">Total = 60,000 Units/day (약 쇼츠 37개 업로드 분량)</p>
                                    </div>
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-card border-border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-foreground">Step A. 프로젝트 생성</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        Google Cloud Console에서 <code>project-01</code>, <code>project-02</code>... 와 같이 6개의 프로젝트를 연달아 생성합니다.
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-foreground">Step B. API 활성화</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        각 프로젝트마다 <strong>YouTube Data API v3</strong>를 활성화하고 OAuth 동의 화면을 '외부(External)'로 설정합니다.
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-foreground">Step C. 자격 증명 (JSON)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        Desktop App 유형으로 OAuth Client ID를 생성하고 <code>client_secret.json</code>을 다운로드하여 ViraLoop에 등록합니다.
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-foreground">Step D. 자동 로테이션</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">
                                        ViraLoop 시스템은 등록된 키들을 자동으로 순환하며 사용합니다. 쿼터가 소진되면 다음 프로젝트 키로 자동 전환됩니다.
                                    </CardContent>
                                </Card>
                            </div>
                        </section>

                        <Separator className="bg-border" />

                        {/* Section 4: Incubation */}
                        <section id="incubation" className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-pink-500/10 rounded-lg">
                                    <Users className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                </div>
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">04 | Channel Incubation</span>
                            </div>
                            <p className="mb-6 text-muted-foreground">
                                채널 생성 직후 대량 업로드는 '스팸'으로 간주되어 조회수 0(Shadow Ban)의 원인이 됩니다. 최소 7일의 숙성 기간이 필요합니다.
                            </p>

                            <div className="relative border-l-2 border-border ml-4 space-y-8 pl-8 py-2">
                                {/* Day 1 */}
                                <div className="relative">
                                    <div className="absolute -left-[41px] bg-muted border-2 border-border w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">1</div>
                                    <h3 className="text-lg font-bold text-foreground">Day 1: 탄생 (Birth)</h3>
                                    <p className="text-sm text-muted-foreground mb-2">인큐베이터 기기에서 브랜드 계정을 생성합니다.</p>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-500/20 bg-red-500/10">필수: 전화번호 인증</Badge>
                                        <Badge variant="outline" className="border-border">프로필/배너 설정</Badge>
                                    </div>
                                </div>
                                {/* Day 2-3 */}
                                <div className="relative">
                                    <div className="absolute -left-[41px] bg-muted border-2 border-border w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">2</div>
                                    <h3 className="text-lg font-bold text-foreground">Day 2~3: 활동 (Activity)</h3>
                                    <p className="text-sm text-muted-foreground mb-2">알고리즘에게 '실제 사용자'임을 증명합니다.</p>
                                    <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                                        <li>경쟁 채널 키워드 검색 후 시청</li>
                                        <li>영상 좋아요 및 구독 (하루 5회 미만)</li>
                                    </ul>
                                </div>
                                {/* Day 4 */}
                                <div className="relative">
                                    <div className="absolute -left-[41px] bg-indigo-500/20 border-2 border-indigo-500/40 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">4</div>
                                    <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Day 4: 첫 업로드 (First Upload)</h3>
                                    <p className="text-sm text-muted-foreground mb-2">기존 API나 PC가 아닌, <span className="underline decoration-wavy decoration-indigo-500/40">모바일 앱</span>으로 직접 업로드합니다.</p>
                                    <div className="bg-indigo-500/10 p-3 rounded text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                        Tip: 쇼츠 1개를 올릴 때 '썸네일(커버)'을 반드시 지정하여 기능을 활성화하세요.
                                    </div>
                                </div>
                                {/* Day 7 */}
                                <div className="relative">
                                    <div className="absolute -left-[41px] bg-emerald-500/20 border-2 border-emerald-500/40 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">7</div>
                                    <h3 className="text-lg font-bold text-foreground">Day 7: 위임 (Delegation)</h3>
                                    <p className="text-sm text-muted-foreground mb-2">계정이 안정화되었습니다. 이제 권한을 넘깁니다.</p>
                                    <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                                        <li>유튜브 스튜디오 권한 관리에서 '워커 이메일'을 관리자(Manager)로 초대</li>
                                        <li>워커가 초대 수락 후, 오너 계정(인큐베이터)에서는 로그아웃</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <Separator className="bg-border" />

                        {/* Section 5: Risk Management */}
                        <section id="risk-mgmt" className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                </div>
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">05 | Risk Management</span>
                            </div>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger className="font-semibold text-foreground">저작권 경고(Strike) 1회 발생 시</AccordionTrigger>
                                    <AccordionContent className="bg-red-500/10 p-4 rounded text-red-600 dark:text-red-400">
                                        <strong>즉시 모든 업로드를 중단하십시오.</strong><br />
                                        경고는 90일 후에 사라집니다. 무리하게 업로드를 지속하면 채널이 영구 정지될 위험이 큽니다. 해당 기간 동안은 커뮤니티 탭 활용 등 소극적인 활동만 유지하십시오.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2">
                                    <AccordionTrigger className="font-semibold text-foreground">채널이 강제로 정지(Terminated)된 경우</AccordionTrigger>
                                    <AccordionContent className="bg-muted p-4 rounded text-muted-foreground">
                                        가장 중요한 것은 <strong>'전염'을 막는 것</strong>입니다.<br />
                                        1. 해당 채널을 관리하던 워커 계정을 ViraLoop에서 즉시 연결 해제하십시오.<br />
                                        2. 해당 워커가 사용하던 IP 대역은 오염되었을 가능성이 높으니 변경하십시오.<br />
                                        3. 정지된 채널에 대한 이의 제기(Appeal)는 절대 원래 IP에서 하지 마십시오 (새로운 IP 사용).
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-3">
                                    <AccordionTrigger className="font-semibold text-foreground">업로드해도 조회수가 0입니다 (Shadow Ban)</AccordionTrigger>
                                    <AccordionContent className="bg-muted p-4 rounded text-muted-foreground">
                                        대부분 '기계적 생성'으로 의심받았기 때문입니다.<br />
                                        - 전화번호 인증이 풀리지 않았는지 확인하세요.<br />
                                        - API 업로드를 멈추고, 3일간 모바일 기기(인큐베이터)로 직접 매일 1개씩 영상을 올리며 반응을 보십시오.
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </section>

                        {/* Footer */}
                        <div className="pt-20 text-center text-muted-foreground text-sm">
                            <p>© 2024 ViraLoop Strategic Operations Division.</p>
                            <p className="mt-2">이 가이드는 ViraLoop 엔터프라이즈 워크플로우를 위해 작성되었습니다.</p>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};

export default ResourceGuidePage;
