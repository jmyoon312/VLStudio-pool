import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Webhook, Radio, Share2, Settings, Play, Copy, Check,
    Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface Header {
    key: string;
    value: string;
}

const WebhookNode = ({ data, selected }: NodeProps) => {
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    // 기본 설정
    const [method, setMethod] = useState(data.method || 'POST');
    const [url, setUrl] = useState(data.url || '');
    const [headers, setHeaders] = useState<Header[]>(data.headers || [{ key: 'Content-Type', value: 'application/json' }]);
    const [body, setBody] = useState(data.body || '{\n  "data": "{{input}}"\n}');

    // 인증
    const [authType, setAuthType] = useState(data.authType || 'none');
    const [apiKey, setApiKey] = useState(data.apiKey || '');
    const [keyLocation, setKeyLocation] = useState(data.keyLocation || 'header');
    const [keyName, setKeyName] = useState(data.keyName || 'Authorization');
    const [username, setUsername] = useState(data.username || '');
    const [password, setPassword] = useState(data.password || '');
    const [showPassword, setShowPassword] = useState(false);

    // 재시도
    const [maxRetries, setMaxRetries] = useState(data.maxRetries || 3);
    const [retryInterval, setRetryInterval] = useState(data.retryInterval || 5);
    const [backoffStrategy, setBackoffStrategy] = useState(data.backoffStrategy || 'exponential');
    const [timeout, setTimeout] = useState(data.timeout || 30);

    // 테스트
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    const addHeader = () => {
        setHeaders([...headers, { key: '', value: '' }]);
    };

    const removeHeader = (index: number) => {
        setHeaders(headers.filter((_, i) => i !== index));
    };

    const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
        const newHeaders = [...headers];
        newHeaders[index][field] = value;
        setHeaders(newHeaders);
    };

    const handleSave = () => {
        if (data.onChange) {
            data.onChange({
                method,
                url,
                headers,
                body,
                authType,
                apiKey,
                keyLocation,
                keyName,
                username,
                password,
                maxRetries,
                retryInterval,
                backoffStrategy,
                timeout
            });
        }
        setInspectorOpen(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);

        // 실제 테스트 요청 (실제로는 백엔드 API 호출)
        setTimeout(() => {
            setTestResult({
                status: 200,
                statusText: 'OK',
                data: { success: true, message: 'Test successful' },
                time: 245
            });
            setTesting(false);
        }, 1000);
    };

    const copyCurl = () => {
        const curl = `curl -X ${method} "${url}" \\
${headers.map(h => `  -H "${h.key}: ${h.value}"`).join(' \\\n')} \\
  -d '${body}'`;
        navigator.clipboard.writeText(curl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getRetryTimes = () => {
        const times = [];
        for (let i = 0; i < maxRetries; i++) {
            if (backoffStrategy === 'exponential') {
                times.push(retryInterval * Math.pow(2, i));
            } else {
                times.push(retryInterval);
            }
        }
        return times;
    };

    return (
        <>
            <div className={`relative w-[260px] transition-all duration-300 ${selected ? 'ring-2 ring-indigo-500 rounded-xl' : ''}`}>
                {/* Input Handle */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Handle
                                type="target"
                                position={Position.Left}
                                className="w-4 h-4 bg-indigo-500 border-2 border-white shadow-md"
                            />
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            <p>입력: 트리거 데이터</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-900 to-indigo-900 text-white group hover:shadow-xl transition-shadow">
                    {/* Header */}
                    <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 border-b border-indigo-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
                                <Share2 className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-sm tracking-wide">{data.label || '웹훅'}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-white hover:bg-white/20"
                            onClick={() => setInspectorOpen(true)}
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-xs">
                                {method}
                            </Badge>
                            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
                            <span className="text-xs text-slate-700">활성</span>
                        </div>

                        <div className="text-[10px] font-mono bg-black/30 p-2 rounded truncate text-slate-700 border border-slate-200">
                            {url || 'https://api.example.com/webhook'}
                        </div>

                        {authType !== 'none' && (
                            <Badge variant="outline" className="text-[10px] border-amber-400/50 text-amber-300">
                                🔒 {authType === 'api_key' ? 'API Key' : 'Basic Auth'}
                            </Badge>
                        )}
                    </div>
                </Card>

                {/* Output Handle */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-4 h-4 bg-indigo-500 border-2 border-white shadow-md"
                    isConnectable={true}
                />
            </div>

            {/* Inspector Dialog */}
            <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Webhook className="w-5 h-5" />
                            웹훅 설정
                        </DialogTitle>
                        <p className="text-indigo-100 text-sm mt-1">HTTP 요청을 구성하고 테스트하세요</p>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4 mb-6">
                                <TabsTrigger value="basic">기본 설정</TabsTrigger>
                                <TabsTrigger value="auth">인증</TabsTrigger>
                                <TabsTrigger value="retry">재시도</TabsTrigger>
                                <TabsTrigger value="test">테스트</TabsTrigger>
                            </TabsList>

                            {/* 기본 설정 */}
                            <TabsContent value="basic" className="space-y-6">
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <Label>메서드</Label>
                                        <Select value={method} onValueChange={setMethod}>
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GET">GET</SelectItem>
                                                <SelectItem value="POST">POST</SelectItem>
                                                <SelectItem value="PUT">PUT</SelectItem>
                                                <SelectItem value="DELETE">DELETE</SelectItem>
                                                <SelectItem value="PATCH">PATCH</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-3">
                                        <Label>URL</Label>
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://api.example.com/webhook"
                                            className="mt-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>헤더</Label>
                                        <Button size="sm" variant="outline" onClick={addHeader}>
                                            <Plus className="w-3 h-3 mr-1" />
                                            추가
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {headers.map((header, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <Input
                                                    value={header.key}
                                                    onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                                                    placeholder="Header Name"
                                                    className="flex-1"
                                                />
                                                <Input
                                                    value={header.value}
                                                    onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                                                    placeholder="Value"
                                                    className="flex-1"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeHeader(idx)}
                                                    className="text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label>바디 (JSON)</Label>
                                    <Textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder='{"data": "{{input}}"}'
                                        className="mt-2 font-mono text-sm min-h-[200px]"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        💡 변수: {`{{input}}`}, {`{{timestamp}}`}, {`{{workflow_id}}`}
                                    </p>
                                </div>
                            </TabsContent>

                            {/* 인증 */}
                            <TabsContent value="auth" className="space-y-6">
                                <div>
                                    <Label>인증 방식</Label>
                                    <Select value={authType} onValueChange={setAuthType}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">없음</SelectItem>
                                            <SelectItem value="api_key">API Key</SelectItem>
                                            <SelectItem value="basic">Basic Auth</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {authType === 'api_key' && (
                                    <>
                                        <div>
                                            <Label>API Key</Label>
                                            <div className="relative mt-2">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    placeholder="sk-..."
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="absolute right-1 top-1 h-7"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>위치</Label>
                                                <Select value={keyLocation} onValueChange={setKeyLocation}>
                                                    <SelectTrigger className="mt-2">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="header">Header</SelectItem>
                                                        <SelectItem value="query">Query Parameter</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>키 이름</Label>
                                                <Input
                                                    value={keyName}
                                                    onChange={(e) => setKeyName(e.target.value)}
                                                    placeholder="Authorization"
                                                    className="mt-2"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {authType === 'basic' && (
                                    <>
                                        <div>
                                            <Label>사용자명</Label>
                                            <Input
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                placeholder="username"
                                                className="mt-2"
                                            />
                                        </div>
                                        <div>
                                            <Label>비밀번호</Label>
                                            <div className="relative mt-2">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="password"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="absolute right-1 top-1 h-7"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-semibold">보안 알림</p>
                                        <p className="text-xs mt-1">인증 정보는 암호화되어 안전하게 저장됩니다.</p>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 재시도 */}
                            <TabsContent value="retry" className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>최대 재시도 횟수</Label>
                                        <Input
                                            type="number"
                                            value={maxRetries}
                                            onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                                            min={0}
                                            max={10}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>재시도 간격 (초)</Label>
                                        <Input
                                            type="number"
                                            value={retryInterval}
                                            onChange={(e) => setRetryInterval(parseInt(e.target.value))}
                                            min={1}
                                            max={60}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>재시도 전략</Label>
                                    <Select value={backoffStrategy} onValueChange={setBackoffStrategy}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="linear">Linear (일정 간격)</SelectItem>
                                            <SelectItem value="exponential">Exponential Backoff (지수 증가)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>타임아웃 (초)</Label>
                                    <Input
                                        type="number"
                                        value={timeout}
                                        onChange={(e) => setTimeout(parseInt(e.target.value))}
                                        min={5}
                                        max={300}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                    <p className="text-sm font-semibold text-indigo-900 mb-2">📊 예상 재시도 시간</p>
                                    <div className="space-y-1 text-sm text-indigo-700">
                                        {getRetryTimes().map((time, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span>{idx + 1}차 재시도:</span>
                                                <span className="font-mono">{time}초 후</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 테스트 */}
                            <TabsContent value="test" className="space-y-6">
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleTest}
                                        disabled={testing || !url}
                                        className="flex-1"
                                    >
                                        {testing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                                테스트 중...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 mr-2" />
                                                테스트 요청 보내기
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" onClick={copyCurl}>
                                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                        {copied ? '복사됨' : 'cURL'}
                                    </Button>
                                </div>

                                {testResult && (
                                    <div className="space-y-4">
                                        <div className={`p-4 rounded-lg border ${testResult.status >= 200 && testResult.status < 300
                                                ? 'bg-green-50 border-green-200'
                                                : 'bg-red-50 border-red-200'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {testResult.status >= 200 && testResult.status < 300 ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                )}
                                                <span className="font-semibold">
                                                    {testResult.status} {testResult.statusText}
                                                </span>
                                                <Badge variant="outline" className="ml-auto">
                                                    {testResult.time}ms
                                                </Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>응답 데이터</Label>
                                            <pre className="mt-2 p-4 bg-white text-slate-800 rounded-lg text-xs overflow-auto max-h-60">
                                                {JSON.stringify(testResult.data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                {!testResult && !testing && (
                                    <div className="text-center py-12 text-slate-600">
                                        <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-sm">테스트 요청을 보내서 응답을 확인하세요</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                        <Button variant="outline" onClick={() => setInspectorOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                            저장
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(WebhookNode);
