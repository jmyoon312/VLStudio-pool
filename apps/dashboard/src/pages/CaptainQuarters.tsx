import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Settings, Layers, Users, Shield } from 'lucide-react';
import axios from 'axios';
import CaptainDashboard from './CaptainDashboard';
import ChannelManagement from '@/components/captain/ChannelManagement';
import CaptainSettings from '@/components/captain/CaptainSettings';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface CaptainProfile {
    id: string;
    email: string;
}

const CaptainQuarters: React.FC = () => {
    const { profileId } = useParams<{ profileId?: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine default tab from URL
    const getTabFromPath = (path: string) => {
        if (path.includes('/channels')) return "channels";
        if (path.includes('/settings')) return "settings";
        return "dashboard";
    };
    
    const isChannelRoute = location.pathname.includes('/channels');
    const [activeTab, setActiveTab] = useState(getTabFromPath(location.pathname));
    
    const [captains, setCaptains] = useState<CaptainProfile[]>([]);
    const [selectedCaptain, setSelectedCaptain] = useState<string>(profileId || "all");
    const [loading, setLoading] = useState(true);

    // Sync tab with URL changes
    useEffect(() => {
        const newTab = getTabFromPath(location.pathname);
        if (newTab !== activeTab) {
            setActiveTab(newTab);
        }
    }, [location.pathname, activeTab]);

    // Fetch all Captain profiles
    useEffect(() => {
        const fetchCaptains = async () => {
            try {
                const response = await axios.get(`${API_BASE}/resources/profiles?type=CAPTAIN&status=ACTIVE`);
                const captainList = response.data || [];
                setCaptains(captainList);

                // If profileId is provided but doesn't exist in captain list, redirect to first captain
                if (profileId && profileId !== "all") {
                    const captainExists = captainList.some((c: CaptainProfile) => c.id === profileId);
                    if (!captainExists && captainList.length > 0) {
                        console.warn(`Captain ${profileId} not found, redirecting to ${captainList[0].id}`);
                        const targetPath = location.pathname.includes('/channels') ? "channels" : "dashboard";
                        navigate(`/captain/${captainList[0].id}/${targetPath}`, { replace: true });
                        return;
                    }
                }

                // If no profileId and captains exist, redirect to first captain
                if (!profileId && captainList.length > 0) {
                    const targetPath = location.pathname.includes('/channels') ? "channels" : "dashboard";
                    navigate(`/captain/${captainList[0].id}/${targetPath}`, { replace: true });
                    return;
                }
            } catch (error) {
                console.error("Failed to fetch captains:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCaptains();
    }, [profileId, navigate]);

    // Update selected captain when URL changes
    useEffect(() => {
        setSelectedCaptain(profileId || "all");
    }, [profileId]);

    const handleCaptainChange = (value: string) => {
        setSelectedCaptain(value);
        const currentTab = activeTab === "dashboard" ? "dashboard" : activeTab;
        if (value === "all") {
            navigate(`/captain/${currentTab}`);
        } else {
            navigate(`/captain/${value}/${currentTab}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto p-6 space-y-6">
                {/* Header with Tabs and Captain Selector */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Captain Selector */}
                            {!loading && captains.length > 1 && (
                                <Select value={selectedCaptain} onValueChange={handleCaptainChange}>
                                    <SelectTrigger className="w-[280px] bg-background border-border">
                                        <Users className="w-4 h-4 mr-2" />
                                        <SelectValue placeholder="관리자 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            <span className="font-semibold">전체 관리자 ({captains.length})</span>
                                        </SelectItem>
                                        {captains.map((captain) => (
                                            <SelectItem key={captain.id} value={captain.id}>
                                                {captain.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Tabs moved to top-right */}
                        <Tabs value={activeTab} onValueChange={(val) => {
                            setActiveTab(val);
                            const path = selectedCaptain === "all" ? `/captain/${val}` : `/captain/${selectedCaptain}/${val}`;
                            navigate(path);
                        }}>
                            <TabsList className="bg-muted border border-border p-1 h-auto">
                                <TabsTrigger
                                    value="dashboard"
                                    className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 gap-2"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    대시보드
                                </TabsTrigger>
                                <TabsTrigger
                                    value="channels"
                                    className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 gap-2"
                                >
                                    <Layers className="w-4 h-4" />
                                    채널 관리
                                </TabsTrigger>
                                <TabsTrigger
                                    value="settings"
                                    className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 gap-2"
                                    disabled={selectedCaptain === "all"}
                                >
                                    <Settings className="w-4 h-4" />
                                    설정
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Tab Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsContent value="dashboard" className="mt-0">
                        <CaptainDashboard profileId={selectedCaptain === "all" ? undefined : selectedCaptain} />
                    </TabsContent>

                    <TabsContent value="channels" className="mt-0">
                        {/* Always show ChannelManagement but pass profileId if not 'all' */}
                        <ChannelManagement profileId={selectedCaptain === "all" ? "all" : selectedCaptain} />
                    </TabsContent>

                    <TabsContent value="settings" className="mt-0">
                        {selectedCaptain !== "all" && (
                            <CaptainSettings profileId={selectedCaptain} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default CaptainQuarters;
