import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeToolbar } from 'reactflow'; // [NEW] NodeToolbar
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // [NEW]
import { Database, FileVideo, FileText, AlertCircle, Filter, Zap, Play } from 'lucide-react'; // [NEW] Play
import { cn } from "@/lib/utils";
import api from '@/lib/api';
import { useReactFlow } from 'reactflow'; // [NEW] useReactFlow

const AssetLoaderNode = ({ data, selected }: NodeProps) => {
    // Determine type for icon and color
    const type = data.assetType || 'video'; // 'video' | 'script'
    const mode = data.mode || 'static'; // 'static' | 'dynamic'
    const { setNodes } = useReactFlow(); // [NEW] Access Global State Accessor

    return (
        <>
            <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-2 p-2 bg-white rounded-lg shadow-xl border">
                <Button
                    size="icon"
                    variant="default"
                    className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md p-0"
                    title={`실행 (${data.selectedIds?.length || 0})`}
                    onClick={() => {
                        // Trigger Run Logic
                        const workflowId = window.location.pathname.split('/workflows/')[1];
                        if (workflowId && data.selectedIds?.length > 0) {
                            api.post(`/workflows/${workflowId}/run`, { override_assets: data.selectedIds })
                                .then(() => alert(`워크플로우 실행 시작! (${data.selectedIds.length}개 자산)`))
                                .catch(err => console.error(err));
                        }
                    }}
                    disabled={!data.selectedIds || data.selectedIds.length === 0}
                >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                </Button>
            </NodeToolbar>

            <div className={cn(
                "relative min-w-[200px] transition-all duration-300",
                selected ? 'ring-2 ring-emerald-500 rounded-xl' : ''
            )}>
                <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur">
                    <div className={cn(
                        "h-2 bg-gradient-to-r",
                        mode === 'dynamic'
                            ? "from-violet-500 to-fuchsia-500 animate-pulse"
                            : (type === 'video' ? "from-emerald-400 to-teal-600" : "from-blue-400 to-indigo-600")
                    )} />
                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                                mode === 'dynamic' ? "bg-violet-100 text-violet-600" :
                                    (type === 'video' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")
                            )}>
                                {mode === 'dynamic' ? <Zap className="w-6 h-6" /> : <Database className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">
                                    {data.label || (mode === 'dynamic' ? "Auto Query" : "자산 로더")}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {mode === 'dynamic' ? (
                                        <Badge variant="secondary" className="text-[10px] flex gap-1 bg-violet-100 text-violet-700">
                                            <Filter className="w-3 h-3" /> Dynamic
                                        </Badge>
                                    ) : (
                                        <>
                                            {type === 'video' && <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 flex gap-1"><FileVideo className="w-3 h-3" /> Video</Badge>}
                                            {type === 'script' && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 flex gap-1"><FileText className="w-3 h-3" /> Script</Badge>}
                                        </>
                                    )}
                                    {mode === 'static' && !data.file_path && <Badge variant="destructive" className="text-[10px] flex gap-1"><AlertCircle className="w-3 h-3" /> Unset</Badge>}
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Query Info */}
                        {mode === 'dynamic' && (
                            <div className="mt-3 p-2 bg-violet-50 text-[10px] text-violet-800 rounded border border-violet-100 font-medium">
                                {data.query_keywords?.join(", ") || "All"} ({data.query_hours || 24}h)
                            </div>
                        )}

                        {/* Static Preview */}
                        {mode === 'static' && data.thumbnail && (
                            <div className="mt-3 rounded overflow-hidden aspect-video bg-slate-100">
                                <img src={data.thumbnail} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}

                        {/* [NEW] Phase 3: Execution Button for Selected Assets */}
                        {data.selectedIds && data.selectedIds.length > 0 && (
                            <div className="mt-4">
                                <Button
                                    size="sm"
                                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md font-bold text-xs"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const workflowId = window.location.pathname.split('/workflows/')[1];

                                        // 1. Construct Payload
                                        const payload = {
                                            selected_ids: data.selectedIds || [],
                                            asset_type: data.assetType || 'video',
                                            video_rules: data.videoRules || {},
                                            script_rules: data.scriptRules || {}
                                        };

                                        if (workflowId) {
                                            try {
                                                const res = await api.post(`/workflows/${workflowId}/run`, payload);
                                                // Success Feedback
                                                const count = res.data.assets_processed || payload.selected_ids.length;
                                                const outputs = res.data.node_outputs || {};

                                                // HYDRATE GRAPH STATE
                                                setNodes((nds) => nds.map((node) => {
                                                    if (outputs[node.id]) {
                                                        return {
                                                            ...node,
                                                            data: {
                                                                ...node.data,
                                                                executionResult: outputs[node.id], // Save SDP
                                                                timestamp: Date.now(), // Trigger Updates
                                                                status: 'success'
                                                            }
                                                        };
                                                    }
                                                    return node;
                                                }));

                                                alert(`워크플로우 실행 시작! (${count}개 자산)`);
                                            } catch (err: any) {
                                                console.error(err);
                                                // Smart Error Handling
                                                if (err.response) {
                                                    const msg = err.response.data?.detail || "실행 실패";
                                                    alert(`오류: ${msg}`);
                                                } else {
                                                    alert("서버 연결 실패");
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <Play className="w-3 h-3 mr-1 fill-white" />
                                    실행 ({data.selectedIds.length}개 선택됨)
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Output Only - It's a Source */}
                <Handle type="source" position={Position.Right} className={cn(
                    "w-4 h-4 border-2 border-white",
                    mode === 'dynamic' ? "bg-violet-500" : (type === 'video' ? "bg-emerald-500" : "bg-blue-500")
                )} />
            </div>
        </>
    );
};

export default memo(AssetLoaderNode);
