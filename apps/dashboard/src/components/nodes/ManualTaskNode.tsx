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
    PauseCircle, Settings, CheckCircle, XCircle, Clock,
    Upload, FileText, Mail, MessageSquare, Plus, Trash2, AlertTriangle
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InputField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number';
    required: boolean;
    options?: string[];
}

const ManualTaskNode = ({ data, selected }: NodeProps) => {
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('approval');

    // 작업 타입
    const [taskType, setTaskType] = useState(data.taskType || 'approval');

    // 승인 설정
    const [approvalMessage, setApprovalMessage] = useState(data.approvalMessage || '');
    const [approver, setApprover] = useState(data.approver || 'all');

    // 입력 설정
    const [inputFields, setInputFields] = useState<InputField[]>(data.inputFields || []);

    // 파일 업로드 설정
    const [allowedTypes, setAllowedTypes] = useState<string[]>(data.allowedTypes || ['video']);
    const [maxSize, setMaxSize] = useState(data.maxSize || 100);
    const [maxCount, setMaxCount] = useState(data.maxCount || 5);

    // 공통 설정
    const [timeoutMinutes, setTimeoutMinutes] = useState(data.timeoutMinutes || 60);
    const [timeoutAction, setTimeoutAction] = useState(data.timeoutAction || 'auto_reject');
    const [notifications, setNotifications] = useState<string[]>(data.notifications || ['email']);

    const addInputField = () => {
        setInputFields([...inputFields, {
            name: `field_${inputFields.length + 1}`,
            label: '새 필드',
            type: 'text',
            required: false
        }]);
    };

    const removeInputField = (index: number) => {
        setInputFields(inputFields.filter((_, i) => i !== index));
    };

    const updateInputField = (index: number, field: Partial<InputField>) => {
        const newFields = [...inputFields];
        newFields[index] = { ...newFields[index], ...field };
        setInputFields(newFields);
    };

    const toggleFileType = (type: string) => {
        setAllowedTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleNotification = (channel: string) => {
        setNotifications(prev =>
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        );
    };

    const handleSave = () => {
        if (data.onChange) {
            data.onChange({
                taskType,
                approvalMessage,
                approver,
                inputFields,
                allowedTypes,
                maxSize,
                maxCount,
                timeoutMinutes,
                timeoutAction,
                notifications
            });
        }
        setInspectorOpen(false);
    };

    const getTaskTypeIcon = () => {
        switch (taskType) {
            case 'approval': return <CheckCircle className="w-5 h-5" />;
            case 'input': return <FileText className="w-5 h-5" />;
            case 'file_upload': return <Upload className="w-5 h-5" />;
            default: return <PauseCircle className="w-5 h-5" />;
        }
    };

    const getTaskTypeLabel = () => {
        switch (taskType) {
            case 'approval': return '승인 대기';
            case 'input': return '입력 대기';
            case 'file_upload': return '파일 업로드';
            default: return '수동 작업';
        }
    };

    return (
        <>
            <div className={`relative w-[280px] transition-all duration-300 ${selected ? 'ring-2 ring-orange-500 rounded-xl' : ''}`}>
                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-4 h-4 bg-orange-500 border-2 border-white shadow-md"
                />

                <Card className="overflow-hidden border-0 shadow-lg bg-white hover:shadow-xl transition-shadow">
                    {/* Header */}
                    <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500" />

                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-600">
                                {getTaskTypeIcon()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-orange-50 text-orange-700 border border-orange-200">
                                        {getTaskTypeLabel()}
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

                        {/* 상태 정보 */}
                        <div className="mt-3 space-y-2">
                            {taskType === 'approval' && approvalMessage && (
                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                    <p className="line-clamp-2">{approvalMessage}</p>
                                </div>
                            )}

                            {taskType === 'input' && inputFields.length > 0 && (
                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                    <p>{inputFields.length}개 입력 필드</p>
                                </div>
                            )}

                            {taskType === 'file_upload' && (
                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                    <p>{allowedTypes.join(', ')} 파일 허용</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    타임아웃
                                </span>
                                <span className="font-medium text-orange-700">{timeoutMinutes}분</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-4 h-4 bg-orange-500 border-2 border-white shadow-md"
                    isConnectable={true}
                />
            </div>

            {/* Inspector Dialog */}
            <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <PauseCircle className="w-5 h-5" />
                            수동 작업 설정
                        </DialogTitle>
                        <p className="text-orange-50 text-sm mt-1">사용자 개입이 필요한 작업을 설정하세요</p>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        {/* 작업 타입 선택 */}
                        <div className="mb-6">
                            <Label className="text-sm font-semibold">작업 유형</Label>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                <Button
                                    type="button"
                                    variant={taskType === 'approval' ? 'default' : 'outline'}
                                    className="h-20 flex-col gap-2"
                                    onClick={() => setTaskType('approval')}
                                >
                                    <CheckCircle className="w-6 h-6" />
                                    <span className="text-xs">승인</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={taskType === 'input' ? 'default' : 'outline'}
                                    className="h-20 flex-col gap-2"
                                    onClick={() => setTaskType('input')}
                                >
                                    <FileText className="w-6 h-6" />
                                    <span className="text-xs">사용자 입력</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={taskType === 'file_upload' ? 'default' : 'outline'}
                                    className="h-20 flex-col gap-2"
                                    onClick={() => setTaskType('file_upload')}
                                >
                                    <Upload className="w-6 h-6" />
                                    <span className="text-xs">파일 업로드</span>
                                </Button>
                            </div>
                        </div>

                        <Tabs value={taskType} className="w-full">
                            {/* 승인 작업 */}
                            <TabsContent value="approval" className="space-y-6 mt-0">
                                <div>
                                    <Label>승인 메시지</Label>
                                    <Textarea
                                        value={approvalMessage}
                                        onChange={(e) => setApprovalMessage(e.target.value)}
                                        placeholder="이 영상을 업로드하시겠습니까?"
                                        className="mt-2 min-h-[100px]"
                                    />
                                </div>

                                <div>
                                    <Label>승인자</Label>
                                    <Select value={approver} onValueChange={setApprover}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">모든 관리자</SelectItem>
                                            <SelectItem value="owner">소유자만</SelectItem>
                                            <SelectItem value="specific">특정 사용자</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* 사용자 입력 */}
                            <TabsContent value="input" className="space-y-6 mt-0">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>입력 필드</Label>
                                        <Button size="sm" variant="outline" onClick={addInputField}>
                                            <Plus className="w-3 h-3 mr-1" />
                                            필드 추가
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {inputFields.map((field, idx) => (
                                            <div key={idx} className="p-3 border rounded-lg space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold">필드 {idx + 1}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => removeInputField(idx)}
                                                        className="text-red-500 h-7"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        value={field.label}
                                                        onChange={(e) => updateInputField(idx, { label: e.target.value })}
                                                        placeholder="필드 이름"
                                                        className="text-sm"
                                                    />
                                                    <Select
                                                        value={field.type}
                                                        onValueChange={(value: any) => updateInputField(idx, { type: value })}
                                                    >
                                                        <SelectTrigger className="text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="text">텍스트</SelectItem>
                                                            <SelectItem value="textarea">긴 텍스트</SelectItem>
                                                            <SelectItem value="number">숫자</SelectItem>
                                                            <SelectItem value="select">선택</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={field.required}
                                                        onCheckedChange={(checked) => updateInputField(idx, { required: checked })}
                                                    />
                                                    <Label className="text-xs">필수 입력</Label>
                                                </div>
                                            </div>
                                        ))}

                                        {inputFields.length === 0 && (
                                            <div className="text-center py-8 text-slate-600">
                                                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">입력 필드를 추가하세요</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 파일 업로드 */}
                            <TabsContent value="file_upload" className="space-y-6 mt-0">
                                <div>
                                    <Label>허용 파일 유형</Label>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {['video', 'image', 'document'].map(type => (
                                            <Button
                                                key={type}
                                                type="button"
                                                variant={allowedTypes.includes(type) ? 'default' : 'outline'}
                                                className="h-10"
                                                onClick={() => toggleFileType(type)}
                                            >
                                                {type === 'video' && '🎬 비디오'}
                                                {type === 'image' && '🖼️ 이미지'}
                                                {type === 'document' && '📄 문서'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>최대 크기 (MB)</Label>
                                        <Input
                                            type="number"
                                            value={maxSize}
                                            onChange={(e) => setMaxSize(parseInt(e.target.value))}
                                            min={1}
                                            max={1000}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>최대 개수</Label>
                                        <Input
                                            type="number"
                                            value={maxCount}
                                            onChange={(e) => setMaxCount(parseInt(e.target.value))}
                                            min={1}
                                            max={20}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg text-center">
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                    <p className="text-sm text-slate-600">드래그 앤 드롭 영역 미리보기</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        최대 {maxSize}MB, {maxCount}개 파일
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* 공통 설정 */}
                        <div className="mt-6 pt-6 border-t space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>타임아웃 (분)</Label>
                                    <Input
                                        type="number"
                                        value={timeoutMinutes}
                                        onChange={(e) => setTimeoutMinutes(parseInt(e.target.value))}
                                        min={1}
                                        max={1440}
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label>타임아웃 시 동작</Label>
                                    <Select value={timeoutAction} onValueChange={setTimeoutAction}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto_approve">자동 승인</SelectItem>
                                            <SelectItem value="auto_reject">자동 거부</SelectItem>
                                            <SelectItem value="skip">건너뛰기</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>알림 채널</Label>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {['email', 'slack', 'discord'].map(channel => (
                                        <Button
                                            key={channel}
                                            type="button"
                                            variant={notifications.includes(channel) ? 'default' : 'outline'}
                                            className="h-10"
                                            onClick={() => toggleNotification(channel)}
                                        >
                                            {channel === 'email' && <Mail className="w-4 h-4 mr-1" />}
                                            {channel === 'slack' && <MessageSquare className="w-4 h-4 mr-1" />}
                                            {channel === 'discord' && <MessageSquare className="w-4 h-4 mr-1" />}
                                            {channel.charAt(0).toUpperCase() + channel.slice(1)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold">알림</p>
                                <p className="text-xs mt-1">
                                    이 노드는 워크플로우를 일시 중지하고 사용자 작업을 기다립니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                        <Button variant="outline" onClick={() => setInspectorOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
                            저장
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(ManualTaskNode);
