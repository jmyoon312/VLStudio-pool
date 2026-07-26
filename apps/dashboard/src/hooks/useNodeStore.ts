import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';

// --- Types ---

type Mode = 'edit' | 'op';

interface NodeData {
    label: string;
    type: 'worker' | 'channel';
    // Worker Specific
    email?: string;
    quota_used?: number;
    quota_limit?: number;
    token_status?: 'valid' | 'invalid' | 'expired';
    // Channel Specific
    channel_title?: string;
    upload_status?: 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
    last_upload_time?: string;
    strike_count?: number; // 0-3
    alerts?: string[]; // e.g., ["Auth Error", "Copyright Strike"]
    // Config
    default_privacy?: string;
    upload_delay?: number;
    tags?: string;
}

interface AppNode extends Node {
    data: NodeData;
}

// --- History ---
interface Snapshot {
    nodes: AppNode[];
    edges: Edge[];
}

interface NodeState {
    nodes: AppNode[];
    edges: Edge[];
    mode: Mode;
    past: Snapshot[];
    future: Snapshot[];

    // Actions
    setMode: (mode: Mode) => void;
    setNodes: (nodes: AppNode[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    addNode: (node: AppNode) => void;
    updateNodeData: (id: string, data: Partial<NodeData>) => void;

    // History Actions
    snapshot: () => void;
    undo: () => void;
    redo: () => void;
}

// --- Store ---

const useNodeStore = create<NodeState>((set, get) => ({
    nodes: [ // ... (Initial Data)
        // ... (Lines 65-107 are same, keeping data)
        {
            id: 'w-1',
            type: 'workerNode',
            position: { x: 100, y: 100 },
            data: { label: 'Worker 1', type: 'worker', email: 'worker1@gmail.com', quota_used: 4500, quota_limit: 10000, token_status: 'valid' }
        },
        {
            id: 'c-1',
            type: 'channelNode',
            position: { x: 400, y: 50 },
            data: { label: 'Channel A', type: 'channel', channel_title: 'Funny Shorts', upload_status: 'UPLOADING', strike_count: 0 }
        },
        {
            id: 'c-2',
            type: 'channelNode',
            position: { x: 400, y: 200 },
            data: { label: 'Channel B', type: 'channel', channel_title: 'Tech Daily', upload_status: 'IDLE', strike_count: 1, alerts: ['Copyright Warning'] }
        }
    ],
    edges: [
        { id: 'e1-1', source: 'w-1', target: 'c-1', animated: true, type: 'animatedEdge' },
        { id: 'e1-2', source: 'w-1', target: 'c-2', animated: false, type: 'animatedEdge' },
    ],
    mode: 'edit',
    past: [],
    future: [],

    setMode: (mode) => set({ mode }),
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes) as AppNode[],
        });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection: Connection) => {
        // Snapshot before connect
        get().snapshot();
        set({
            edges: addEdge({ ...connection, type: 'animatedEdge' }, get().edges),
        });
    },

    addNode: (node) => {
        get().snapshot();
        set((state) => ({ nodes: [...state.nodes, node] }));
    },

    updateNodeData: (id, data) => {
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, ...data } } : node
            ),
        }));
    },

    snapshot: () => {
        set((state) => {
            // Limit history size to 50
            const newPast = [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-50);
            return {
                past: newPast,
                future: []
            };
        });
    },

    undo: () => {
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, state.past.length - 1);
            return {
                past: newPast,
                future: [{ nodes: state.nodes, edges: state.edges }, ...state.future],
                nodes: previous.nodes,
                edges: previous.edges
            };
        });
    },

    redo: () => {
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const newFuture = state.future.slice(1);
            return {
                past: [...state.past, { nodes: state.nodes, edges: state.edges }],
                future: newFuture,
                nodes: next.nodes,
                edges: next.edges
            };
        });
    }
}));

export default useNodeStore;
