import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import axios from 'axios'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { pixelingTheme } from './theme/pixeling'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Intercept console.error to log to server (Electron only)
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    try {
      fetch('http://localhost:37643/log-error', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: args.map(a => String(a)).join(' ') })
      }).catch(() => {});
    } catch (e) {}
  }
};

// Configure global Axios defaults for packaged Electron env (file:/// protocol)
if (typeof window !== 'undefined') {
  const isFileProtocol = window.location.protocol === 'file:';
  axios.defaults.baseURL = isFileProtocol ? 'http://127.0.0.1:8000' : '';
  console.log(`[Axios Setup] Global axios.defaults.baseURL forced to: ${axios.defaults.baseURL || 'relative'}`);
}
// Global Robust Polyfill for crypto.randomUUID (highly critical for HTTP and specific legacy Electron webviews)
if (typeof window !== 'undefined') {
  if (typeof (window as any).crypto === 'undefined') {
    (window as any).crypto = {};
  }
  if (!(window.crypto as any).randomUUID) {
    (window.crypto as any).randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    console.log('[Polyfill] crypto.randomUUID successfully registered.');
  }
}

// Global Robust Fallback Mock for window.electronAPI in browser development environments
if (typeof window !== 'undefined' && typeof (window as any).electronAPI === 'undefined') {
  console.log('[Polyfill] window.electronAPI mock registered for non-Electron development environments.');
  (window as any).electronAPI = {
    loadProfiles: async () => {
      try {
        const res = await fetch('/api/browser-profiles/');
        const profiles = await res.json();
        return { activeProfileId: profiles.length > 0 ? profiles[0].id : 'default', profiles };
      } catch (e) {
        return { activeProfileId: 'default', profiles: [] };
      }
    },
    getSavedWorkFolder: async () => ({ success: true, path: 'MockWorkFolder', name: 'MockWorkFolder' }),
    getDefaultWorkFolder: async () => ({ success: true, path: 'MockWorkFolder', name: 'MockWorkFolder' }),
    saveWorkFolder: async () => ({ success: true }),
    checkFolderExists: async () => ({ exists: true }),
    listProjects: async () => ({ projects: [] }),
    projectExists: async () => ({ exists: false }),
    getProjectFolder: async () => ({ path: 'MockProjectFolder' }),
    getResourceFolder: async () => ({ path: 'MockResourceFolder', historyPath: 'MockHistoryFolder' }),
    saveResource: async () => ({ success: true }),
    readResource: async () => ({ success: false, error: 'Mock environment' }),
    getResourcePath: async () => ({ success: true, path: '' }),
    readFileByPath: async () => ({ success: false, error: 'Mock environment' }),
    getHistory: async () => ({ success: true, histories: [] }),
    readHistoryMetadata: async () => ({ success: false }),
    switchProfile: async ({ profileId }: any) => {
      // Just a mock, backend handles context internally
      return { success: true };
    },
    deleteProfile: async ({ profileId }: any) => {
      try {
        await fetch(`/api/browser-profiles/${profileId}`, { method: 'DELETE' });
        return { success: true };
      } catch (e) { return { success: false }; }
    },
    createProfile: async ({ name }: any) => {
      try {
        await fetch(`/api/browser-profiles/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, user_agent: null })
        });
        return { success: true };
      } catch (e) { return { success: false }; }
    },
    extractToken: async () => ({ success: false, error: 'Mock environment' }),
    validateToken: async () => ({ expiry: Date.now() + 3600000 }),
    extractProjectId: async () => ({ success: false }),
    uploadReference: async () => ({ success: false }),
    scanAudioPackage: async () => ({ success: false }),
    rescanAudioPackage: async () => ({ success: false }),
    readFileAbsolute: async () => ({ success: false }),
    writeFileAbsolute: async () => ({ success: false }),
    
    // Listeners
    onFlowStatus: (cb: any) => {
      console.log('[Mock] onFlowStatus listener registered');
      // Call mock immediately in browser to allow onboarding
      setTimeout(() => cb?.({ authenticated: true }), 100);
      return () => {};
    },
    onLayoutChanged: (cb: any) => {
      console.log('[Mock] onLayoutChanged listener registered');
      return () => {};
    },
    
    // Additional Layout/View Mocks
    getActiveViews: async () => ({ views: [] }),
    
    // Controls
    setLayout: async () => {},
    updateSplit: async () => {},
    switchTab: async () => {},
  };
}

const queryClient = new QueryClient()

document.documentElement.classList.remove('dark')
document.documentElement.classList.add('light')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MuiThemeProvider theme={pixelingTheme}>
        <CssBaseline />
        <App />
      </MuiThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
 
