import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CalendarClock, Play, Pause, Settings, Sparkles, Copy, Check } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// Cron 표현식 파서 및 생성기
const parseCron = (cron: string) => {
    const parts = cron.split(' ');
    return {
        minute: parts[0] || '0',
        hour: parts[1] || '9',
        day: parts[2] || '*',
        month: parts[3] || '*',
        weekday: parts[4] || '*'
    };
};

const buildCron = (minute: string, hour: string, day: string, month: string, weekday: string) => {
    return `${minute} ${hour} ${day} ${month} ${weekday}`;
};

// 다음 실행 시간 계산 (간단한 버전)
const getNextRun = (cron: string) => {
    const parts = parseCron(cron);
    const now = new Date();
    const next = new Date(now);

    // 간단한 계산 (실제로는 cron-parser 라이브러리 사용 권장)
    if (parts.hour !== '*') {
        next.setHours(parseInt(parts.hour));
        next.setMinutes(parseInt(parts.minute));
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
    }

    return next.toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 프리셋 목록
const PRESETS = [
    { name: '매일 아침 9시', cron: '0 9 * * *', desc: '매일 오전 9시에 실행' },
    { name: '매일 저녁 6시', cron: '0 18 * * *', desc: '매일 오후 6시에 실행' },
    { name: '30분마다', cron: '*/30 * * * *', desc: '30분 간격으로 실행' },
    { name: '매시간', cron: '0 * * * *', desc: '매 시간 정각에 실행' },
    { name: '주말 제외 매일', cron: '0 9 * * 1-5', desc: '평일 오전 9시에 실행' },
    { name: '매주 월요일', cron: '0 9 * * 1', desc: '매주 월요일 오전 9시' },
    { name: '매월 1일', cron: '0 9 1 * *', desc: '매월 1일 오전 9시' },
];

const SchedulerNode = ({ data, selected }: NodeProps) => {
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('simple');

    // 간편 설정 상태
    const [frequency, setFrequency] = useState('daily');
    const [hour, setHour] = useState('09');
    const [minute, setMinute] = useState('00');
    const [weekdays, setWeekdays] = useState<number[]>([]);

    // 고급 설정 상태
    const [cronExpression, setCronExpression] = useState(data.cron || '0 9 * * *');
    const [copied, setCopied] = useState(false);

    // 활성화 상태
    const [enabled, setEnabled] = useState(data.enabled !== false);

    useEffect(() => {
        if (data.cron) {
            setCronExpression(data.cron);
        }
    }, [data.cron]);

    const handleSave = () => {
        let finalCron = cronExpression;

        if (activeTab === 'simple') {
            // 간편 설정에서 Cron 생성
            const minutePart = minute;
            const hourPart = hour;
            let dayPart = '*';
            let monthPart = '*';
            let weekdayPart = '*';

            if (frequency === 'weekly' && weekdays.length > 0) {
                weekdayPart = weekdays.sort().join(',');
            } else if (frequency === 'monthly') {
                dayPart = '1';
            }

            finalCron = buildCron(minutePart, hourPart, dayPart, monthPart, weekdayPart);
        }

        if (data.onChange) {
            data.onChange({ cron: finalCron, enabled });
        }
        setInspectorOpen(false);
    };

    const loadPreset = (preset: typeof PRESETS[0]) => {
        setCronExpression(preset.cron);
        if (data.onChange) {
            data.onChange({ cron: preset.cron });
        }
    };

    const toggleWeekday = (day: number) => {
        setWeekdays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const copyCron = () => {
        navigator.clipboard.writeText(cronExpression);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];

    return (
        <>
            <div className={`relative min-w-[220px] transition-all duration-300 ${selected ? 'ring-2 ring-emerald-500 rounded-xl' : ''}`}>
                <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur hover:shadow-xl transition-shadow">
                    {/* Header */}
                    <div className="h-2 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500" />

                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-600">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CalendarClock className="w-3 h-3 mr-1" />
                                        {cronExpression}
                                    </Badge>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setInspectorOpen(true)}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* 다음 실행 시간 */}
                        <div className="mt-3 text-xs text-slate-600 flex items-center justify-between bg-gradient-to-r from-slate-50 to-emerald-50 p-2 rounded-lg border border-slate-100">
                            <span className="flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                다음 실행
                            </span>
                            <span className="font-medium text-emerald-700">{getNextRun(cronExpression)}</span>
                        </div>

                        {/* 상태 */}
                        <div className="mt-2 flex items-center justify-between">
                            <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
                                {enabled ? '활성화' : '일시중지'}
                            </Badge>
                        </div>
                    </div>
                </Card>

                {/* Output Handle */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-4 h-4 bg-emerald-500 border-2 border-white shadow-md"
                    isConnectable={true}
                />
            </div>

            {/* Inspector Dialog */}
            <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            스케줄러 설정
                        </DialogTitle>
                        <p className="text-emerald-50 text-sm mt-1">워크플로우 실행 시간을 설정하세요</p>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6">
                                <TabsTrigger value="simple">간편 설정</TabsTrigger>
                                <TabsTrigger value="advanced">고급 설정</TabsTrigger>
                                <TabsTrigger value="presets">프리셋</TabsTrigger>
                            </TabsList>

                            {/* 간편 설정 */}
                            <TabsContent value="simple" className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-semibold">실행 빈도</Label>
                                        <Select value={frequency} onValueChange={setFrequency}>
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="daily">매일</SelectItem>
                                                <SelectItem value="weekly">매주 (요일 선택)</SelectItem>
                                                <SelectItem value="monthly">매월 (1일)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-semibold">시</Label>
                                            <Select value={hour} onValueChange={setHour}>
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                                            {i.toString().padStart(2, '0')}시
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-semibold">분</Label>
                                            <Select value={minute} onValueChange={setMinute}>
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {Array.from({ length: 60 }, (_, i) => (
                                                        <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                                            {i.toString().padStart(2, '0')}분
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {frequency === 'weekly' && (
                                        <div>
                                            <Label className="text-sm font-semibold">요일 선택</Label>
                                            <div className="grid grid-cols-7 gap-2 mt-2">
                                                {weekdayNames.map((name, idx) => (
                                                    <Button
                                                        key={idx}
                                                        type="button"
                                                        variant={weekdays.includes(idx + 1) ? "default" : "outline"}
                                                        className="h-10"
                                                        onClick={() => toggleWeekday(idx + 1)}
                                                    >
                                                        {name}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="w-5 h-5 text-emerald-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-900">다음 실행 예정</p>
                                                <p className="text-lg font-bold text-emerald-700 mt-1">
                                                    {getNextRun(buildCron(minute, hour, '*', '*', frequency === 'weekly' && weekdays.length > 0 ? weekdays.join(',') : '*'))}
                                                </p>
                                                <p className="text-xs text-emerald-600 mt-1">
                                                    이후 5회: {/* 실제로는 계산 필요 */}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 고급 설정 */}
                            <TabsContent value="advanced" className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-sm font-semibold">Cron 표현식</Label>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={copyCron}
                                                className="h-7 text-xs"
                                            >
                                                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                                {copied ? '복사됨' : '복사'}
                                            </Button>
                                        </div>
                                        <Input
                                            value={cronExpression}
                                            onChange={(e) => setCronExpression(e.target.value)}
                                            placeholder="0 9 * * *"
                                            className="font-mono text-base"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            💡 형식: 분 시 일 월 요일
                                        </p>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                        <p className="text-sm font-semibold text-slate-700">📖 예제</p>
                                        <div className="space-y-1 text-xs text-slate-600">
                                            <div className="flex justify-between">
                                                <code className="bg-white px-2 py-1 rounded">0 9 * * *</code>
                                                <span>매일 오전 9시</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <code className="bg-white px-2 py-1 rounded">*/30 * * * *</code>
                                                <span>30분마다</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <code className="bg-white px-2 py-1 rounded">0 0 1 * *</code>
                                                <span>매월 1일 자정</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <code className="bg-white px-2 py-1 rounded">0 9 * * 1-5</code>
                                                <span>평일 오전 9시</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="w-5 h-5 text-emerald-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-900">다음 실행 예정</p>
                                                <p className="text-lg font-bold text-emerald-700 mt-1">
                                                    {getNextRun(cronExpression)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 프리셋 */}
                            <TabsContent value="presets" className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        자주 사용하는 스케줄
                                    </Label>
                                    <div className="grid gap-2">
                                        {PRESETS.map((preset, idx) => (
                                            <Button
                                                key={idx}
                                                variant="outline"
                                                className="justify-start h-auto p-4 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                                                onClick={() => loadPreset(preset)}
                                            >
                                                <div className="text-left w-full">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-semibold text-sm">{preset.name}</span>
                                                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{preset.cron}</code>
                                                    </div>
                                                    <p className="text-xs text-slate-500">{preset.desc}</p>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* 활성화 토글 */}
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-sm">스케줄러 활성화</p>
                                <p className="text-xs text-slate-500">비활성화 시 실행되지 않습니다</p>
                            </div>
                            <Button
                                variant={enabled ? "default" : "outline"}
                                size="sm"
                                onClick={() => setEnabled(!enabled)}
                            >
                                {enabled ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                                {enabled ? '활성화' : '비활성화'}
                            </Button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                        <Button variant="outline" onClick={() => setInspectorOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                            저장
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(SchedulerNode);
