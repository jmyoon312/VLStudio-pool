import { API_BASE_URL } from '@/lib/api';

export const getBackendHost = (): string => {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return 'http://127.0.0.1:8000';
    }
    if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
        return API_BASE_URL.replace(/\/api$/, '');
    }
    return '';
};

export const resolveFileUrl = (path?: string | null): string => {
    if (!path) return '';

    // Filter out error messages
    if (path.includes('ERR_') || path.includes('Not Found') || path.includes('Error') || path.length > 255) return '';

    // Already a standard URL
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
        return path;
    }

    const BACKEND_HOST = getBackendHost();

    // Already a relative web path, prepend host
    if (path.startsWith('/')) {
        return `${BACKEND_HOST}${path}`;
    }

    // Otherwise, it is a local absolute path (e.g. C:\Users\...)
    const encodedPath = encodeURIComponent(path);
    return `${BACKEND_HOST}/api/files/stream?path=${encodedPath}`;
};

