export interface BinaryData {
    path: string;
    mime_type: string;
    file_name?: string;
}

export interface DataItem {
    json: Record<string, any>;
    binary?: Record<string, BinaryData>;
}

export interface StandardDataPacket {
    items: DataItem[];
    meta?: Record<string, any>;
}

// Legacy support if needed, but aim for SDP everywhere
export type NodeExecutionResult = StandardDataPacket | Record<string, any>;
