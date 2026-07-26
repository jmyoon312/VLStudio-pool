import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Share2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import api from '../../lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DistributionNode = ({ id, data, selected }: NodeProps) => {
    // Note: reactflow passes 'id' prop which is the node id.
    const [channels, setChannels] = useState<any[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>(data.brand_channel_id || "");
    const [channelInfo, setChannelInfo] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // We need a way to update node data. 
    // In ReactFlow custom nodes, we usually don't have direct access to 'setNodes'.
    // However, for this UI to be interactive without global store:
    // We can assume the NodeInspector handles the actual data save, OR 
    // IF we want "Worker-Integrated UI" ON THE NODE, we must update the data via a context or hook if available.
    // For now, let's just manage local state and assume the user must select it here, 
    // but saving persists only if we had a callback.
    // Ideally, we use useReactFlow to update node data.

    // BUT typically, NodeInspector is for editing. The user specifically asked for:
    // "Inspector: Replace 'API Key Input' with a Dropdown: 'Select Brand Channel'"
    // Oh wait. "Inspector: Replace..."
    // AND "Technical Directive: The DistributionNode must visually indicate which Worker is handling the upload"
    // So the NODE just DISPLAYS. The INSPECTOR edits.
    // BUT the text "Worker-Integrated UI" suggests the Node UI shows status.
    // The previous implementation fetched based on `data.brand_channel_id`.
    // I will keep the fetch logic but improve the visual indication.
    // AND check if I should add a dropdown *on the node*.
    // Nodes are small. Dropdowns are tricky on canvas (zoom/pan issues).
    // Usually editing is done in Inspector.
    // However, for "Worker-Integrated UI", showing the "Worker Name" is key.
    // I will stick to DISPLAYING the connected worker prominently on the node.
    // If the user wants to SELECT, they use the Inspector (as the prompt says "Inspector: Replace...").
    // Wait, the Prompt says: "Mission: Implement ... DistributionNode (Worker-Integrated UI)".
    // And "Inspector: Replace...".
    // So the Node UI should just SHOW the relationship.
    // I will improve the Node UI to look like a "Connected Module" showing the worker.

    // Re-reading: "Inspector: Replace 'API Key Input'..." -> Inspector change.
    // "Technical Directive: The DistributionNode must visually indicate..." -> Node UI change.

    // So I will make the Node UI robustly fetch and display the worker.
    // I will NOT put the dropdown on the node to avoid UX issues, unless explicitly forced.
    // "frontend/src/components/nodes/DistributionNode.tsx (Worker-Integrated UI)"

    useEffect(() => {
        const fetchStatus = async () => {
            if (!data.brand_channel_id) return;
            try {
                const res = await api.get('/brand-channels/');
                const channel = res.data.find((c: any) => c.id === parseInt(data.brand_channel_id));

                if (channel) {
                    setChannelInfo(channel);
                    setError(null);
                } else {
                    setError("Channel Not Found");
                    setChannelInfo(null);
                }
            } catch (e) {
                setError("Connection Error");
            }
        };

        fetchStatus();
        // Poll less frequently
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
    }, [data.brand_channel_id]);

    return (
        <Card className={`w-[280px] shadow-md border-2 transition-colors ${selected ? 'border-primary' : (error ? 'border-red-400' : 'border-slate-200')}`}>
            {/* Header */}
            <CardHeader className={`p-3 pb-2 ${error ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                        <Share2 className={`w-4 h-4 ${error ? 'text-red-500' : 'text-blue-500'}`} />
                        채널 배포 (Distribution)
                    </CardTitle>
                    {error ? (
                        <Badge variant="destructive" className="text-[10px]"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>
                    ) : (data.brand_channel_id ? (
                        <Badge variant="outline" className="text-[10px] bg-white text-green-600 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Ready
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">Unlinked</Badge>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="p-3 text-xs space-y-3">
                {/* Channel Info */}
                {channelInfo ? (
                    <div className="flex items-center gap-3 bg-white p-2 rounded border border-slate-100 shadow-sm">
                        <img src={channelInfo.thumbnail_url} alt="Channel" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-slate-800">{channelInfo.title}</p>
                            <p className="text-[9px] text-slate-600 truncate">Privacy: {channelInfo.default_privacy || "Public"}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-600 italic text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200">
                        {data.brand_channel_id ? "Loading info..." : "채널을 선택해주세요"}
                    </div>
                )}

                {/* Worker Integration UI (The Directive) */}
                {channelInfo?.worker && (
                    <div className="mt-2 text-[10px]">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span>Linked Worker</span>
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                </span>
                                Active
                            </span>
                        </div>
                        <div className="bg-slate-50 text-slate-800 p-2 rounded flex items-center justify-between">
                            <span className="truncate max-w-[120px]">{channelInfo.worker.email}</span>
                            <Badge className="bg-slate-600 hover:bg-slate-600 text-[9px] h-4 px-1">Worker {channelInfo.worker.id}</Badge>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-500 font-medium text-[10px] text-center">{error}</p>}

                {data.input_key && (
                    <div className="flex justify-end mb-1">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-white text-slate-500 border-slate-300">
                            Key: {data.input_key}
                        </Badge>
                    </div>
                )}

                <div className="relative h-4 mt-1 pt-2">
                    <Handle type="target" position={Position.Left} id="input" className="w-2.5 h-2.5 bg-slate-400 border-2 border-white top-2" />
                    <span className="absolute left-3 top-0.5 text-[10px] text-slate-600">Final Video</span>
                </div>
            </CardContent>
        </Card>
    );
};

export default memo(DistributionNode);
