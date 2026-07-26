import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Play, Copy } from 'lucide-react';

interface SchedulerInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const SchedulerInspector: React.FC<SchedulerInspectorProps> = ({ node, updateData }) => {
    // Simple mode state
    const [frequency, setFrequency] = useState(node.data.frequency || 'daily');
    const [hour, setHour] = useState(node.data.hour || 9);
    const [minute, setMinute] = useState(node.data.minute || 0);
    const [dayOfWeek, setDayOfWeek] = useState(node.data.dayOfWeek || 1);
    const [dayOfMonth, setDayOfMonth] = useState(node.data.dayOfMonth || 1);

    // Advanced mode state
    const [cronExpression, setCronExpression] = useState(node.data.cron || '0 9 * * *');
    const [active, setActive] = useState(node.data.active !== false);

    // Next run time
    const [nextRun, setNextRun] = useState('');

    const presets = [
        { id: 'every-hour', name: '매시간', cron: '0 * * * *' },
        { id: 'every-day-9am', name: '매일 오전 9시', cron: '0 9 * * *' },
        { id: 'every-day-6pm', name: '매일 오후 6시', cron: '0 18 * * *' },
        { id: 'weekdays-9am', name: '평일 오전 9시', cron: '0 9 * * 1-5' },
        { id: 'monday-9am', name: '매주 월요일 오전 9시', cron: '0 9 * * 1' },
        { id: 'first-of-month', name: '매월 1일 오전 9시', cron: '0 9 1 * *' },
        { id: 'every-15min', name: '15분마다', cron: '*/15 * * * *' },
    ];

    // Generate cron from simple settings
    useEffect(() => {
        let cron = '';
        switch (frequency) {
            case 'hourly':
                cron = `${minute} * * * *`;
                break;
            case 'daily':
                cron = `${minute} ${hour} * * *`;
                break;
            case 'weekly':
                cron = `${minute} ${hour} * * ${dayOfWeek}`;
                break;
            case 'monthly':
                cron = `${minute} ${hour} ${dayOfMonth} * *`;
                break;
        }
        if (cron) {
            setCronExpression(cron);
        }
    }, [frequency, hour, minute, dayOfWeek, dayOfMonth]);

    // Calculate next run (mock)
    useEffect(() => {
        const now = new Date();
        const next = new Date(now.getTime() + 3600000); // +1 hour for demo
        setNextRun(next.toLocaleString('ko-KR'));
    }, [cronExpression]);

    const handleSave = () => {
        updateData({
            frequency,
            hour,
            minute,
            dayOfWeek,
            dayOfMonth,
            cron: cronExpression,
            active
        });
    };

    const copyCron = () => {
        navigator.clipboard.writeText(cronExpression);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <Tabs defaultValue="simple" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="simple">간단 설정</TabsTrigger>
                        <TabsTrigger value="advanced">고급 설정</TabsTrigger>
                        <TabsTrigger value="presets">프리셋</TabsTrigger>
                    </TabsList>

                    <TabsContent value="simple" className="space-y-4 mt-4">
                        <div>
                            <Label>실행 빈도</Label>
                            <Select value={frequency} onValueChange={setFrequency}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hourly">매시간</SelectItem>
                                    <SelectItem value="daily">매일</SelectItem>
                                    <SelectItem value="weekly">매주</SelectItem>
                                    <SelectItem value="monthly">매월</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {frequency !== 'hourly' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>시</Label>
                                    <Select value={hour.toString()} onValueChange={(v) => setHour(parseInt(v))}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <SelectItem key={i} value={i.toString()}>
                                                    {i}시
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>분</Label>
                                    <Select value={minute.toString()} onValueChange={(v) => setMinute(parseInt(v))}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 15, 30, 45].map((m) => (
                                                <SelectItem key={m} value={m.toString()}>
                                                    {m}분
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {frequency === 'weekly' && (
                            <div>
                                <Label>요일</Label>
                                <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">일요일</SelectItem>
                                        <SelectItem value="1">월요일</SelectItem>
                                        <SelectItem value="2">화요일</SelectItem>
                                        <SelectItem value="3">수요일</SelectItem>
                                        <SelectItem value="4">목요일</SelectItem>
                                        <SelectItem value="5">금요일</SelectItem>
                                        <SelectItem value="6">토요일</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {frequency === 'monthly' && (
                            <div>
                                <Label>일</Label>
                                <Select value={dayOfMonth.toString()} onValueChange={(v) => setDayOfMonth(parseInt(v))}>
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 31 }, (_, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                                                {i + 1}일
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-2">
                                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">다음 실행 예정</p>
                                    <p className="text-xs mt-1">{nextRun}</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4 mt-4">
                        <div>
                            <Label>Cron 표현식</Label>
                            <div className="flex gap-2 mt-2">
                                <Input
                                    value={cronExpression}
                                    onChange={(e) => setCronExpression(e.target.value)}
                                    placeholder="0 9 * * *"
                                    className="font-mono flex-1"
                                />
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={copyCron}
                                    title="복사"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                형식: 분 시 일 월 요일
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border">
                            <p className="text-sm font-semibold mb-2">Cron 표현식 예제</p>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <code className="text-slate-600">0 9 * * *</code>
                                    <span className="text-slate-500">매일 오전 9시</span>
                                </div>
                                <div className="flex justify-between">
                                    <code className="text-slate-600">*/15 * * * *</code>
                                    <span className="text-slate-500">15분마다</span>
                                </div>
                                <div className="flex justify-between">
                                    <code className="text-slate-600">0 9 * * 1-5</code>
                                    <span className="text-slate-500">평일 오전 9시</span>
                                </div>
                                <div className="flex justify-between">
                                    <code className="text-slate-600">0 9 1 * *</code>
                                    <span className="text-slate-500">매월 1일 오전 9시</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-start gap-2">
                                <Calendar className="w-5 h-5 text-green-600 mt-0.5" />
                                <div className="text-sm text-green-800">
                                    <p className="font-semibold">현재 설정</p>
                                    <p className="text-xs mt-1 font-mono">{cronExpression}</p>
                                    <p className="text-xs mt-1">다음 실행: {nextRun}</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="presets" className="space-y-2 mt-4">
                        {presets.map((preset) => (
                            <Button
                                key={preset.id}
                                type="button"
                                variant={cronExpression === preset.cron ? 'default' : 'outline'}
                                className="w-full justify-between h-auto p-3"
                                onClick={() => setCronExpression(preset.cron)}
                            >
                                <span className="font-medium">{preset.name}</span>
                                <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                                    {preset.cron}
                                </code>
                            </Button>
                        ))}

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 mt-4">
                            <div className="flex items-start gap-2">
                                <Play className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div className="text-sm text-purple-800">
                                    <p className="font-semibold">빠른 시작</p>
                                    <p className="text-xs mt-1">
                                        일반적인 스케줄을 선택하여 빠르게 설정하세요
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-slate-600 hover:bg-slate-700">
                    <Clock className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default SchedulerInspector;
