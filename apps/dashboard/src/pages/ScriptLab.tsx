import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
    SortingState
} from '@tanstack/react-table';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api, { Video, Channel, Category } from '../lib/api';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "../components/ui/dialog";
import { ScrollArea } from "../components/ui/scroll-area";
import StatsGraph from '../components/StatsGraph';
import {
    Search, TrendingUp, PlaySquare, FileText, Copy, Languages,
    ChevronUp, ChevronDown, MonitorPlay, Film, Smartphone, Trash2,
    Flame, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

// -- Helper Functions --
const formatCount = (num?: number): string => {
    const n = num ?? 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + '만';
    if (n >= 1000) return (n / 1000).toFixed(1) + '천';
    return n.toString();
};

const formatVelocity = (score: number) => {
    if (!score) return '-';
    if (score > 1000) return `+${(score / 1000).toFixed(1)}K/h`;
    return `+${score.toFixed(0)}/h`;
};

const getViralBadge = (viralScore: number | undefined, velocity: number | undefined) => {
    const score = viralScore || 0;
    const vel = velocity || 0;

    const badges = [];

    // Viral Score Badges - S/A/B/C Grades
    if (score >= 300) {
        badges.push(
            <Badge key="viral" className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white gap-1 text-[11px] h-6 px-2 animate-pulse shadow-sm border-0 ring-1 ring-white/20 whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                <span className="font-bold">S등급</span> {score.toFixed(0)}%
            </Badge>
        );
    } else if (score >= 100) {
        badges.push(
            <Badge key="trending" className="bg-orange-500 hover:bg-orange-600 text-white gap-1 text-[11px] h-6 px-2 shadow-sm border-orange-400 whitespace-nowrap">
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span className="font-bold">A등급</span> {score.toFixed(0)}%
            </Badge>
        );
    } else if (score >= 30) {
        badges.push(
            <Badge key="organic" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[11px] h-6 px-2 border-emerald-400 shadow-sm whitespace-nowrap">
                <span className="text-white font-bold text-xs">🌱</span>
                <span className="font-bold">B등급</span> {score.toFixed(0)}%
            </Badge>
        );
    } else {
        badges.push(
            <Badge key="normal" variant="secondary" className="gap-1 text-[11px] h-6 px-2 bg-muted text-muted-foreground border-border whitespace-nowrap">
                <span className="text-muted-foreground">☁️</span> C등급 {score.toFixed(1)}%
            </Badge>
        );
    }

    // Velocity Badge
    if (vel > 0) {
        const isHighVelocity = vel > 1000;
        badges.push(
            <Badge key="velocity" className={cn(
                "gap-1 text-[11px] h-6 px-2 border transition-all whitespace-nowrap",
                isHighVelocity
                    ? "bg-indigo-600 text-white animate-pulse shadow-sm border-indigo-500"
                    : "bg-blue-50 text-blue-600 border-blue-200"
            )}>
                <TrendingUp className={cn("w-3.5 h-3.5", isHighVelocity && "fill-white")} />
                {vel > 1000 ? (vel / 1000).toFixed(1) + 'K' : vel.toFixed(0)}/hr
            </Badge>
        );
    }

    return <div className="flex flex-col gap-1 items-start">{badges}</div>;
};

// -- Main Component --
const ScriptLab = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [sorting, setSorting] = useState<SortingState>([{ id: 'upload_date', desc: true }]); // [FIX] Default to Latest Date
    const [globalFilter, setGlobalFilter] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null); // For Script Dialog
    const [statsVideo, setStatsVideo] = useState<Video | null>(null); // For Graph Popover

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false); // Emulate drag select
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 1. Fetch Data
    const { data: videos = [], isLoading } = useQuery({
        queryKey: ['videos', 'script', 'strict_mode_v1'], // [FIX] Rotated key to bust stale cache
        queryFn: async () => {
            // [FIX] Must explicitly request 'script' mode, otherwise backend defaults to 'video' and returns 0 scripts.
            const res = await api.get<Video[]>('/videos', {
                params: {
                    mode: 'script',
                    limit: 1000,
                    sort_by: 'upload_date', // [FIX] Ensure backend sends latest first
                    sort_order: 'desc',
                    _t: new Date().getTime() // [FIX] Cache buster
                }
            });
            return res.data.filter((v: Video) => v.is_script_only); // [FINAL SAFEGUARD] Client-side filter
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => api.post('/videos/delete', { video_ids: ids }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos', 'script'] });
            setSelectedIds(new Set());
            // alert('선택한 항목이 삭제되었습니다.'); // Less intrusive UX?
        },
        onError: () => {
            alert('삭제 중 오류가 발생했습니다.');
        }
    });

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = (filteredRows: Video[]) => {
        if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRows.map(v => v.id)));
        }
    };

    const handleDelete = () => {
        if (!selectedIds.size) return;
        if (confirm(`${selectedIds.size}개의 항목을 삭제하시겠습니까?`)) {
            deleteMutation.mutate(Array.from(selectedIds));
        }
    };

    // Fetch Channels Map for lookup
    const { data: channels = [] } = useQuery<Channel[]>({
        queryKey: ['channels'],
        queryFn: async () => { const d = (await api.get<Channel[]>('/channels/')).data; return Array.isArray(d) ? d : []; }
    });

    // Fetch Categories Map
    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => { const d = (await api.get<Category[]>('/categories/')).data; return Array.isArray(d) ? d : []; }
    });

    const channelMap = useMemo(() => {
        const map: Record<number, Channel> = {};
        channels.forEach(c => map[c.id] = c);
        return map;
    }, [channels]);

    const categoryMap = useMemo(() => {
        const map: Record<number, Category> = {};
        categories.forEach(c => map[c.id] = c);
        return map;
    }, [categories]);

    // Fetch History for Stats Graph
    const { data: videoHistory } = useQuery({
        queryKey: ['history', statsVideo?.id],
        queryFn: async () => (await api.get(`/videos/${statsVideo?.id}/history`)).data,
        enabled: !!statsVideo
    });

    // Fetch Script Content for Dialog
    const { data: subtitleContent, isLoading: isScriptLoading } = useQuery({
        queryKey: ['subtitle', selectedVideo?.id],
        queryFn: async () => {
            if (!selectedVideo) return null;
            try {
                const res = await api.get(`/videos/${selectedVideo.id}/subtitles`);
                return res.data;
            } catch (e) {
                // Return phantom if 404
                return { content: "" };
            }
        },
        enabled: !!selectedVideo
    });

    // 2. Table Configuration
    const columnHelper = createColumnHelper<Video>();

    const columns = useMemo(() => [
        // Checkbox Column
        {
            id: 'select',
            header: ({ table }: any) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="mx-1"
                />
            ),
            cell: ({ row }: any) => (
                <div className="px-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                    />
                </div>
            ),
            size: 30,
            enableSorting: false,
        },
        // 1. Grade Column (Badge Only)
        columnHelper.accessor('viral_score', {
            id: 'grade',
            header: '등급',
            cell: info => {
                const score = info.getValue() ?? 0;
                if (score >= 300) {
                    return (
                        <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white w-8 h-8 rounded-full p-0 flex items-center justify-center animate-pulse border-0 shadow-sm ring-1 ring-white/20">
                            <span className="font-bold">S</span>
                        </Badge>
                    );
                }
                if (score >= 100) {
                    return (
                        <Badge className="bg-orange-500 text-white w-8 h-8 rounded-full p-0 flex items-center justify-center shadow-sm border-orange-400">
                            <span className="font-bold">A</span>
                        </Badge>
                    );
                }
                if (score >= 30) {
                    return (
                        <Badge className="bg-emerald-500 text-white w-8 h-8 rounded-full p-0 flex items-center justify-center border-emerald-400 shadow-sm">
                            <span className="font-bold">B</span>
                        </Badge>
                    );
                }
                return (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground border-border w-8 h-8 rounded-full p-0 flex items-center justify-center">
                        C
                    </Badge>
                );
            },
            size: 50,
        }),
        // 2. Title
        // 2. Title
        columnHelper.accessor('title', {
            header: '제목 (내용)',
            cell: info => (
                <div className="flex flex-col w-full max-w-md">
                    <span
                        className="font-medium truncate text-foreground cursor-pointer hover:underline hover:text-primary transition-colors"
                        title={info.getValue()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (info.row.original.url) window.open(info.row.original.url, '_blank');
                        }}
                    >
                        {info.getValue()}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <PlaySquare className="w-3 h-3 text-red-500" />
                        <span className="truncate max-w-sm">{info.row.original.content || "PlaySquare Shorts"}</span>
                    </div>
                </div>
            ),
        }),
        // 3. Category
        columnHelper.accessor('channel_id', {
            id: 'category',
            header: '카테고리',
            cell: info => {
                const chId = info.row.original.channel_id;
                const ch = chId ? channelMap[chId] : null;
                let catName = 'Unknown';
                if (ch?.category_id && categoryMap[ch.category_id]) {
                    catName = categoryMap[ch.category_id].name;
                } else if (ch?.folder_name) {
                    catName = ch.folder_name;
                }
                return (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground truncate max-w-[100px]">
                        {catName}
                    </Badge>
                )
            },
            size: 110,
        }),
        // 4. Channel
        columnHelper.accessor('channel_id', {
            header: '채널 / 구독자',
            cell: info => {
                const chId = info.getValue();
                const ch = chId ? channelMap[chId] : null;
                return (
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground truncate max-w-[90px]" title={ch?.name || '-'}>{ch?.name || '-'}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                            {ch ? formatCount(ch.subscriber_count) : '-'} subs
                        </span>
                    </div>
                );
            },
            size: 110,
        }),
        // 5. Viral Score (Numeric)
        columnHelper.accessor('viral_score', {
            id: 'viral_val',
            header: '바이럴 지수',
            cell: info => {
                const score = info.getValue() ?? 0;
                const isHigh = score > 100;
                return (
                    <div className={cn("font-mono font-bold text-right", isHigh ? "text-red-600" : "text-muted-foreground")}>
                        {score.toFixed(0)}%
                    </div>
                );
            },
            size: 90,
        }),
        // 6. Velocity (Numeric)
        columnHelper.accessor('velocity_score', {
            header: '급상승 지수', // [CHANGED]
            cell: info => {
                const score = info.getValue() ?? 0;
                if (!score) return <span className="text-foreground">-</span>;
                const isHigh = score > 1000;
                return (
                    <div
                        className={cn(
                             "flex items-center justify-end gap-1 font-mono font-bold text-xs cursor-pointer p-1 rounded transition-colors group",
                             // [CHANGED] Brighter hover color
                             "hover:bg-primary/10 hover:text-primary",
                             isHigh ? "text-primary" : "text-muted-foreground"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            setStatsVideo(info.row.original);
                        }}
                    >
                        {isHigh && <TrendingUp className="w-3 h-3 group-hover:scale-110 transition-transform" />}
                        {formatVelocity(score)}
                    </div>
                );
            },
            size: 100,
        }),
        // 7. Views
        columnHelper.accessor('view_count', {
            header: '조회수',
            cell: info => {
                const val = info.row.original.view_count ?? info.row.original.metadata_json?.view_count;
                return <div className="font-mono text-muted-foreground text-right font-medium">{formatCount(val)}</div>
            },
            size: 80,
        }),
        // 8. Upload Date
        columnHelper.accessor('upload_date', {
            header: '업로드',
            cell: info => {
                const date = info.getValue();
                if (!date) return '-';
                const d = new Date(date);
                return <div className="text-xs text-muted-foreground font-mono text-right">
                    {d.getFullYear().toString().slice(2)}.{String(d.getMonth() + 1).padStart(2, '0')}.{String(d.getDate()).padStart(2, '0')}
                </div>;
            },
            size: 70,
        }),
    ], [channelMap, categoryMap]);

    const table = useReactTable({
        data: videos,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection: Object.fromEntries(Array.from(selectedIds).map(id => [id, true])), // Use rowID mapping if row.id was set correctly
        },
        enableRowSelection: true,
        onRowSelectionChange: (updaterOrValue) => {
            // Tanstack Table's selection state keys are row indices by default unless getRowId is set
            // We'll set getRowId to video.id to make life easier
            const newRowSelection = typeof updaterOrValue === 'function'
                ? updaterOrValue(table.getState().rowSelection)
                : updaterOrValue;
            const newSelectedIds = new Set<number>();
            Object.keys(newRowSelection).forEach(id => {
                if (newRowSelection[id]) newSelectedIds.add(Number(id));
            });
            setSelectedIds(newSelectedIds);
        },
        getRowId: row => row.id.toString(), // Important!
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    // Sync TanStack Selection back to our state (or just use ours)
    // Actually, we can just use TanStack's state if we want, but we started with selectedIds.
    // Let's hook up TanStack's `onRowSelectionChange` to update `selectedIds`.



    // [FIX] Improved Drag Logic with Refs
    const isDraggingRef = useRef(false);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const isDragMoved = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only left click
        if (e.button !== 0) return;
        isDraggingRef.current = true;
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        isDragMoved.current = false;

        // If simply clicking, we don't clear selection yet unless logic demands it
        // But if dragging starts, we might want to clear or append. 
        // For now, let's keep it simple: Dragging appends/toggles.
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        dragStartPos.current = null;
        // Don't reset isDragMoved immediately here if we need to check it in onClick
        // But onClick fires *after* mouseup usually.
        // We will reset isDragMoved in a small timeout or efficiently.
        setTimeout(() => {
            isDragMoved.current = false;
        }, 0);
    };

    // We attach global mouse up to stop dragging state
    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handleRowMouseEnter = (row: any) => {
        if (isDraggingRef.current) {
            row.toggleSelected(true);
        }
    };

    const onTableMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !dragStartPos.current) return;
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragMoved.current = true;
            setIsDragging(true); // Trigger re-render if needed for visual cues (optional)
        }
    }

    // Graph Data Calculation
    const chartData = useMemo(() => {
        if (!videoHistory || videoHistory.length === 0 || !statsVideo) return [];
        const sorted = [...videoHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Determine calculation mode: Sparse (< 5 points) vs Dense
        const isSparse = sorted.length < 5;
        const uploadDate = new Date(statsVideo.upload_date).getTime();

        return sorted.map((item, i) => {
            let velocity = 0;
            const itemTime = new Date(item.timestamp).getTime();

            // Lifetime Velocity (Safe calculation)
            const hoursSinceUpload = Math.max(0.1, (itemTime - uploadDate) / (1000 * 60 * 60));
            const lifetimeVelocity = item.view_count / hoursSinceUpload;

            if (i === 0) {
                // First point always uses Lifetime to start clean
                velocity = lifetimeVelocity;
            } else {
                // Calculate Instant Velocity (Slope from previous point)
                const prev = sorted[i - 1];
                const prevTime = new Date(prev.timestamp).getTime();
                const timeDiff = itemTime - prevTime;
                const hours = timeDiff / (1000 * 60 * 60);

                let instantVelocity = 0;
                if (hours > 0) {
                    const viewDiff = item.view_count - prev.view_count;
                    instantVelocity = viewDiff / hours;
                }

                if (instantVelocity > 0) {
                    // IF we have growth, show the KINK (Actual Change)
                    velocity = instantVelocity;
                } else {
                    // IF flat (0 growth), fallback to Lifetime to avoid "Death Drop" to 0
                    // This keeps the graph looking "Alive" based on overall performance
                    velocity = lifetimeVelocity;
                }
            }

            return {
                ...item,
                velocity: Math.max(0, Math.floor(velocity))
            };
        });
    }, [videoHistory, statsVideo]);

    return (
        <div className="h-full flex flex-col bg-background p-6 space-y-4" ref={tableContainerRef}>
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div />
                <div className="flex gap-2 items-center">
                    {/* Select All Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSelectAll(table.getFilteredRowModel().rows.map(r => r.original))}
                        className="text-muted-foreground hover:text-primary"
                    >
                        {selectedIds.size === table.getFilteredRowModel().rows.length && table.getFilteredRowModel().rows.length > 0
                            ? "전체 해제"
                            : "전체 선택"}
                    </Button>

                    {/* Delete Button (Visible if Selected) */}
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            className="gap-2 animate-in fade-in zoom-in duration-200"
                        >
                            <Trash2 className="w-4 h-4" />
                            {selectedIds.size}개 삭제
                        </Button>
                    )}

                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="제목, 채널 검색..."
                            className="pl-9 bg-card shadow-sm"
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col select-none relative">
                <div
                    className="overflow-auto flex-1 w-full"
                    onMouseDown={handleMouseDown}
                    onMouseMove={onTableMouseMove}
                >
                    <Table className="w-full table-fixed">
                        {/* ... Headers ... */}
                        <TableHeader className="sticky top-0 bg-muted z-10 shadow-sm">
                            {table.getHeaderGroups().map(headerGroup => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map(header => {
                                        // Determine alignment based on column ID
                                        let alignClass = 'justify-start';
                                        if (header.column.id === 'viral_score' || header.column.id === 'select') alignClass = 'justify-center'; // Grade & Checkbox
                                        else if (['viral_val', 'velocity_score', 'view_count', 'upload_date'].includes(header.column.id)) alignClass = 'justify-end';

                                        return (
                                            <TableHead key={header.id} className="whitespace-nowrap px-2" style={{ width: header.getSize() }}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : (
                                                        <div
                                                            className={`flex items-center gap-1 cursor-pointer select-none ${alignClass} ${header.column.getCanSort() ? 'hover:text-primary' : ''}`}
                                                            onClick={header.column.getToggleSortingHandler()}
                                                        >
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                            {{
                                                                asc: <ChevronUp className="w-3 h-3" />,
                                                                desc: <ChevronDown className="w-3 h-3" />,
                                                            }[header.column.getIsSorted() as string] ?? null}
                                                        </div>
                                                    )
                                                }
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map(row => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={cn(
                                            "cursor-pointer transition-colors h-14",
                                            row.getIsSelected() ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/80"
                                        )}
                                        onClick={(e) => {
                                            // [FIX] Only open dialog if NOT dragged
                                            if (!isDragMoved.current) {
                                                setSelectedVideo(row.original);
                                            }
                                        }}
                                        onMouseEnter={() => handleRowMouseEnter(row)}
                                    >
                                        {row.getVisibleCells().map(cell => (
                                            <TableCell key={cell.id} className="py-2 px-2 truncate" style={{ width: cell.column.getSize() }}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                        데이터가 없습니다.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-end space-x-2 p-4 border-t bg-muted">
                    <div className="flex-1 text-sm text-muted-foreground">
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        이전
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        다음
                    </Button>
                </div>
            </div>

            {/* Script Reader Dialog (Instead of Sheet) */}
            <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl">
                    {selectedVideo && (
                        <>
                            {/* Header with Title and Actions */}
                            <div className="flex items-center justify-between p-4 border-b">
                                <div className="flex flex-col overflow-hidden mr-4">
                                    <DialogTitle className="text-lg font-bold truncate">
                                        {selectedVideo.title}
                                    </DialogTitle>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="font-normal">
                                            {channelMap[selectedVideo.channel_id]?.name || 'Unknown Channel'}
                                        </Badge>
                                        <span>•</span>
                                        <span>{new Date(selectedVideo.upload_date).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="font-mono text-primary font-medium whitespace-nowrap">
                                            Viral Score: {selectedVideo.viral_score?.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                                        <Copy className="w-3.5 h-3.5" />
                                        복사
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-8"
                                        onClick={() => {
                                            if (subtitleContent?.content) {
                                                navigate('/script-writer', { state: { initialScript: subtitleContent.content } });
                                            }
                                        }}
                                        disabled={!subtitleContent?.content}
                                    >
                                        <Languages className="w-3.5 h-3.5" />
                                        대본번역
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Left: Script Content */}
                                <div className="flex-1 p-6 overflow-hidden flex flex-col bg-card">
                                    <ScrollArea className="flex-1 h-full pr-4">
                                        {isScriptLoading ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                <p className="text-sm">대본을 불러오는 중...</p>
                                            </div>
                                        ) : subtitleContent && subtitleContent.content ? (
                                            <pre className="whitespace-pre-wrap text-base font-sans leading-loose text-foreground font-medium dark:text-zinc-100">
                                                {subtitleContent.content.replace(/>>/g, '').replace(/&gt;&gt;/g, '')}
                                            </pre>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                                <FileText className="w-8 h-8 opacity-20" />
                                                <p>대본 파일이 없습니다.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>

                                {/* Right: Metadata Panel (Optional, kept minimal) */}
                                <div className="w-64 border-l bg-muted p-4 space-y-6 overflow-y-auto">
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Performance</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center bg-card p-2 rounded border shadow-sm">
                                                <span className="text-xs text-muted-foreground">Viral Score</span>
                                                <span className="font-bold text-red-600">{selectedVideo.viral_score?.toFixed(0) ?? 0}%</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-card p-2 rounded border shadow-sm">
                                                <span className="text-xs text-muted-foreground">Velocity</span>
                                                <span className="font-bold text-primary">{formatVelocity(selectedVideo.velocity_score ?? 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-card p-2 rounded border shadow-sm">
                                                <span className="text-xs text-muted-foreground">Views</span>
                                                <span className="font-mono text-foreground">{formatCount(selectedVideo.view_count)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Details</h4>
                                        <div className="text-xs space-y-2 text-foreground">
                                            <div className="flex justify-between">
                                                <span>Duration</span>
                                                <span className="font-mono">{selectedVideo.duration}s</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>File</span>
                                                <span className="truncate max-w-[120px]" title={selectedVideo.file_path}>
                                                    {selectedVideo.file_path ? 'Present' : 'Missing'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Graph Popover (Dialog) matches Gallery.tsx exactly */}
            <Dialog open={!!statsVideo} onOpenChange={(open) => !open && setStatsVideo(null)}>
                <DialogContent className="max-w-2xl bg-card border border-border backdrop-blur-xl text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">바이럴 변화 추이</DialogTitle>
                    </DialogHeader>
                    {statsVideo && videoHistory && videoHistory.length > 0 ? (
                        <div className="h-[350px] mt-4 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey="timestamp"
                                        tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        stroke="var(--muted-foreground)"
                                        fontSize={12}
                                    />
                                    <YAxis yAxisId="left" stroke="var(--primary)" fontSize={12} tickFormatter={(val) => formatCount(val)} />
                                    <YAxis yAxisId="right" orientation="right" stroke="var(--accent)" fontSize={12} tickFormatter={(val) => formatCount(val) + '/h'} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleString()}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="view_count" name="누적 조회수" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="velocity" name="시간당 조회수 (Vel)" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                            <TrendingUp className="w-8 h-8 mr-2 opacity-50" />
                            데이터가 충분하지 않습니다.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default ScriptLab;
