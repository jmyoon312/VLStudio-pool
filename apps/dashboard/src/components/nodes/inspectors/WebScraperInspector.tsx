import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Globe, Play, Loader2, CheckCircle, XCircle, Code, Eye } from 'lucide-react';

interface WebScraperInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const WebScraperInspector: React.FC<WebScraperInspectorProps> = ({ node, updateData }) => {
    const [url, setUrl] = useState(node.data.url || '');
    const [scrapeType, setScrapeType] = useState(node.data.scrapeType || 'text');
    const [selector, setSelector] = useState(node.data.selector || '');
    const [waitForSelector, setWaitForSelector] = useState(node.data.waitForSelector || '');
    const [javascript, setJavascript] = useState(node.data.javascript !== false);
    const [timeout, setTimeout] = useState(node.data.timeout || 30);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const handleSave = () => {
        updateData({
            url,
            scrapeType,
            selector,
            waitForSelector,
            javascript,
            timeout
        });
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);

        // Mock test
        setTimeout(() => {
            setTestResult({
                success: true,
                data: {
                    title: 'Example Page Title',
                    content: 'Scraped content preview...',
                    elements: 15
                },
                time: 1234
            });
            setTesting(false);
        }, 1500);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">기본 설정</TabsTrigger>
                        <TabsTrigger value="advanced">고급 설정</TabsTrigger>
                        <TabsTrigger value="test">테스트</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 mt-4">
                        <div>
                            <Label>대상 URL</Label>
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="mt-2"
                            />
                        </div>

                        <div>
                            <Label>스크래핑 유형</Label>
                            <Select value={scrapeType} onValueChange={setScrapeType}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">텍스트</SelectItem>
                                    <SelectItem value="html">HTML</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                    <SelectItem value="screenshot">스크린샷</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>CSS 선택자 (선택사항)</Label>
                            <Input
                                value={selector}
                                onChange={(e) => setSelector(e.target.value)}
                                placeholder=".article-content, #main"
                                className="mt-2 font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                특정 요소만 추출하려면 CSS 선택자를 입력하세요
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4 mt-4">
                        <div>
                            <Label>대기 선택자</Label>
                            <Input
                                value={waitForSelector}
                                onChange={(e) => setWaitForSelector(e.target.value)}
                                placeholder=".dynamic-content"
                                className="mt-2 font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                이 요소가 로드될 때까지 대기
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <p className="font-semibold text-sm">JavaScript 실행</p>
                                <p className="text-xs text-slate-500">동적 콘텐츠 로드</p>
                            </div>
                            <Switch checked={javascript} onCheckedChange={setJavascript} />
                        </div>

                        <div>
                            <Label>타임아웃 (초)</Label>
                            <Input
                                type="number"
                                value={timeout}
                                onChange={(e) => setTimeout(parseInt(e.target.value))}
                                min={5}
                                max={120}
                                className="mt-2"
                            />
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-2">
                                <Code className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">커스텀 스크립트</p>
                                    <p className="text-xs mt-1">
                                        고급 사용자를 위한 JavaScript 코드 실행 기능 (추후 지원 예정)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="test" className="space-y-4 mt-4">
                        <Button
                            onClick={handleTest}
                            disabled={testing || !url}
                            className="w-full"
                        >
                            {testing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    스크래핑 중...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    테스트 실행
                                </>
                            )}
                        </Button>

                        {testResult && (
                            <div className="space-y-3">
                                <div className={`p-4 rounded-lg border ${testResult.success
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-red-50 border-red-200'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        {testResult.success ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-600" />
                                        )}
                                        <span className="font-semibold">
                                            {testResult.success ? '성공' : '실패'}
                                        </span>
                                        <Badge variant="outline" className="ml-auto">
                                            {testResult.time}ms
                                        </Badge>
                                    </div>
                                </div>

                                {testResult.success && (
                                    <div className="p-4 bg-slate-50 rounded-lg border">
                                        <Label className="text-sm font-semibold mb-2 block">
                                            <Eye className="w-4 h-4 inline mr-1" />
                                            미리보기
                                        </Label>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-slate-500">제목:</span>
                                                <span className="ml-2 font-medium">{testResult.data.title}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">요소 수:</span>
                                                <span className="ml-2 font-medium">{testResult.data.elements}개</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block mb-1">내용:</span>
                                                <pre className="bg-white p-2 rounded border text-xs overflow-auto max-h-40">
                                                    {testResult.data.content}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!testResult && !testing && (
                            <div className="text-center py-12 text-slate-600">
                                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-sm">테스트를 실행하여 스크래핑 결과를 확인하세요</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    저장
                </Button>
            </div>
        </div>
    );
};

export default WebScraperInspector;
