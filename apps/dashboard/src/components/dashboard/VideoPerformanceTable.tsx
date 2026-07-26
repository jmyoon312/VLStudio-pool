
import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Eye, ThumbsUp, MessageCircle, BarChart2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface VideoData {
    video_id: string;
    title: string;
    thumbnail_url?: string;
    views: number;
    likes: number;
    comments: number;
    engagement_rate: number;
    published_at?: string;
    duration?: number;
    channel_id: string;
}

interface VideoPerformanceTableProps {
    videos: VideoData[];
    isLoading?: boolean;
}

export const VideoPerformanceTable: React.FC<VideoPerformanceTableProps> = ({
    videos,
    isLoading = false
}) => {

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">데이터 로딩 중...</div>;
    }

    if (!videos || videos.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
                표시할 영상 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-500" />
                    상위 성과 영상 (Top 10)
                </h3>
                <span className="text-xs text-slate-500">조회수 기준</span>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="w-[40%]">영상 정보</TableHead>
                            <TableHead className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Eye className="w-3 h-3" /> 조회수
                                </div>
                            </TableHead>
                            <TableHead className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <ThumbsUp className="w-3 h-3" /> 좋아요
                                </div>
                            </TableHead>
                            <TableHead className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <MessageCircle className="w-3 h-3" /> 댓글
                                </div>
                            </TableHead>
                            <TableHead className="text-right">참여율</TableHead>
                            <TableHead className="text-right w-[120px]">업로드</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {videos.map((video, index) => (
                            <TableRow key={video.video_id} className="hover:bg-slate-50/50">
                                <TableCell className="font-medium text-slate-500">
                                    {index + 1}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                                            {/* Thumbnail fallback logic included via styling if image fails, but mainly assuming valid URL if present */}
                                            {video.thumbnail_url ? (
                                                <img
                                                    src={video.thumbnail_url}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <BarChart2 className="w-6 h-6" />
                                                </div>
                                            )}
                                            {video.duration ? (
                                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                                                    {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <a
                                                href={`https://youtube.com/watch?v=${video.video_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-sm text-slate-700 hover:text-indigo-600 truncate-2-lines line-clamp-2"
                                                title={video.title}
                                            >
                                                {video.title}
                                            </a>
                                            <span className="text-xs text-slate-600 font-mono">
                                                {video.video_id}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium text-slate-700">
                                    {video.views.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-slate-600">
                                    {video.likes.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-slate-600">
                                    {video.comments.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge
                                        variant="outline"
                                        className={`${video.engagement_rate >= 5 ? 'bg-green-50 text-green-700 border-green-200' :
                                                video.engagement_rate >= 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                    >
                                        {video.engagement_rate.toFixed(1)}%
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs text-slate-500 whitespace-nowrap">
                                    {video.published_at ? formatDistanceToNow(new Date(video.published_at), { addSuffix: true, locale: ko }) : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
