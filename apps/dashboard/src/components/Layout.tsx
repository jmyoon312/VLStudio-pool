import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ListVideo,
    Image,
    Settings,
    Zap,
    Download,
    Moon,
    Sun,
    Languages,
    Scissors,
    LayoutGrid,
    Mic,
    Edit,
    Clapperboard,
    Radio,
    TrendingUp,
    Wand2,
    Eraser,
    Sparkles,
    UploadCloud,
    Share2,
    Activity,
    Globe,
    FileText,
    BarChart3,
    Shield,
    Search,
    Palette,
    Settings2,
    GraduationCap,
    User,
    LogOut,
    CreditCard,
    ChevronUp,
    ChevronDown,
    RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from './theme-provider';
import { Toaster, toast } from 'sonner';
import api from '@/lib/api';
import { getMenuGroups } from '../config/menu';
import GlobalLoopieChat from './GlobalLoopieChat';
import Footer from './Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCachedAvatar } from '../features/flow2capcut/hooks/useCachedAvatar';
import { createPortalSession } from '@/firebase/functions';
import MultiWindowController from './MultiWindowController';


const Layout = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const [captainId, setCaptainId] = React.useState<string | null>(null);
    const [activeViews, setActiveViews] = React.useState<string[]>([]);
    const [activeProfileId, setActiveProfileId] = React.useState<string>('default');

    // Every Proxy / SOCKS5 Proxy Architecture: Legacy Windows Adapter Metric UAC optimization is no longer needed.
    const [netStatus, setNetStatus] = React.useState<any>(null);

    const checkNetworkStatus = async () => {
        try {
            const res = await api.get(`/resources/network/status?t=${Date.now()}`);
            setNetStatus(res.data);
        } catch (e) {
            // Silent catch to prevent console error spam during backend restart
        }
    };

    React.useEffect(() => {
        checkNetworkStatus();
    }, []);

    const syncViewsAndProfiles = async () => {
        try {
            const apiObj = (window as any).electronAPI;
            if (apiObj) {
                const viewsRes = await apiObj.getActiveViews();
                if (viewsRes && Array.isArray(viewsRes.views)) {
                    setActiveViews(viewsRes.views.map((v: any) => v.profileId));
                }
                const config = await apiObj.loadProfiles();
                if (config?.activeProfileId) {
                    setActiveProfileId(config.activeProfileId);
                }
            }
        } catch (e) {
            // Silent catch
        }
    };

    React.useEffect(() => {
        syncViewsAndProfiles();
    }, []);

    const { user, subscription, logout } = useAuth();
    const [accountOpen, setAccountOpen] = React.useState(false);
    const [portalLoading, setPortalLoading] = React.useState(false);

    // Layout states for shifting DOM when Flow views are active
    const [layoutMode, setLayoutMode] = React.useState(() => {
        try { return JSON.parse(localStorage.getItem('layoutSettings') || '{}').mode || 'split-left'; } catch { return 'split-left'; }
    });
    const [splitRatio, setSplitRatio] = React.useState(() => {
        try { return (JSON.parse(localStorage.getItem('layoutSettings') || '{}').ratio || 0.5); } catch { return 0.5; }
    });

    React.useEffect(() => {
        const handleLayoutChange = (e: any, config: any) => {
            if (config?.mode) setLayoutMode(config.mode);
            if (config?.splitRatio) setSplitRatio(config.splitRatio);
        };
        const cleanup = (window as any).electronAPI?.onLayoutChanged?.(handleLayoutChange);
        
        // Polling as a fallback to sync layout state
        const layoutInterval = setInterval(() => {
            try {
                const settings = JSON.parse(localStorage.getItem('layoutSettings') || '{}');
                if (settings.mode && settings.mode !== layoutMode) setLayoutMode(settings.mode);
                if (settings.ratio && settings.ratio !== splitRatio) setSplitRatio(settings.ratio);
            } catch (e) {}
        }, 1000);

        return () => {
            if (cleanup) cleanup();
            clearInterval(layoutInterval);
        };
    }, [layoutMode, splitRatio]);

    const resizeGoogleAvatarUrl = (url: string | null | undefined, size: number) => {
        if (!url || typeof url !== 'string') return url || '';
        return url.replace(/=s\d+(-c)?$/, `=s${size}-c`);
    };

    const normalizedPhotoUrl = user?.photoURL ? resizeGoogleAvatarUrl(user.photoURL, 64) : null;
    const { src: cachedAvatarSrc, failed: avatarFetchFailed, onImageError: handleAvatarError } = useCachedAvatar(normalizedPhotoUrl);

    const handleManageSubscription = async () => {
        try {
            setPortalLoading(true);
            const { url } = await createPortalSession();
            if (url) {
                window.open(url, '_blank');
            }
        } catch (error) {
            console.error('Lemon Squeezy Portal failed:', error);
        } finally {
            setPortalLoading(false);
            setAccountOpen(false);
        }
    };

    const handleLogout = async () => {
        try {
            setAccountOpen(false);
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    React.useEffect(() => {
        api.get("/resources/profiles?type=CAPTAIN&status=ACTIVE")
            .then(res => {
                const data = res.data;
                if (Array.isArray(data) && data.length > 0) {
                    setCaptainId(data[0].id);
                }
            })
            .catch(err => console.error("Failed to load captain profile:", err));
    }, []);

    const menuGroups = React.useMemo(() => getMenuGroups(captainId), [captainId]);
    const [activeMode, setActiveMode] = React.useState('CREATION');

    const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (menuGroups.length > 0) {
            setExpandedGroups(prev => {
                const next = { ...prev };
                menuGroups.forEach(g => {
                    if (next[g.title] === undefined) {
                        next[g.title] = g.defaultExpanded !== false;
                    }
                });
                return next;
            });
        }
    }, [menuGroups]);

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    // === Multi-Tab Session Persistence ===
    interface TabMetadata {
        path: string;
        name: string;
    }

    // Load initial tabs from localStorage or fallback to default
    const [openTabs, setOpenTabs] = React.useState<TabMetadata[]>(() => {
        try {
            const saved = localStorage.getItem('viral_loop_open_tabs');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error("Failed to load saved tabs:", e);
        }
        return [];
    });

    // Keep-Alive VDOM Node Cache (Session Only, not persisted)
    const [tabCache, setTabCache] = React.useState<{ [path: string]: React.ReactNode }>({});

    const getTabNameAndIcon = React.useCallback((path: string) => {
        if (path === '/') return { name: '포털 홈', icon: LayoutDashboard };
        for (const group of menuGroups) {
            const item = group.items.find(it => it.path === path);
            if (item) return { name: item.name, icon: item.icon };
        }
        const cleanName = path.split('/').pop()?.replace(/-/g, ' ') || 'Page';
        return { name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1), icon: FileText };
    }, [menuGroups]);

    // Save tabs to localStorage whenever they change
    React.useEffect(() => {
        try {
            localStorage.setItem('viral_loop_open_tabs', JSON.stringify(openTabs));
        } catch (e) {
            console.error("Failed to save tabs:", e);
        }
    }, [openTabs]);

    // Track path changes and update caches
    React.useEffect(() => {
        const { name } = getTabNameAndIcon(location.pathname);

        // 1. Cache the React children node for this session
        setTabCache(prev => {
            if (prev[location.pathname] === children) return prev;
            return {
                ...prev,
                [location.pathname]: children
            };
        });

        // 2. Add to openTabs metadata if not present
        setOpenTabs(prev => {
            const exists = prev.some(tab => tab.path === location.pathname);
            if (exists) return prev;
            return [...prev, { path: location.pathname, name }];
        });
    }, [location.pathname, getTabNameAndIcon, children]);

    // Close tab and redirect to another remaining tab
    const closeTab = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        e.stopPropagation();

        const needsNavigation = location.pathname === path;
        const remainingTabs = openTabs.filter(tab => tab.path !== path);

        setOpenTabs(remainingTabs);

        // Clean up from VDOM cache
        setTabCache(prev => {
            const copy = { ...prev };
            delete copy[path];
            return copy;
        });

        if (needsNavigation) {
            const target = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].path : '/';
            navigate(target);
        }
    };

    // Reset all tabs except the leftmost one
    const resetTabs = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (openTabs.length <= 1) return;

        const confirm = window.confirm("가장 왼쪽 탭을 제외한 나머지 모든 탭을 닫으시겠습니까?");
        if (!confirm) return;

        const leftmostTab = openTabs[0];

        // 1. Set openTabs to only include the leftmost tab
        setOpenTabs([leftmostTab]);

        // 2. Clean up cache except the leftmost tab
        setTabCache(prev => {
            if (prev[leftmostTab.path]) {
                return { [leftmostTab.path]: prev[leftmostTab.path] };
            }
            return {};
        });

        // 3. Navigate to the leftmost tab
        navigate(leftmostTab.path);
    };

    const filteredGroups = React.useMemo(() => {
        return menuGroups.filter(group => {
            if (activeMode === 'DISCOVERY') return group.title === "📊 트렌드 분석 및 소싱" || group.items.some(it => it.path === '/keyword-explorer') || group.title === "⚙️ AI 코어 & 오토메이션";
            if (activeMode === 'CREATION') return group.title === "🎬 인공지능 창작 스튜디오" || group.title === "📡 가상 라이브 센터" || group.title === "🧪 크리에이티브 실험실 (Beta)";
            if (activeMode === 'OPERATION') return group.title === "⚙️ AI 코어 & 오토메이션" || group.title === "⚙️ 에이전트 및 시스템 관제" || group.title === "📈 채널 성장 및 분석";
            if (activeMode === 'EDUCATION') return group.title === "🛠️ 시스템 환경 및 보안 설정";
            return true;
        });
    }, [menuGroups, activeMode]);

    const modeName = React.useMemo(() => {
        switch (activeMode) {
            case 'DISCOVERY': return '트렌드 분석';
            case 'CREATION': return '콘텐츠 제작';
            case 'OPERATION': return '채널 운영';
            case 'EDUCATION': return '시스템 설정';
            default: return activeMode;
        }
    }, [activeMode]);

    return (
        <div className="relative flex h-screen bg-background text-foreground font-sans antialiased overflow-hidden transition-all duration-300">
            {/* Sidebar */}
            <aside className="absolute inset-y-0 left-0 z-[80] w-[var(--sidebar-width)] border-r border-sidebar-border bg-sidebar flex flex-col shadow-sm">
                <div className="flex h-14 items-center px-6 border-b border-sidebar-border shrink-0 sidebar-logo-container justify-start">
                    <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tighter transition-opacity hover:opacity-80">
                        <div className="w-7 h-7 bg-primary rounded-[8px] flex items-center justify-center shadow-[0_2px_4px_rgba(37,99,235,0.2)] shrink-0">
                            <Zap className="w-4 h-4 text-white fill-white" />
                        </div>
                        <div className="flex items-baseline gap-1.5 hide-on-slim">
                            <span className="text-[19px] font-extrabold text-foreground leading-none">ViraLoop</span>
                            <span className="text-[9px] font-bold text-muted-foreground tracking-tighter uppercase">v3.5</span>
                        </div>
                    </Link>
                </div>

                <div className="px-4 py-5 shrink-0">
                    <div className="bg-muted p-1 rounded-xl border border-border grid grid-cols-2 gap-1 sidebar-mode-grid">
                        {[
                            { id: 'DISCOVERY', name: '트렌드 분석', sub: '분석', icon: Search },
                            { id: 'CREATION', name: '콘텐츠 제작', sub: '제작', icon: Palette },
                            { id: 'OPERATION', name: '채널 운영', sub: '운영', icon: Settings2 },
                            { id: 'EDUCATION', name: '시스템 설정', sub: '설정', icon: GraduationCap },
                        ].map((mode) => {
                            const Icon = mode.icon;
                            const isActive = activeMode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => setActiveMode(mode.id)}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-300 border shrink-0",
                                        isActive
                                            ? "bg-card border-border shadow-sm text-primary"
                                            : "bg-transparent border-transparent text-foreground/80 hover:text-foreground hover:bg-card/40"
                                    )}
                                >
                                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-foreground/60")} strokeWidth={isActive ? 2.5 : 2} />
                                    <div className="flex flex-col items-start leading-tight hide-on-slim">
                                        <span className={cn("text-[10px] font-extrabold tracking-tight", isActive ? "text-primary" : "text-foreground/80")}>
                                            {mode.name}
                                        </span>
                                        <span className="text-[7px] font-bold opacity-40 uppercase tracking-tighter">
                                            {mode.sub}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <nav className="p-4 flex-1 overflow-y-auto dashboard-scroll-area">
                    {/* Always visible Dashboard Home */}
                    <div className="mb-4">
                        <Link
                            to="/"
                            className={cn(
                                "flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13.5px] font-bold tracking-tight transition-all duration-200 group border border-transparent hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm",
                                location.pathname === '/'
                                    ? "bg-card text-primary shadow-sm border border-border font-extrabold"
                                    : "text-foreground/80 hover:text-foreground hover:bg-card/30"
                            )}
                        >
                            <LayoutDashboard className={cn("w-4 h-4 transition-colors shrink-0", location.pathname === '/' ? "text-primary" : "text-foreground/60 group-hover:text-foreground")} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
                            <span className="flex-1 text-left hide-on-slim truncate">대시보드 홈</span>
                        </Link>
                    </div>

                    {filteredGroups.map((group, i) => {
                        const isExpanded = expandedGroups[group.title] !== false;
                        return (
                            <div key={i} className="mb-4 last:mb-0 border-b border-border/5 pb-4 last:border-0 last:pb-0">
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className="flex items-center justify-between w-full px-4 mb-2.5 text-[11px] font-bold text-foreground/60 uppercase tracking-wider hide-on-slim hover:text-foreground transition-colors text-left"
                                >
                                    <span>{group.title}</span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                                    ) : (
                                        <ChevronUp className="w-3 h-3 opacity-60 shrink-0" />
                                    )}
                                </button>
                                {isExpanded && (
                                    <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = item.path.startsWith('/captain')
                                                ? location.pathname.startsWith('/captain') && item.path.includes('channels') === location.pathname.includes('channels')
                                                : location.pathname === item.path;
                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-1.5 rounded-lg text-[13.5px] font-bold tracking-tight transition-all duration-200 group border border-transparent hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm",
                                                        isActive
                                                            ? "bg-card text-primary shadow-sm border border-border font-extrabold"
                                                            : "text-foreground/80 hover:text-foreground hover:bg-card/30"
                                                    )}
                                                >
                                                    <Icon className={cn("w-4 h-4 transition-colors shrink-0", isActive ? "text-primary" : "text-foreground/60 group-hover:text-foreground")} strokeWidth={isActive ? 2.5 : 2} />
                                                    <span className="flex-1 text-left hide-on-slim truncate">{item.name}</span>
                                                    {item.badge !== undefined && item.badge > 0 && (
                                                        <span className="ml-auto bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full hide-on-slim">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-sidebar-border shrink-0">
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="flex items-center justify-between w-full px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all border border-transparent hover:border-border"
                    >
                        <span className="flex items-center gap-2 justify-center w-full lg:justify-start">
                            {theme === "dark" ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
                            <span className="dark-mode-toggle-text">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                        </span>
                    </button>

                    <div className="mt-4 relative">
                        {/* Popover Dropdown */}
                        {accountOpen && (
                            <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-popover border border-border rounded-2xl shadow-xl p-4 z-50 flex flex-col gap-3 animate-fade-in hide-on-slim">
                                <div className="border-b border-border pb-3 flex flex-col gap-0.5">
                                    <p className="text-xs font-bold text-foreground truncate">{user?.displayName || 'User'}</p>
                                    <p className="text-[9px] text-muted-foreground font-semibold truncate leading-none mt-0.5">{user?.email}</p>
                                </div>

                                {/* Sub status */}
                                <div className="bg-muted border border-border rounded-xl px-3 py-2 flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">구독 멤버십</span>
                                        {subscription.status === 'active' ? (
                                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-md uppercase tracking-tight">PRO ACTIVE</span>
                                        ) : subscription.status === 'trial' ? (
                                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md uppercase tracking-tight">FREE TRIAL</span>
                                        ) : (
                                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-md uppercase tracking-tight">EXPIRED</span>
                                        )}
                                    </div>
                                    {subscription.status === 'trial' && (
                                        <div className="flex flex-col gap-1 mt-1">
                                            <div className="w-full bg-muted rounded-full h-1">
                                                <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (subscription.exportsRemaining / 5) * 100))}%` }}></div>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground font-semibold leading-none mt-0.5">
                                                남은 내보내기: {subscription.exportsRemaining}회 / 5회
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex flex-col gap-1 pt-1">
                                    {subscription.status === 'active' && (
                                        <button
                                            onClick={handleManageSubscription}
                                            disabled={portalLoading}
                                            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold text-muted-foreground hover:bg-muted active:scale-[0.98] transition-all border border-transparent hover:border-border"
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
                                            {portalLoading ? '결제 포털 로드 중...' : '구독 멤버십 관리'}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold text-rose-600 hover:bg-rose-50 active:scale-[0.98] transition-all border border-transparent hover:border-rose-100"
                                    >
                                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                                        ViraLoop 로그아웃
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Trigger Card */}
                        <button
                            onClick={() => setAccountOpen(v => !v)}
                            className="flex items-center gap-3 w-full px-4 py-3 bg-card hover:bg-accent border border-border rounded-xl shadow-sm transition-all active:scale-[0.98] group text-left justify-center lg:justify-start"
                        >
                            {cachedAvatarSrc && !avatarFetchFailed ? (
                                <img
                                    src={cachedAvatarSrc}
                                    alt={user?.displayName || 'User'}
                                    className="w-8 h-8 rounded-full border border-pixie-border shrink-0 shadow-sm"
                                    onError={handleAvatarError}
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-primary border border-border shrink-0 shadow-sm">
                                    {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0 hide-on-slim">
                                <p className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                    {user?.displayName || 'ViraLoop User'}
                                </p>
                                <p className="text-[9px] text-muted-foreground truncate leading-none mt-0.5 uppercase tracking-wider font-semibold">
                                    {subscription.status === 'active' ? 'PRO COMMANDER' : 'COMMANDER'}
                                </p>
                            </div>
                            <div className="hide-on-slim">
                                {accountOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground shrink-0" />
                                ) : (
                                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground shrink-0" />
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-hidden relative bg-background flex flex-col transition-all duration-300 pl-[var(--sidebar-width)]">
                <header className="sticky top-0 z-[70] w-full px-8 h-14 flex items-center justify-between bg-card border-b border-border shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">{modeName}</span>
                        <span className="text-border font-light text-xs">|</span>
                        <h1 className="text-[13px] font-bold text-foreground tracking-tight">
                            {(() => {
                                if (location.pathname === '/') return 'Home Portal';
                                for (const group of menuGroups) {
                                    const item = group.items.find(it => it.path === location.pathname);
                                    if (item) return item.name;
                                }
                                return location.pathname.split('/').pop()?.replace(/-/g, ' ');
                            })()}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <MultiWindowController activeViews={activeViews} activeProfileId={activeProfileId} syncViewsAndProfiles={syncViewsAndProfiles} />
                        <GlobalLoopieChat />
                    </div>
                </header>

                {/* Professional Scrollable Tab Bar */}
                <div className="flex items-center gap-1 px-8 pt-2 bg-muted/40 border-b border-border overflow-x-auto dashboard-scroll-area shrink-0 select-none h-11">
                    {/* Reset Tab Button */}
                    {openTabs.length > 1 && (
                        <button
                            onClick={resetTabs}
                            className="p-1 mr-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-600 transition-all flex items-center justify-center shrink-0 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 active:scale-95"
                            title="가장 왼쪽 탭만 남기고 모두 닫기"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {openTabs.map((tab) => {
                        const { icon: TabIcon } = getTabNameAndIcon(tab.path);
                        const isTabActive = location.pathname === tab.path;
                        return (
                            <div
                                key={tab.path}
                                onClick={() => navigate(tab.path)}
                                className={cn(
                                    "relative flex items-center gap-2 px-4 py-1.5 rounded-t-lg text-xs font-bold border border-transparent transition-all duration-150 cursor-pointer group shrink-0 -mb-[1px] select-none",
                                    isTabActive
                                        ? "bg-background border-border border-b-transparent text-primary font-extrabold z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.03)]"
                                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                )}
                            >
                                <TabIcon className={cn("w-3.5 h-3.5", isTabActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                <span className="max-w-[120px] truncate">{tab.name}</span>
                                <button
                                    onClick={(e) => closeTab(e, tab.path)}
                                    className="p-0.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-60 hover:opacity-100"
                                    title="탭 닫기"
                                >
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Direct Page Router View Panel */}
                <div className={cn(
                    "flex-1 flex flex-col custom-scrollbar min-h-0",
                    location.pathname.startsWith('/agent-studio') ? "overflow-hidden" : "overflow-y-auto"
                )}>
                        {openTabs.map((tab) => {
                            const isTabActive = location.pathname === tab.path;
                            const cachedNode = tabCache[tab.path];
                            return (
                                <div
                                    key={tab.path}
                                    className={cn(isTabActive ? "flex-grow flex flex-col min-h-0" : "hidden")}
                                >
                                    {cachedNode ? cachedNode : (
                                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground gap-3 mt-10">
                                            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
                                            <p className="text-xs font-semibold">작업 세션 복원 중...</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {!openTabs.some(tab => tab.path === location.pathname) && children}
                        <Footer className={cn(location.pathname === '/' ? "px-12" : "px-0")} />
                </div>
            </main>

            <Toaster position="top-right" richColors />


        </div>
    );
};

export default Layout;