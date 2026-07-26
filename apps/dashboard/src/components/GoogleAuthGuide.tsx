import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, ExternalLink, AlertTriangle } from 'lucide-react';

const GoogleAuthGuide = () => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    전체 설정 가이드 (상세 절차)
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[800px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-blue-600" />
                        전체 설정 가이드 (필독)
                    </DialogTitle>
                    <DialogDescription>
                        계정 생성부터 API 키 발급까지의 전체 과정을 상세히 안내합니다.
                        <br />
                        <span className="text-red-600 font-bold">주의: 구글의 보안 정책(2FA/전화번호 인증)을 피하기 위해 반드시 아래 절차를 따르세요.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-4 space-y-8 py-4">

                    {/* Step 1: Mobile Account Strategy (Critical) */}
                    <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 space-y-3">
                        <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-sm">Step 1</span>
                            모바일 계정 생성 및 LTE 연결 (핵심!!)
                        </h3>
                        <div className="text-sm text-blue-800 space-y-2">
                            <p>구글은 PC에서 대량의 계정을 생성하거나 로그인할 때 보안 인증(전화번호)을 요구합니다. 이를 피하는 가장 확실한 방법입니다:</p>
                            <ol className="list-decimal list-inside font-bold bg-white p-3 rounded border border-blue-100 mt-2 space-y-2">
                                <li>핸드폰의 Wi-Fi를 끄고 <span className="text-red-600">LTE 데이터</span>를 켭니다.</li>
                                <li>핸드폰에서 구글 계정을 생성합니다. (PC 아님)</li>
                                <li>PC의 랜선을 뽑고, 핸드폰의 <span className="text-red-600">핫스팟(테더링)</span>에 PC를 연결합니다.</li>
                                <li>이제 PC와 핸드폰이 <strong>동일한 모바일 IP</strong>를 공유하게 됩니다.</li>
                            </ol>
                            <p className="text-xs text-blue-600 mt-2">
                                ※ 이 상태에서 PC 로그인을 하면 구글이 "신뢰할 수 있는 기기/네트워크"로 인식하여 추가 인증을 요구하지 않습니다.
                            </p>
                        </div>
                    </div>

                    {/* Step 2: PC Login */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Step 2</span>
                            PC에서 로그인 (설정 브라우저)
                        </h3>
                        <p className="text-sm text-slate-600">
                            위의 LTE 연결 상태를 유지한 채, TinCan 마법사의 <strong>[설정 브라우저 열기]</strong> 버튼을 누릅니다.
                            <br />
                            동일 IP 환경이므로 아이디/비밀번호만 입력하면 바로 로그인됩니다.
                        </p>
                    </div>

                    <div className="h-px bg-slate-200 my-4" />
                    <p className="text-sm font-bold text-slate-500 text-center">- 로그인 성공 후 API 키 발급 단계 -</p>

                    {/* Step 3: Project */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Step 3</span>
                            구글 클라우드 프로젝트 생성
                        </h3>
                        <p className="text-sm text-slate-600">
                            로그인된 설정 브라우저에서 Google Cloud Console에 접속해 새 프로젝트를 만듭니다.
                        </p>
                        <Button variant="link" className="h-auto p-0 text-blue-600" onClick={() => window.open('https://console.cloud.google.com/projectcreate', '_blank')}>
                            프로젝트 생성 페이지 <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                    </div>

                    {/* Step 4: API Enable */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Step 4</span>
                            YouTube Data API 활성화
                        </h3>
                        <p className="text-sm text-slate-600">
                            라이브러리에서 <strong>YouTube Data API v3</strong>를 검색하여 '사용(Enable)' 버튼을 누릅니다.
                        </p>
                        <Button variant="link" className="h-auto p-0 text-blue-600" onClick={() => window.open('https://console.cloud.google.com/apis/library/youtube.googleapis.com', '_blank')}>
                            API 라이브러리 바로가기 <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                    </div>

                    {/* Step 5: Consent Screen */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Step 5</span>
                            OAuth 동의 화면 구성
                        </h3>
                        <p className="text-sm text-slate-600">
                            'OAuth 동의 화면' 메뉴로 이동하여 아래 단계를 따라 설정합니다.
                        </p>

                        <div className="bg-slate-50 p-4 rounded-md border space-y-4">
                            {/* 초기 화면: 사용자 유형 선택 */}
                            <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                                <p className="text-sm font-bold text-blue-900 mb-2">
                                    🔷 초기 설정 (최초 1회만)
                                </p>
                                <div className="space-y-1 text-xs text-blue-800">
                                    <p>• <strong className="text-blue-600">'외부(External)'</strong> 라디오 버튼 선택</p>
                                    <p>• <strong>[만들기]</strong> 버튼 클릭</p>
                                    <p className="text-[10px] text-blue-600 mt-2">
                                        ※ 이미 설정했다면 바로 아래 "프로젝트 구성"으로 이동
                                    </p>
                                </div>
                            </div>

                            {/* 프로젝트 구성 화면 */}
                            <div className="bg-white p-4 rounded border">
                                <p className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">
                                    📝 프로젝트 구성 (4단계 진행)
                                </p>

                                <div className="space-y-3">
                                    {/* 1. 앱 정보 */}
                                    <div className="pl-3 border-l-4 border-indigo-500">
                                        <p className="text-sm font-bold text-slate-800 mb-1">① 앱 정보</p>
                                        <div className="space-y-0.5 text-xs text-slate-700">
                                            <p>• <strong>앱 이름</strong>: ViraLoop</p>
                                            <p>• <strong>사용자 지원 이메일</strong>: 본인 이메일 선택</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                → 나머지는 비워두고 [저장 후 계속] 클릭
                                            </p>
                                        </div>
                                    </div>

                                    {/* 2. 대상 */}
                                    <div className="pl-3 border-l-4 border-slate-300">
                                        <p className="text-sm font-bold text-slate-800 mb-1">② 대상</p>
                                        <div className="space-y-0.5 text-xs text-slate-700">
                                            <p>• <strong className="text-blue-600">'외부'</strong> 라디오 버튼 확인</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                → 변경 없이 [저장 후 계속] 클릭
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3. 연락처 정보 */}
                                    <div className="pl-3 border-l-4 border-green-500">
                                        <p className="text-sm font-bold text-slate-800 mb-1">③ 연락처 정보</p>
                                        <div className="space-y-0.5 text-xs text-slate-700">
                                            <p>• <strong>개발자 연락처 정보</strong>: 본인 이메일 입력</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                → [저장 후 계속] 클릭
                                            </p>
                                        </div>
                                    </div>

                                    {/* 4. 완료 */}
                                    <div className="pl-3 border-l-4 border-emerald-500">
                                        <p className="text-sm font-bold text-slate-800 mb-1">④ 완료</p>
                                        <div className="space-y-0.5 text-xs text-slate-700">
                                            <p>• 요약 화면 확인</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                → [대시보드로 돌아가기] 클릭
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 테스트 사용자 추가 (필수!) */}
                            <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
                                <p className="text-sm font-bold text-red-900 mb-2">
                                    ⚠️ 필수: 테스트 사용자 추가
                                </p>
                                <div className="space-y-1 text-xs text-red-800">
                                    <p className="font-bold">대시보드로 돌아온 후 반드시 진행:</p>
                                    <p>1. 'OAuth 동의 화면' 페이지 하단의 <strong>'테스트 사용자'</strong> 섹션 찾기</p>
                                    <p>2. <strong>[+ ADD USERS]</strong> 버튼 클릭</p>
                                    <p>3. <strong className="text-red-600">본인의 구글 계정 이메일 추가</strong></p>
                                    <p>4. [저장] 클릭</p>
                                    <p className="text-[10px] text-red-600 mt-2 font-bold bg-white p-2 rounded">
                                        ※ 이 단계를 건너뛰면 API 사용 시 403 Forbidden 에러 발생!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 6: Credentials */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Step 6</span>
                            사용자 인증 정보 만들기
                        </h3>
                        <p className="text-sm text-slate-600">
                            '사용자 인증 정보 만들기' &gt; 'OAuth 클라이언트 ID' &gt; <strong className="text-blue-600">데스크톱 앱</strong> 선택
                        </p>

                        <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg space-y-2">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="text-sm text-blue-800 font-bold">
                                        중요: 애플리케이션 유형 선택
                                    </div>
                                    <div className="text-xs text-blue-700">
                                        <strong>"데스크톱 앱"</strong>을 선택하세요. 리디렉션 URI는 입력하지 않아도 됩니다.
                                        <br />
                                        ("웹 애플리케이션"이 아닙니다!)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 7: Download */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-sm">Final</span>
                            JSON 다운로드 및 등록
                        </h3>
                        <p className="text-sm text-slate-600">
                            생성된 OAuth ID의 JSON을 다운로드 받아 마법사의 [4단계] 화면에 업로드하세요.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GoogleAuthGuide;
