import React, { useCallback, useState } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    Edge, 
    Node, 
    NodeTypes,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import AgentTopologyNode, { AgentNodeData } from './AgentTopologyNode';
import { useSwarmStore } from '@/hooks/useSwarmStore';

const nodeTypes: NodeTypes = {
    agentNode: AgentTopologyNode,
};

// Initial Mock Layout representing the 1-Coordinator + Specialist Agents structure
const initialNodes: Node<AgentNodeData>[] = [
    {
        id: 'global_overseer',
        type: 'agentNode',
        position: { x: 400, y: 0 },
        data: { label: '스웜 지휘 통제 노드', role: 'COORDINATOR', status: 'IDLE', skills: ['start_niche_mission', 'panic_stop_all'] }
    },
    {
        id: 'coordinator_1',
        type: 'agentNode',
        position: { x: 400, y: 250 },
        data: { label: '채널 매니저', role: 'COORDINATOR', status: 'THINKING', skills: ['start_niche_mission', 'generate_platform_metadata'] }
    },
    {
        id: 'researcher_1',
        type: 'agentNode',
        position: { x: 0, y: 500 },
        data: { label: '트렌드 스카우트', role: 'RESEARCHER', status: 'PRODUCING', skills: ['scout_market_gap', 'analyze_viral_trend', 'predict_thumbnail_ctr'] }
    },
    {
        id: 'writer_1',
        type: 'agentNode',
        position: { x: 400, y: 500 },
        data: { label: '카피라이터 (작가)', role: 'WRITER', status: 'IDLE', skills: ['inject_native_ssml', 'generate_director_schema', 'mutate_script_persona', 'generate_vocal_track'] }
    },
    {
        id: 'media_1',
        type: 'agentNode',
        position: { x: 800, y: 500 },
        data: { label: '시각 예술 전문가', role: 'MEDIA', status: 'IDLE', skills: ['apply_sovereign_shield', 'generate_scene_asset', 'verify_and_upscale_asset'] }
    },
    {
        id: 'editor_1',
        type: 'agentNode',
        position: { x: 400, y: 750 },
        data: { label: '리모션 편집기', role: 'EDITOR', status: 'IDLE', skills: ['validate_scene_consistency', 'trigger_capcut_automation'] }
    },
    {
        id: 'publisher_1',
        type: 'agentNode',
        position: { x: 800, y: 750 },
        data: { label: '배포 전문가', role: 'PUBLISHER', status: 'IDLE', skills: ['execute_global_syndication', 'generate_platform_metadata'] }
    },
    {
        id: 'analyst_1',
        type: 'agentNode',
        position: { x: 400, y: 1000 },
        data: { label: '데이터 분석가', role: 'ANALYST', status: 'IDLE', skills: ['analyze_viral_trend', 'predict_thumbnail_ctr'] }
    }
];

const initialEdges: Edge[] = [
    { id: 'e_g_c', source: 'global_overseer', target: 'coordinator_1', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 } },
    { id: 'e_c_r', source: 'coordinator_1', target: 'researcher_1', animated: true, style: { stroke: '#10b981', strokeWidth: 3 } },
    { id: 'e_c_w', source: 'coordinator_1', target: 'writer_1', animated: false, style: { stroke: '#f59e0b', strokeWidth: 3 } },
    { id: 'e_c_m', source: 'coordinator_1', target: 'media_1', animated: false, style: { stroke: '#e11d48', strokeWidth: 3 } },
    { id: 'e_w_e', source: 'writer_1', target: 'editor_1', animated: false, style: { stroke: 'hsl(var(--border))', strokeWidth: 2 } },
    { id: 'e_m_e', source: 'media_1', target: 'editor_1', animated: false, style: { stroke: 'hsl(var(--border))', strokeWidth: 2 } },
    { id: 'e_e_p', source: 'editor_1', target: 'publisher_1', animated: false, style: { stroke: 'hsl(var(--border))', strokeWidth: 2 } },
    { id: 'e_p_a', source: 'publisher_1', target: 'analyst_1', animated: false, style: { stroke: 'hsl(var(--border))', strokeWidth: 2 }, label: '지연 동기화' },
    { id: 'e_a_c', source: 'analyst_1', target: 'coordinator_1', animated: true, style: { stroke: '#06b6d4', strokeWidth: 3 }, label: '지혜 환류' }
];

interface SwarmTopologyCanvasProps {
    onNodeClick?: (nodeId: string, nodeData: AgentNodeData) => void;
}

export const SwarmTopologyCanvas: React.FC<SwarmTopologyCanvasProps> = ({ onNodeClick }) => {
    const { isConnected } = useSwarmStore();

    // Map the click handler directly so nodes can open inspectors
    const interactiveNodes = initialNodes.map(node => ({
        ...node,
        data: {
            ...node.data,
            onClick: () => onNodeClick && onNodeClick(node.id, node.data)
        }
    }));

    const [nodes, setNodes] = useState<Node[]>(interactiveNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    return (
        <div className="w-full h-full bg-muted/10 rounded-[3rem] overflow-hidden border border-border shadow-inner relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.5, maxZoom: 1.0 }}
                maxZoom={1.0}
                minZoom={0.2}
                className="bg-transparent"
            >
                <Background color="hsl(var(--border))" gap={24} size={1} className="opacity-20" />
                <Controls className="bg-card border-border shadow-md rounded-2xl overflow-hidden" />
            </ReactFlow>
            
            {/* HUD Overlay */}
            <div className="absolute top-12 left-12 pointer-events-none">
                <div className="bg-card/95 backdrop-blur-xl border border-border p-6 rounded-[2rem] shadow-md">
                    <h2 className="text-foreground font-black uppercase tracking-[0.2em] text-xs italic">실시간 작업 흐름도</h2>
                    <p className="text-muted-foreground text-[10px] font-black tracking-widest mt-2 uppercase opacity-60">Autonomous Graph • Model: Directed Acyclic</p>
                </div>
            </div>
            
            <div className="absolute bottom-8 left-8 pointer-events-none flex gap-4">
                <div className="bg-primary shadow-md text-primary-foreground font-black text-[10px] px-6 py-3 rounded-full uppercase tracking-widest flex items-center gap-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
                    함대 노드 활성 (ACTIVE)
                </div>
                {isConnected ? (
                    <div className="bg-emerald-500 shadow-md text-white font-black text-[10px] px-6 py-3 rounded-full uppercase tracking-widest flex items-center gap-3">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
                        소켓 동기화 (ONLINE)
                    </div>
                ) : (
                    <div className="bg-rose-500 shadow-md text-white font-black text-[10px] px-6 py-3 rounded-full uppercase tracking-widest flex items-center gap-3">
                        <div className="w-2 h-2 bg-white rounded-full" />
                        동기화 대기 중 (OFFLINE)
                    </div>
                )}
            </div>
        </div>
    );
};
