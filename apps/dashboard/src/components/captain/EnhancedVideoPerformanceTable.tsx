import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface VideoPerformance {
    video_id: string;
    title: string;
    thumbnail: string;
    upload_date: string;
    views: number;
    likes: number;
    comments: number;
    duration: number;
    engagement_rate: number;
    heatmap?: any[];
}

interface EnhancedVideoPerformanceTableProps {
    videos: VideoPerformance[];
}

type SortField = 'upload_date' | 'views' | 'likes' | 'comments' | 'engagement_rate';
type SortDirection = 'asc' | 'desc';

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

export const EnhancedVideoPerformanceTable: React.FC<EnhancedVideoPerformanceTableProps> = ({ videos }) => {
    const [sortField, setSortField] = useState<SortField>('upload_date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchTerm, setSearchTerm] = useState('');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedAndFilteredVideos = useMemo(() => {
        let filtered = videos;

        // Filter by search term
        if (searchTerm) {
            filtered = videos.filter((v) =>
                v.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        return [...filtered].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === 'upload_date') {
                aVal = new Date(a.upload_date).getTime();
                bVal = new Date(b.upload_date).getTime();
            }

            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }, [videos, sortField, sortDirection, searchTerm]);

    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-4 h-4 text-slate-600" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-blue-600" />
        ) : (
            <ArrowDown className="w-4 h-4 text-blue-600" />
        );
    };

    const getEngagementColor = (rate: number): string => {
        if (rate >= 5) return 'text-green-600 bg-green-50';
        if (rate >= 3) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    if (!videos || videos.length === 0) {
        return (
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold mb-4">영상 성과 분석</h3>
                <p className="text-sm text-gray-500">데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">영상 성과 분석</h3>
                    <input
                        type="text"
                        placeholder="영상 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                영상
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('upload_date')}
                            >
                                <div className="flex items-center gap-1">
                                    업로드 날짜
                                    <SortIcon field="upload_date" />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('views')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    조회수
                                    <SortIcon field="views" />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('likes')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    좋아요
                                    <SortIcon field="likes" />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('comments')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    댓글
                                    <SortIcon field="comments" />
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('engagement_rate')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    참여율
                                    <SortIcon field="engagement_rate" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                길이
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedAndFilteredVideos.map((video) => (
                            <tr key={video.video_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {video.thumbnail && (
                                            <img
                                                src={video.thumbnail}
                                                alt={video.title}
                                                className="w-20 h-12 object-cover rounded"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate" title={video.title}>
                                                {video.title}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    {formatDate(video.upload_date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                    {formatNumber(video.views)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                    {formatNumber(video.likes)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                    {formatNumber(video.comments)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span
                                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getEngagementColor(
                                            video.engagement_rate
                                        )}`}
                                    >
                                        {video.engagement_rate.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 text-center">
                                    {formatDuration(video.duration)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-gray-50">
                <p className="text-xs text-gray-500">
                    총 {sortedAndFilteredVideos.length}개 영상
                    {searchTerm && ` (${videos.length}개 중 검색됨)`}
                </p>
            </div>
        </div>
    );
};

export default EnhancedVideoPerformanceTable;
