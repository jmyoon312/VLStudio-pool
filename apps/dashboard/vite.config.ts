import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    base: './',
    cacheDir: './.vite-clean',
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "remotion": path.resolve(__dirname, "../../node_modules/remotion"),
            "@remotion/paths": path.resolve(__dirname, "../../node_modules/@remotion/paths")
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    define: {
        '__APP_VERSION__': JSON.stringify('0.9.10'),
        '__BUILD_NUMBER__': JSON.stringify('538'),
        '__BUILD_TARGET__': JSON.stringify('nsis'),
        '__FUNCTION_SUFFIX__': JSON.stringify('_prod')
    },
    server: {
        host: '0.0.0.0', // Allow External Access
        port: 5183,
        proxy: {
            // 0. Swarm WebSocket (Priority)
            '/api/swarm/ws': {
                target: 'http://127.0.0.1:8000',
                ws: true,
                changeOrigin: true,
                secure: false,
            },
            // 1. API Requests
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
                ws: true,
            },
            '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/temp': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/downloads': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/files': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/thumbnails': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/status_bypass': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/io': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/agent': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/mcp': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/insights': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/workflows': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/templates': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/docs': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },
            '/redoc': { target: 'http://127.0.0.1:8000', changeOrigin: true, secure: false },

            // 7. Swarm Hub (WebSockets)
            '/swarm/': {
                target: 'http://127.0.0.1:4000',
                changeOrigin: true,
                ws: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/swarm\//, '')
            },
            // 8. Socket.io (Standard path for Swarm Hub)
            '/socket.io': {
                target: 'http://127.0.0.1:4000',
                changeOrigin: true,
                ws: true,
                secure: false,
            }
        }
    }
});
