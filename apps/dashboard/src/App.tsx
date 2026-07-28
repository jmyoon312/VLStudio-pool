import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ChannelManager from './components/ChannelManager'; // Use components/ChannelManager
import Gallery from './components/Gallery';
import Settings from './components/Settings';
import DirectDownload from './components/DirectDownload'; // Use components/DirectDownload
import ScriptWriter from './components/ScriptWriter';
import SubtitleConverter from './components/SubtitleConverter';
import SilenceRemover from './components/SilenceRemover';
import CustomMenu from './pages/CustomMenu';
import MultiTTS from './pages/MultiTTS';
import CreativeStudio from './pages/CreativeStudio';
import RemoverEditor from './pages/RemoverEditor';
import { LiveStudio } from './pages/Studio/LiveStudio';
import VirtualStudio from './pages/VirtualStudio';


import { ReportsPage } from './pages/ReportsPage'; // [NEW]
import StationManager from './pages/StationManager'; // [NEW]
import StationDetail from './pages/StationDetail'; // [NEW]
import RemotionPreviewPage from './pages/RemotionPreviewPage'; // [NEW] Remotion Preview
import AICoPilotStudio from './pages/AICoPilotStudio'; // [NEW] AI Copilot
import Shell from './features/flow2capcut/Shell'; // [NEW] Flow2CapCut Integration (Loads Shell)
import Flow2CapCutApp from './features/flow2capcut/Flow2CapCutApp';
import AgentStudioApp from './features/agent-studio/AgentStudioApp';
import { I18nProvider } from './features/flow2capcut/hooks/useI18n';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from './components/theme-provider';
import ToastProvider from './features/flow2capcut/components/Toast';
import LoginPage from './pages/LoginPage';




import ScriptLab from './pages/ScriptLab';
import OperationsDashboard from './pages/OperationsDashboard';
import WorkQueue from './pages/WorkQueue';  // [NEW] Work Queue
import DdalkkakUI from './pages/DdalkkakUI';
import ResourceGuidePage from './pages/ResourceGuidePage';
import CaptainDashboard from './pages/CaptainDashboard';  // [NEW] Phase 3
import CaptainQuarters from './pages/CaptainQuarters';  // [NEW] Phase 4.1
import Incubator from './pages/Incubator';
import GuideCenter from './pages/GuideCenter';
import Home from './pages/Home';
import EliteCommandStudio from './pages/EliteCommandStudio'; // [Elite] Command Studio

import ResearchBrief from './pages/ResearchBrief';

const PlaceholderPage = ({ title }: { title: string }) => (
    <div className="flex items-center justify-center h-full w-full p-10 mt-20">
        <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">{title}</h1>
            <p className="text-slate-500">?당 기능? ?버 ?전 ?최적???업 중입?다. ??공???정?니??</p>
        </div>
    </div>
);

class RouteErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
    constructor(props: {children: React.ReactNode}) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("=== RouteErrorBoundary ===\nError:", error.message, "\nStack:", error.stack, "\nComponent Stack:", errorInfo.componentStack);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '24px', background: '#fee2e2', color: '#7f1d1d', height: '100%', overflow: 'auto', fontFamily: 'monospace' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>APP CRASHED</h2>
                    <div style={{ background: '#fca5a5', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>{this.state.error?.name}: {this.state.error?.message}</strong>
                    </div>
                    <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fff', padding: '12px', borderRadius: '6px', maxHeight: '300px', overflow: 'auto' }}>
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function GlobalShellWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Shell>
            {children}
        </Shell>
    );
}

function MainAppContent() {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();




    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-50 font-sans">
                <div className="relative flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-600 tracking-wider uppercase animate-pulse">
                    ViraLoop Studio ?션 초기???..
                </p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <GlobalShellWrapper>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/ddalkkak" element={<DdalkkakUI />} />
                    <Route path="/ai-copilot" element={<AICoPilotStudio />} /> {/* [NEW] AI Copilot Studio */}
                    <Route path="/flow2capcut" element={
                        <RouteErrorBoundary>
                            <I18nProvider>
                                <ToastProvider>
                                    <Flow2CapCutApp />
                                </ToastProvider>
                            </I18nProvider>
                        </RouteErrorBoundary>
                    } /> {/* Content when split is active */}
                    <Route path="/agent-studio" element={
                      <div className="flex-1 flex flex-col min-h-0 w-full h-full relative bg-gray-50 dark:bg-zinc-900">
                        <AgentStudioApp />
                      </div>
                    } />
                    <Route path="/download" element={<DirectDownload />} />

                    {/* Fallback Missing Routes */}
                    <Route path="/stealth" element={<Navigate to="/account-manager" replace />} />
                    <Route path="/scissors" element={<Navigate to="/cut-editor" replace />} />

                    <Route path="/channels" element={<ChannelManager />} />

                    {/* [FIX: Distribution Network = Upload Queue, not Workflows] */}
                    <Route path="/distribution-network" element={<OperationsDashboard />} />

                    {/* [NEW] Captain Management */}
                    <Route path="/captain/dashboard" element={<CaptainQuarters />} />
                    <Route path="/captain/:profileId/dashboard" element={<CaptainQuarters />} />
                    <Route path="/captain/:profileId/channels" element={<CaptainQuarters />} />
                    <Route path="/captain/:profileId/settings" element={<CaptainQuarters />} />
                    <Route path="/captain/:profileId" element={<CaptainQuarters />} />
                    <Route path="/captain/channels" element={<CaptainQuarters />} />
                    <Route path="/captain" element={<CaptainQuarters />} />
                    <Route path="/account-manager" element={<Navigate to="/incubator" replace />} />  {/* [MERGED] to incubator */}

                    <Route path="/resource-guide" element={<ResourceGuidePage />} />
                    <Route path="/work-queue" element={<WorkQueue />} /> {/* [NEW] Work Queue */}


                    <Route path="/reports" element={<ReportsPage />} /> {/* [NEW] */}

                    {/* [NEW] Professional Station Manager */}
                    <Route path="/station-manager" element={<StationManager />} />
                    <Route path="/station-manager/:stationId" element={<StationDetail />} />

                    {/* [NEW] Remotion Preview */}
                    <Route path="/remotion-preview" element={<RemotionPreviewPage />} />


                    <Route path="/script-lab" element={<ScriptLab />} />
                    <Route path="/gallery" element={<Gallery />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/script-writer" element={<ScriptWriter />} />


                    <Route path="/subtitle-tool" element={<SubtitleConverter />} />
                    <Route path="/multi-tts" element={<MultiTTS />} />
                    <Route path="/silence-remover" element={<SilenceRemover />} />
                    <Route path="/creative-studio" element={<CreativeStudio />} />
                    <Route path="/remover" element={<RemoverEditor />} />
                    <Route path="/live-studio" element={<LiveStudio />} />
                    <Route path="/virtual-studio" element={<VirtualStudio />} />
                    <Route path="/custom-menu" element={<CustomMenu />} />
                    <Route path="/guide-center" element={<GuideCenter />} />  {/* [NEW] Guide Center */}
                    <Route path="/incubator" element={<Incubator />} />  {/* [NEW] Incubator */}
                    <Route path="/settings" element={<Settings />} />

                    {/* [Elite] Command Studio ??Beats Editor */}
                    <Route path="/elite-studio" element={<EliteCommandStudio />} />
                    <Route path="/elite-studio/:videoId" element={<EliteCommandStudio />} />
                    <Route path="/research-brief" element={<ResearchBrief />} />
                </Routes>
            </Layout>
        </GlobalShellWrapper>
    );
}

function App() {
    return (
        <ThemeProvider defaultTheme="light" storageKey="viraloop-theme">
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <I18nProvider>
                    <AuthProvider>
                        <ToastProvider>
                            <MainAppContent />
                        </ToastProvider>
                    </AuthProvider>
                </I18nProvider>
            </Router>
        </ThemeProvider>
    );
}

export default App;
