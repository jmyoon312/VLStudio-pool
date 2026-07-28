import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
    }
    return btoa(chunks.join(''));
}

// Utility: Sentence-based Line Breaking
export const formatTextWithLineBreaks = (text: string): string => {
    if (!text) return "";
    // Matches sentence endings (. ? ! 。 ？ ！) followed by any whitespace (including newlines)
    // Replaces with the punctuation + single newline
    return text.replace(/([.!?。？！])\s*/g, '$1\n');
};


export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    // Use Math.round to match toFixed(1) behavior and avoid 0.1s discrepancies
    const ms = Math.round((seconds % 1) * 10);

    // Handle case where rounding up results in 10 (e.g. 4.96 -> 5.0)
    if (ms === 10) {
        return `${m}:${(s + 1).toString().padStart(2, '0')}.0`;
    }

    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export function formatClipName(name: string, path?: string, source?: string, maxLength: number = 20): string {
    let displayName = name;
    let extension = '';

    // 1. Try to find extension from Name
    let lastDotIndex = displayName.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex > displayName.length - 8) {
        extension = displayName.slice(lastDotIndex);
    }

    // 2. If no extension in name, try Path or Source
    if (!extension) {
        let potentialPath = path || source || '';
        // Clean up source URL if needed
        if (potentialPath.startsWith('http') || potentialPath.startsWith('blob:')) {
            try {
                const url = new URL(potentialPath);
                potentialPath = url.pathname;
            } catch (e) { }
        }

        const pathDotIndex = potentialPath.lastIndexOf('.');
        if (pathDotIndex !== -1 && pathDotIndex > potentialPath.length - 8) {
            extension = potentialPath.slice(pathDotIndex);
        }
    }

    // 3. Resolve Generic Names
    if (!displayName || displayName === '미디어 에셋' || displayName === 'Media Asset') {
        if (path) {
            displayName = path.split(/[/\\]/).pop() || displayName;
        } else if (source) {
            try {
                const url = new URL(source);
                const filename = url.pathname.split('/').pop();
                if (filename) displayName = decodeURIComponent(filename);
            } catch (e) { }
        }
    }

    // 4. Ensure extension is present in display name if we found one and it's missing
    if (extension && !displayName.endsWith(extension)) {
        // If name is just a stem, append extension
        displayName += extension;
    }

    // 5. Truncation Logic
    // If we have an extension, we MUST show it.
    if (extension) {
        // If displayName already has the extension, strip it temporarily for body calculation
        let body = displayName;
        if (body.endsWith(extension)) {
            body = body.slice(0, -extension.length);
        }

        const fullLength = body.length + extension.length;
        if (fullLength <= maxLength) {
            return body + extension;
        }

        const availableBodyLen = maxLength - extension.length - 3; // 3 for "..."
        if (availableBodyLen > 0) {
            return `${body.slice(0, availableBodyLen)}...${extension}`;
        } else {
            // Fallback if max length is super small
            return `...${extension}`;
        }
    }

    if (displayName.length <= maxLength) return displayName;
    return displayName.slice(0, maxLength - 3) + '...';
}

/**
 * Converts a file system path to a web-accessible URL via the backend's static file mount.
 * Handles normalizing paths, removing root prefixes, and encoding.
 */
export function getMediaUrl(path: string | null, rootDownloadPath?: string): string {
    if (!path) return '';
    // Safety check for error strings often found in DB fields during debugging
    if (path.includes('ERR_') || path.includes('Not Found') || path.includes('Error')) return '';

    if (path.startsWith('http') || path.startsWith('blob:')) return path;

    // Special Case: Local Backend Thumbnails
    if (path.replace(/\\/g, '/').startsWith('thumbnails/')) {
        return `/${path.replace(/\\/g, '/')}`;
    }

    // Clean path separators
    let target = path.replace(/\\/g, '/');

    // Check if root download path is configured
    if (rootDownloadPath) {
        const root = rootDownloadPath.replace(/\\/g, '/').replace(/\/$/, '');

        // If path starts with root, remove it to make relative
        if (target.toLowerCase().startsWith(root.toLowerCase())) {
            target = target.substring(root.length).replace(/^\/+/, '');
        }
    }

    // Ensure no absolute windows paths remain (e.g. C:/...)
    if (target.includes(':')) {
        target = target.split(':').pop()?.replace(/^\/+/, '') || target;
    }

    const encodedPath = target.split('/').map(encodeURIComponent).join('/');
    // [FIX] Use /files/ to match backend StaticFiles mount
    return `/files/${encodedPath}`;
}

/**
 * [Resilience] 백엔드 시작 지연(Race Condition) 대응 네이티브 fetch 래퍼
 * ECONNREFUSED / 네트워크 오류 시 지수 백오프(1s→2s→3s)로 최대 3회 자동 재시도.
 * axios 인스턴스를 사용하지 않는 컴포넌트(GlobalLoopieChat, WorkQueue 등)에 사용.
 */
export async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    maxRetries = 3
): Promise<Response> {
    let lastError: unknown;
    let finalInput = input;
    
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        if (typeof finalInput === 'string' && finalInput.startsWith('/')) {
            finalInput = `http://127.0.0.1:8000${finalInput}`;
        } else if (finalInput instanceof URL && finalInput.protocol === 'file:') {
            // Convert relative file:// URL back to localhost API request
            finalInput = `http://127.0.0.1:8000${finalInput.pathname}${finalInput.search}`;
        }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(finalInput, init);
            return response;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delay = 1000 * (attempt + 1); // 1s, 2s, 3s
                await new Promise((res) => setTimeout(res, delay));
            }
        }
    }
    throw lastError;
}

// Modal visibility manager (prevents native Flow view overlay collision)
let activeModalCount = 0;

export function adjustModalCount(change: number) {
    activeModalCount = Math.max(0, activeModalCount + change);
    const shouldHide = activeModalCount > 0;
    window.electronAPI?.setModalVisible?.({ visible: shouldHide });
}

export function resetModalCount() {
    activeModalCount = 0;
    window.electronAPI?.setModalVisible?.({ visible: false });
}

