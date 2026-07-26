import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Button,
    Switch,
    FormControlLabel,
    Card,
    CardContent,
    Grid,
    Chip,
    IconButton,
    Tooltip,
    LinearProgress
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import RefreshIcon from '@mui/icons-material/Refresh';

import { Video } from '@/lib/api';

const TypedBox = Box as any;
const TypedTabs = Tabs as any;
const TypedTab = Tab as any;

const Operations = () => {
    const [tabIndex, setTabIndex] = useState(0);
    const [videos, setVideos] = useState<Video[]>([]);
    const [quotaStats, setQuotaStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch videos based on active tab
    const fetchVideos = async () => {
        setLoading(true);
        try {
            let statusFilter = "PENDING"; // Default for Tab 0
            if (tabIndex === 1) statusFilter = "WAITING_FOR_MOBILE";
            if (tabIndex === 2) statusFilter = "COMPLETED";
            // If tab 0, also fetch FAILED videos
            if (tabIndex === 0) statusFilter = "PENDING,FAILED";


            const res = await fetch(`/videos/?upload_status=${statusFilter}&limit=50`);
            const data = await res.json();
            setVideos(data);
        } catch (e) {
            console.error("Failed to fetch videos", e);
        }
        setLoading(false);
    };

    const fetchQuota = async () => {
        try {
            const res = await fetch(`/dashboard/quota`);
            const data = await res.json();
            setQuotaStats(data);
        } catch (e) {
            console.error("Failed to fetch quota", e);
        }
    };

    useEffect(() => {
        fetchVideos();
        fetchQuota(); // Fetch on mount
        const interval = setInterval(fetchQuota, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, [tabIndex]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    const handleToggleMode = async (video: Video, checked: boolean) => {
        const newMode = checked ? "AUTO_FULL" : "MANUAL_FINISH";
        // Optimistic update
        const updatedVideos = videos.map(v => v.id === video.id ? { ...v, workflow_mode: newMode } : v);
        setVideos(updatedVideos);

        try {
            await fetch(`/videos/${video.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow_mode: newMode })
            });
        } catch (e) {
            console.error("Failed to update mode", e);
            fetchVideos(); // Revert on error
        }
    };

    const handleStartUpload = async (video: Video) => {
        if (!confirm(`Start upload for "${video.title}" in ${video.workflow_mode || "AUTO_FULL"} mode?`)) return;

        // Optimistic: Set status to UPLOADING locally
        setVideos(prev => prev.map(v => v.id === video.id ? { ...v, upload_status: "UPLOADING" } : v));

        try {
            const res = await fetch(`/videos/${video.id}/upload-to-youtube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ privacy_status: "private" }) // Default, backend logic overrides if AUTO
            });
            const result = await res.json();
            if (res.ok) {
                alert(`Upload Started! Status: ${result.final_status}`);
                fetchVideos(); // Refresh to move it to next tab
                fetchQuota(); // Refresh quota immediately
            } else {
                alert(`Error: ${result.detail}`);
                fetchVideos();
            }
        } catch (e) {
            alert("Upload request failed");
            fetchVideos();
        }
    };

    const handleMarkDone = async (video: Video) => {
        if (!confirm("Confirm you noticed/edited this on mobile?")) return;
        try {
            await fetch(`/videos/${video.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ upload_status: "COMPLETED" })
            });
            fetchVideos();
        } catch (e) {
            console.error("Failed to mark done", e);
        }
    };

    // Helper to get Studio Link
    const getStudioLink = (channelId: string | number) => {
        // We'd ideally need the external channel ID, but if we only have DB ID it's tough.
        // Assuming video.channel object is populated by backend (it is usually lazy loaded or eager?)
        // The default 'read_videos' calls 'get_videos' which usually eager loads channel?
        // Let's assume frontend gets basic fields. If we need studio link we need channel external ID.
        // models.Channel has 'url' which is usually @handle or full URL.
        // Let's rely on a generic studio link or check if we have data.
        return `https://studio.youtube.com/`;
    };

    const QuotaWidget = (): any => (
        <Card sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>API Quota Usage (Daily)</Typography>
                <Grid container spacing={2}>
                    {quotaStats.map((s, idx) => {
                        const percent = (s.quota_used / s.quota_limit) * 100;
                        const color = percent > 95 ? 'error' : percent > 80 ? 'warning' : 'success';
                        return (
                            <Grid item xs={12} md={4} lg={3} key={idx}>
                                <TypedBox sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" noWrap>Project: {s.project_id}</Typography>
                                    <TypedBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TypedBox sx={{ flexGrow: 1 }}>
                                            <LinearProgress variant="determinate" value={percent} color={color} sx={{ height: 8, borderRadius: 4 }} />
                                        </TypedBox>
                                        <Typography variant="caption" color={color === 'error' ? 'error' : 'textSecondary'}>
                                            {s.quota_used.toLocaleString()} / {s.quota_limit.toLocaleString()}
                                        </Typography>
                                    </TypedBox>
                                </TypedBox>
                            </Grid>
                        );
                    })}
                    {quotaStats.length === 0 && <Typography variant="body2" sx={{ ml: 2 }}>No active API keys found.</Typography>}
                </Grid>
            </CardContent>
        </Card>
    );

    const renderQueueTab = (): any => (
        <Grid container spacing={2}>
            {videos.map(video => (
                <Grid item xs={12} md={6} lg={4} key={video.id}>
                    <Card variant="outlined" sx={{
                        borderColor: video.upload_status === 'FAILED' ? 'error.main' : 'inherit',
                        bgcolor: video.upload_status === 'FAILED' ? '#fff0f0' : 'inherit'
                    }}>
                        <CardContent>
                            <Typography variant="h6" noWrap>{video.title}</Typography>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                                Channel: {video.channel_id} | Created: {video.created_at ? new Date(video.created_at).toLocaleDateString() : 'N/A'}
                            </Typography>

                            {video.upload_status === 'FAILED' && (
                                <Typography color="error" variant="caption" display="block" sx={{ mb: 1 }}>
                                    Upload Failed. Please Retry.
                                </Typography>
                            )}

                            <TypedBox sx={{ my: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={video.workflow_mode === "AUTO_FULL"}
                                            onChange={(e) => handleToggleMode(video, e.target.checked)}
                                        />
                                    }
                                    label={video.workflow_mode === "AUTO_FULL" ? "Auto Mode (Public)" : "Manual Mode (Private)"}
                                />
                            </TypedBox>

                            <Button
                                variant="contained"
                                color={video.upload_status === 'FAILED' ? "error" : "primary"}
                                fullWidth
                                startIcon={video.upload_status === 'FAILED' ? <RefreshIcon /> : <PlayCircleOutlineIcon />}
                                onClick={() => handleStartUpload(video)}
                                disabled={video.upload_status === "UPLOADING"}
                            >
                                {video.upload_status === "UPLOADING" ? "Uploading..." : video.upload_status === 'FAILED' ? "Retry Upload" : "Start Upload"}
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
            {videos.length === 0 && <Typography sx={{ m: 3 }}>No pending videos.</Typography>}
        </Grid>
    );

    const renderMobileTab = (): any => (
        <Grid container spacing={2}>
            {videos.map(video => (
                <Grid item xs={12} md={6} lg={4} key={video.id}>
                    <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                        <CardContent>
                            <Typography variant="h6" noWrap>{video.title}</Typography>
                            <TypedBox sx={{ display: 'flex', gap: 1, my: 1 }}>
                                <Chip icon={<PhoneIphoneIcon />} label="Waiting for Mobile" color="warning" size="small" />
                                <Chip label="Private" size="small" />
                            </TypedBox>

                            <Typography variant="body2" sx={{ mb: 2 }}>
                                This video was uploaded as private. Please open YouTube Studio App to add tags, check copyright, and publish.
                            </Typography>

                            <TypedBox sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<OpenInNewIcon />}
                                    href="https://studio.youtube.com/"
                                    target="_blank"
                                >
                                    Open Studio
                                </Button>
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => handleMarkDone(video)}
                                    startIcon={<CheckCircleIcon />}
                                >
                                    Mark Done
                                </Button>
                            </TypedBox>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
            {videos.length === 0 && <Typography sx={{ m: 3 }}>No videos waiting for mobile action.</Typography>}
        </Grid>
    );

    const renderHistoryTab = (): any => (
        <TypedBox>
            {videos.map(video => (
                <TypedBox key={video.id} sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <TypedBox>
                        <Typography variant="subtitle1">{video.title}</Typography>
                        <Typography variant="caption" color="textSecondary">
                            Uploaded: {video.updated_at ? new Date(video.updated_at).toLocaleString() : 'N/A'} | Status: {video.privacy_status}
                        </Typography>
                    </TypedBox>
                    <Chip label="Completed" color="success" size="small" />
                </TypedBox>
            ))}
        </TypedBox>
    );

    return (
        <TypedBox sx={{ p: 3 }}>
            {/* Pure Operational Focus */}
            <QuotaWidget />
            <TypedTabs value={tabIndex} onChange={handleTabChange} sx={{ mb: 3 }}>
                <TypedTab label="Upload Queue" />
                <TypedTab label="Mobile Action Required" />
                <TypedTab label="Completed History" />
            </TypedTabs>

            {tabIndex === 0 && renderQueueTab()}
            {tabIndex === 1 && renderMobileTab()}
            {tabIndex === 2 && renderHistoryTab()}
        </TypedBox>
    );
};

export default Operations;
