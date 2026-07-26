import { Node, Edge } from 'reactflow';

export const mockGraphData: { nodes: Node[]; edges: Edge[] } = {
    nodes: [
        // 1. Source
        {
            id: 'mock-source-1',
            type: 'sourceNode',
            position: { x: 50, y: 150 },
            data: { label: 'Viral Candidates', keywords: 'AI News, Tech', channel_id: 'TechCrunch' }
        },
        // 2. AI
        {
            id: 'mock-ai-1',
            type: 'aiAgentNode',
            position: { x: 350, y: 150 },
            data: { label: 'Script Writer', prompt: 'Summarize for Gen-Z audience with humor.' }
        },
        // 3. Production
        {
            id: 'mock-prod-1',
            type: 'productionNode',
            position: { x: 650, y: 150 },
            data: { label: 'Video Generator', webhookUrl: 'https://n8n.viraloop.com/webhook/gen-video' }
        },
        // 4. Worker
        {
            id: 'mock-worker-1',
            type: 'workerNode',
            position: { x: 970, y: 150 },
            data: { label: 'Main Worker', email: 'admin@viraloop.com', quota_limit: 50, quota_used: 12 }
        },
        // 5. Channel (YouTube)
        {
            id: 'mock-channel-1',
            type: 'channelNode',
            position: { x: 1300, y: 150 },
            data: { label: 'Tech Daily Shorts', channel_title: 'Tech Daily Shorts', upload_status: 'IDLE', default_privacy: 'public' }
        },
        // 6. Webhook (Propagation)
        {
            id: 'mock-webhook-1',
            type: 'webhookNode',
            position: { x: 1650, y: 250 },
            data: { label: 'Music Auto-Post', url: 'https://api.tiktok.com/v2/post' }
        }
    ],
    edges: [
        { id: 'e1-2', source: 'mock-source-1', target: 'mock-ai-1', type: 'animatedEdge', animated: true },
        { id: 'e2-3', source: 'mock-ai-1', target: 'mock-prod-1', type: 'animatedEdge', animated: true },
        { id: 'e3-4', source: 'mock-prod-1', target: 'mock-worker-1', type: 'animatedEdge', animated: true },
        { id: 'e4-5', source: 'mock-worker-1', target: 'mock-channel-1', type: 'animatedEdge', animated: true },
        { id: 'e5-6', source: 'mock-channel-1', target: 'mock-webhook-1', sourceHandle: 'success-handle', type: 'animatedEdge', animated: true, style: { stroke: '#6366f1' } }
    ]
};
