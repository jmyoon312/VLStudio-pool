// Upload Node Inspector - 컴팩트한 설정 패널

import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, PlaySquare, Camera } from 'lucide-react';
import api from "@/lib/api";


interface UploadNodeInspectorProps {
    node: any;
    onUpdate: (data: any) => void;
}

export const UploadNodeInspector = ({ node, onUpdate }: UploadNodeInspectorProps) => {
    const [channels, setChannels] = useState<any[]>([]);
    const [expandedSections, setExpandedSections] = useState({
        youtube: false,
        tiktok: false,
        instagram: false
    });

    const data = node.data || {};

    // 채널 로드
    useEffect(() => {
        const loadChannels = async () => {
            try {
                // [FIX] Dynamic Captain Fetch
                const profileRes = await api.get('/resources/profiles?type=CAPTAIN&status=ACTIVE');
                if (!profileRes.data || profileRes.data.length === 0) {
                    setChannels([]);
                    return;
                }
                const captainId = profileRes.data[0].id;

                const role = data.upload_method === 'API' ? 'OWNER' : 'MANAGER';
                // Use api service instead of manual fetch
                const response = await api.get(`/youtube/captain/${captainId}/channels?role=${role}`);
                const channelData = response.data; // api.get returns object with data
                setChannels(Array.isArray(channelData) ? channelData : []);
            } catch (error) {
                console.error('Failed to load channels:', error);
                setChannels([]);
            }
        };


        if (data.upload_method) {
            loadChannels();
        }
    }, [data.upload_method]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section as keyof typeof prev]
        }));
    };

    return (
        <div className="space-y-3 text-sm p-3">
            {/* 기본 정보 */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">기본 정보</div>

                <div className="space-y-1.5">
                    <Label className="text-xs">제목 템플릿</Label>
                    <Input
                        value={data.title_template || ''}
                        onChange={(e) => onUpdate({ title_template: e.target.value })}
                        placeholder="{title} - {date}"
                        className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">변수: {'{title}'}, {'{date}'}, {'{channel}'}, {'{id}'}</p>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">설명 템플릿</Label>
                    <Textarea
                        value={data.description_template || ''}
                        onChange={(e) => onUpdate({ description_template: e.target.value })}
                        placeholder="영상 설명..."
                        className="h-14 text-xs resize-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">태그 (쉼표 구분)</Label>
                    <Input
                        value={(data.tags || []).join(', ')}
                        onChange={(e) => onUpdate({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        placeholder="shorts, viral, 추천"
                        className="h-8 text-xs"
                    />
                </div>
            </div>

            {/* 업로드 설정 */}
            <div className="space-y-2 pt-2 border-t">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">업로드 설정</div>

                <div className="space-y-1.5">
                    <Label className="text-xs">업로드 방식</Label>
                    <Select
                        value={data.upload_method || 'API'}
                        onValueChange={(v) => onUpdate({ upload_method: v })}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="API" className="text-xs">Google API 자동화</SelectItem>
                            <SelectItem value="BROWSER" className="text-xs">브라우저 자동화</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">기본 채널</Label>
                    <Select
                        value={data.channel_id || ''}
                        onValueChange={(v) => onUpdate({ channel_id: v })}
                        disabled={channels.length === 0}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={
                                channels.length === 0
                                    ? "채널 없음"
                                    : "채널 선택"
                            } />
                        </SelectTrigger>
                        <SelectContent>
                            {channels.map(ch => (
                                <SelectItem key={ch.channel_id} value={ch.channel_id} className="text-xs">
                                    {ch.channel_name || ch.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                        id="auto-approve"
                        checked={data.auto_approve || false}
                        onCheckedChange={(checked) => onUpdate({ auto_approve: checked })}
                    />
                    <Label htmlFor="auto-approve" className="text-xs font-normal cursor-pointer">
                        자동 승인 및 즉시 업로드
                    </Label>
                </div>
            </div>

            {/* 플랫폼 설정 */}
            <div className="space-y-1.5 pt-2 border-t">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">플랫폼 설정</div>

                {/* YouTube */}
                <div className="border rounded-md overflow-hidden">
                    <button
                        onClick={() => toggleSection('youtube')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <PlaySquare className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-medium">YouTube</span>
                            {data.platforms?.youtube?.enabled && (
                                <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0 h-4">ON</Badge>
                            )}
                        </div>
                        {expandedSections.youtube ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {expandedSections.youtube && (
                        <div className="p-3 pt-2 space-y-3 border-t bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="yt-enabled"
                                    checked={data.platforms?.youtube?.enabled || false}
                                    onCheckedChange={(checked) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            youtube: { ...data.platforms?.youtube, enabled: checked }
                                        }
                                    })}
                                />
                                <Label htmlFor="yt-enabled" className="text-xs font-normal">활성화</Label>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">공개 범위</Label>
                                <Select
                                    value={data.platforms?.youtube?.privacy || 'private'}
                                    onValueChange={(v) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            youtube: { ...data.platforms?.youtube, privacy: v }
                                        }
                                    })}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public" className="text-xs">공개</SelectItem>
                                        <SelectItem value="unlisted" className="text-xs">일부 공개</SelectItem>
                                        <SelectItem value="private" className="text-xs">비공개</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Music */}
                <div className="border rounded-md overflow-hidden">
                    <button
                        onClick={() => toggleSection('tiktok')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-black rounded-sm" />
                            <span className="text-xs font-medium">Music</span>
                            {data.platforms?.tiktok?.enabled && (
                                <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0 h-4">ON</Badge>
                            )}
                        </div>
                        {expandedSections.tiktok ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {expandedSections.tiktok && (
                        <div className="p-3 pt-2 space-y-3 border-t bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="tt-enabled"
                                    checked={data.platforms?.tiktok?.enabled || false}
                                    onCheckedChange={(checked) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            tiktok: { ...data.platforms?.tiktok, enabled: checked }
                                        }
                                    })}
                                />
                                <Label htmlFor="tt-enabled" className="text-xs font-normal">활성화</Label>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">공개 범위</Label>
                                <Select
                                    value={data.platforms?.tiktok?.privacy || 'public'}
                                    onValueChange={(v) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            tiktok: { ...data.platforms?.tiktok, privacy: v }
                                        }
                                    })}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="public" className="text-xs">공개</SelectItem>
                                        <SelectItem value="friends" className="text-xs">친구만</SelectItem>
                                        <SelectItem value="private" className="text-xs">나만 보기</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="tt-comments"
                                        checked={data.platforms?.tiktok?.allow_comments !== false}
                                        onCheckedChange={(checked) => onUpdate({
                                            platforms: {
                                                ...data.platforms,
                                                tiktok: { ...data.platforms?.tiktok, allow_comments: checked }
                                            }
                                        })}
                                    />
                                    <Label htmlFor="tt-comments" className="text-xs font-normal">댓글 허용</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="tt-duet"
                                        checked={data.platforms?.tiktok?.allow_duet !== false}
                                        onCheckedChange={(checked) => onUpdate({
                                            platforms: {
                                                ...data.platforms,
                                                tiktok: { ...data.platforms?.tiktok, allow_duet: checked }
                                            }
                                        })}
                                    />
                                    <Label htmlFor="tt-duet" className="text-xs font-normal">듀엣 허용</Label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Camera */}
                <div className="border rounded-md overflow-hidden">
                    <button
                        onClick={() => toggleSection('instagram')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-pink-600" />
                            <span className="text-xs font-medium">Camera</span>
                            {data.platforms?.instagram?.enabled && (
                                <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0 h-4">ON</Badge>
                            )}
                        </div>
                        {expandedSections.instagram ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {expandedSections.instagram && (
                        <div className="p-3 pt-2 space-y-3 border-t bg-slate-50/50">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ig-enabled"
                                    checked={data.platforms?.instagram?.enabled || false}
                                    onCheckedChange={(checked) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            instagram: { ...data.platforms?.instagram, enabled: checked }
                                        }
                                    })}
                                />
                                <Label htmlFor="ig-enabled" className="text-xs font-normal">활성화</Label>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">캡션</Label>
                                <Textarea
                                    value={data.platforms?.instagram?.caption || ''}
                                    onChange={(e) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            instagram: { ...data.platforms?.instagram, caption: e.target.value }
                                        }
                                    })}
                                    placeholder="Camera 캡션..."
                                    className="h-12 text-xs resize-none"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ig-feed"
                                    checked={data.platforms?.instagram?.share_to_feed || false}
                                    onCheckedChange={(checked) => onUpdate({
                                        platforms: {
                                            ...data.platforms,
                                            instagram: { ...data.platforms?.instagram, share_to_feed: checked }
                                        }
                                    })}
                                />
                                <Label htmlFor="ig-feed" className="text-xs font-normal">피드에도 공유</Label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadNodeInspector;
