import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useNodeStore from '../../hooks/useNodeStore';
import { useToast } from "@/components/ui/use-toast";
import {
    Settings, Save, AlertTriangle, Search, Filter, Scissors, LayoutTemplate, Sparkles, MessageSquare,
    Globe, Clapperboard, Image, Newspaper, Type, Music, Eye, Play, BrainCircuit, UserCircle2
} from "lucide-react";
import api from '../../lib/api';
import AssetInspector from './inspectors/AssetInspector';
import AIAgentInspector from './inspectors/AIAgentInspector';
import AIPersonaInspector from './inspectors/AIPersonaInspector';
import AIVoiceNodeInspector from './inspectors/AIVoiceNodeInspector';
import StudioSubtitleNodeInspector from './inspectors/StudioSubtitleNodeInspector';
import UploadNodeInspector from './inspectors/UploadNodeInspector';
import WebScraperInspector from './inspectors/WebScraperInspector';
import VideoGenInspector from './inspectors/VideoGenInspector';
import SmartCutInspector from './inspectors/SmartCutInspector';
import CropTemplateInspector from './inspectors/CropTemplateInspector';
import ScriptRemixInspector from './inspectors/ScriptRemixInspector';
import TextAnimInspector from './inspectors/TextAnimInspector';
import AudioMixInspector from './inspectors/AudioMixInspector';
import LocalizerInspector from './inspectors/LocalizerInspector';
import SyncVideoInspector from './inspectors/SyncVideoInspector';
import DistributionInspector from './inspectors/DistributionInspector';
import WorkerInspector from './inspectors/WorkerInspector';
import SchedulerInspector from './inspectors/SchedulerInspector';


interface NodeInspectorProps {
    nodeId: string | null;
    open: boolean;
    onClose: () => void;
}

const getIcon = (type: string | undefined) => {
    switch (type) {
        case 'assetLoaderNode': return <Clapperboard className="w-5 h-5 text-indigo-500" />;
        case 'textOverlayNode': return <Type className="w-5 h-5 text-pink-500" />;
        case 'ttsNode': return <Music className="w-5 h-5 text-orange-500" />;
        case 'schedulerNode': return <Settings className="w-5 h-5 text-slate-500" />;
        case 'aiAgentNode': return <BrainCircuit className="w-5 h-5 text-purple-500" />;
        case 'aiPersonaNode': return <UserCircle2 className="w-5 h-5 text-pink-500" />;
        case 'webScraperNode': return <Globe className="w-5 h-5 text-blue-500" />;
        case 'distributionNode': return <Newspaper className="w-5 h-5 text-green-500" />;
        case 'monitorNode': return <Eye className="w-5 h-5 text-purple-500" />;
        default: return <Settings className="w-5 h-5 text-slate-500" />;
    }
};

const NodeInspector: React.FC<NodeInspectorProps> = ({ nodeId, open, onClose }) => {
    const { nodes, updateNodeData } = useNodeStore();
    const { toast } = useToast();
    const [formData, setFormData] = useState<any>({});
    const [brandChannels, setBrandChannels] = useState<any[]>([]);
    const node = nodeId ? nodes.find(n => n.id === nodeId) : null;

    useEffect(() => {
        if (node?.type === 'distributionNode') {
            api.get('/brand-channels/').then(res => {
                setBrandChannels(res.data || []);
            }).catch(err => {
                console.error("Failed to fetch brand channels", err);
            });
        }
    }, [node?.type]);

    useEffect(() => {
        if (node) {
            setFormData({ ...node.data });
        }
    }, [node]);

    const handleChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (nodeId) {
            updateNodeData(nodeId, formData);
            toast({ title: "저장됨", description: "노드 설정이 업데이트되었습니다." });
            onClose();
        }
    };

    if (!node) return null;

    const renderCommonFields = () => (
        <div className="space-y-4 border-b pb-4 mb-4">
            <div className="space-y-2">
                <Label>노드 이름 (Label)</Label>
                <Input value={formData.label || ''} onChange={e => handleChange('label', e.target.value)} placeholder="노드 이름을 입력하세요" />
            </div>
        </div>
    );

    const renderTypeSpecificFields = () => {
        const commonInspectorProps = {
            node,
            updateData: (data: any) => {
                if (nodeId) updateNodeData(nodeId, data);
                setFormData((prev: any) => ({ ...prev, ...data }));
            }
        };

        switch (node.type) {
            case 'manualTriggerNode':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>대상 URL</Label>
                            <Input value={formData.url || ''} onChange={e => handleChange('url', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>
                );

            case 'assetLoaderNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <AssetInspector {...commonInspectorProps} />
                    </div>
                );

            case 'schedulerNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <SchedulerInspector {...commonInspectorProps} />
                    </div>
                );

            case 'aiAgentNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <AIAgentInspector {...commonInspectorProps} />
                    </div>
                );

            case 'aiPersonaNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <AIPersonaInspector {...commonInspectorProps} />
                    </div>
                );

            case 'ttsNode':
                return (
                    <div className="h-[750px] border rounded-lg overflow-hidden relative">
                        <AIVoiceNodeInspector data={node.data} nodeId={node.id} />
                    </div>
                );

            case 'studioSubtitleNode':
                return (
                    <div className="h-[750px] border rounded-lg overflow-hidden relative">
                        <StudioSubtitleNodeInspector data={node.data} id={node.id} />
                    </div>
                );

            case 'uploadToQueueNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <UploadNodeInspector node={node} onUpdate={(data) => {
                            if (nodeId) updateNodeData(nodeId, data);
                            setFormData((prev: any) => ({ ...prev, ...data }));
                        }} />
                    </div>
                );

            case 'webScraperNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <WebScraperInspector {...commonInspectorProps} />
                    </div>
                );

            case 'videoGenNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <VideoGenInspector {...commonInspectorProps} />
                    </div>
                );

            case 'smartCutNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <SmartCutInspector {...commonInspectorProps} />
                    </div>
                );

            case 'cropTemplateNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <CropTemplateInspector {...commonInspectorProps} />
                    </div>
                );

            case 'scriptRemixNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <ScriptRemixInspector {...commonInspectorProps} />
                    </div>
                );

            case 'textAnimNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <TextAnimInspector {...commonInspectorProps} />
                    </div>
                );

            case 'audioMixNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <AudioMixInspector {...commonInspectorProps} />
                    </div>
                );

            case 'localizerNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <LocalizerInspector {...commonInspectorProps} />
                    </div>
                );

            case 'syncVideoNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <SyncVideoInspector {...commonInspectorProps} />
                    </div>
                );

            case 'distributionNode':
                return (
                    <div className="h-[650px] border rounded-lg overflow-hidden relative">
                        <DistributionInspector {...commonInspectorProps} />
                    </div>
                );

            case 'workerNode':
                return (
                    <div className="h-[600px] border rounded-lg overflow-hidden relative">
                        <WorkerInspector {...commonInspectorProps} />
                    </div>
                );

            default:
                return <div className="text-sm text-slate-500 italic p-4">이 노드 유형에 대한 추가 설정이 없습니다.</div>;
        }
    };

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] h-screen flex flex-col">
                <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b shrink-0">
                    <div className="space-y-1">
                        <SheetTitle className="flex items-center gap-2">
                            {getIcon(node?.type)}
                            {node?.data?.label || '노드 설정 (Inspector)'}
                        </SheetTitle>
                        <SheetDescription>
                            선택한 노드의 속성을 구성합니다.
                        </SheetDescription>
                    </div>
                    {/* [NEW] Execute Button in Inspector */}
                    {node?.type === 'assetLoaderNode' && (
                        <Button
                            size="icon"
                            variant="outline"
                            className="mr-8 h-8 w-8 text-green-600 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-700"
                            title="노드 실행"
                            onClick={async () => {
                                if (node.type === 'assetLoaderNode') {
                                    const workflowId = window.location.pathname.split('/workflows/')[1];
                                    if (!workflowId) return;

                                    const payload = {
                                        selected_ids: formData.selectedIds || [],
                                        asset_type: formData.assetType || 'video',
                                        video_rules: formData.videoRules || {},
                                        script_rules: formData.scriptRules || {}
                                    };

                                    try {
                                        const res = await api.post(`/workflows/${workflowId}/run`, payload);
                                        const count = res.data.assets_processed || (payload.selected_ids ? payload.selected_ids.length : 0);
                                        const results = res.data.results || {};

                                        // HYDRATE RESULTS: Update each node with its execution output
                                        Object.entries(results).forEach(([nId, output]: [string, any]) => {
                                            updateNodeData(nId, { executionResult: output, ...output }); // Merge for convenience
                                        });

                                        toast({
                                            title: "실행 완료",
                                            description: `${count}개 자산 처리 완료. 결과를 확인하세요.`,
                                            className: "bg-green-50 border-green-200 text-green-800"
                                        });
                                        // onClose(); // Removed per user feedback to keep context open
                                    } catch (e: any) {
                                        console.error(e);
                                        const msg = e.response?.data?.detail || "실행 오류";
                                        toast({ variant: "destructive", title: "실행 실패", description: msg });
                                    }
                                } else {
                                    toast({ title: "실행 중...", description: "이 노드 유형은 아직 실행을 지원하지 않습니다." });
                                }
                            }}
                        >
                            <Play className="w-4 h-4 fill-current" />
                        </Button>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-scroll py-6 space-y-6">
                    {renderCommonFields()}
                    {renderTypeSpecificFields()}
                </div>

                <div className="mt-auto flex justify-end gap-3 pt-4 border-t shrink-0">
                    <Button variant="outline" onClick={onClose}>취소</Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                        <Save className="w-4 h-4 mr-2" /> 변경사항 저장
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default NodeInspector;
