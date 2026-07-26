import React, { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from '@tanstack/react-table';
import { Video, Settings } from '../lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, FileText, Play } from 'lucide-react';
import { format } from 'date-fns';
import { getMediaUrl } from '../lib/utils';


interface SubtitleDataGridProps {
    data: Video[];
    onRowClick: (video: Video) => void;
    isLoading: boolean;
    settings?: Settings; // [NEW] Accept settings
}

// Removed getFileUrl in favor of imported getMediaUrl

const columnHelper = createColumnHelper<Video>();

export const SubtitleDataGrid: React.FC<SubtitleDataGridProps> = ({ data, onRowClick, isLoading, settings }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const columns = useMemo(() => [
        columnHelper.accessor('thumbnail_path', {
            header: '',
            cell: info => (
                <div className="w-16 h-9 relative rounded overflow-hidden bg-muted">
                    {info.getValue() ? (
                        <img
                            src={getMediaUrl(info.getValue(), settings?.root_download_path)}
                            alt="thumb"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.png';
                                (e.target as HTMLImageElement).onerror = null; // Prevent loops
                                // Don't hide, show placeholder
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No Img</div>
                    )}
                </div>
            ),
            size: 80,
            enableSorting: false,
        }),
        columnHelper.accessor('title', {
            header: '제목',
            cell: info => (
                <div className="flex flex-col max-w-[300px]">
                    <span className="font-medium truncate" title={info.getValue()}>{info.getValue()}</span>
                    <span className="text-xs text-muted-foreground truncate">{info.row.original.video_id}</span>
                </div>
            ),
        }),
        columnHelper.accessor('downloaded_at', {
            header: '수집일', // [NEW] Show Collection Date
            cell: info => {
                const date = info.getValue() ? new Date(info.getValue()) : null;
                if (!date || isNaN(date.getTime())) return <span className="text-xs text-muted-foreground">-</span>;
                // Format: 25.12.27
                return <span className="text-xs font-medium">{format(date, 'yy.MM.dd')}</span>;
            },
            size: 90,
        }),
        columnHelper.accessor('upload_date', {
            header: '업로드',
            cell: info => {
                const date = info.getValue() ? new Date(info.getValue()) : null;
                if (!date || isNaN(date.getTime())) {
                    return <span className="text-xs text-muted-foreground">-</span>;
                }
                return <span className="text-xs text-muted-foreground">{format(date, 'yy.MM.dd')}</span>;
            },
            size: 90,
        }),
        columnHelper.accessor(row => row.script_analysis?.viral_score, {
            id: 'viral_score',
            header: '바이럴 점수',
            cell: info => {
                const score = info.getValue();
                if (score === undefined || score === null) return <span className="text-xs text-muted-foreground">-</span>;
                let color = "bg-blue-100 text-blue-800";
                if (score >= 80) color = "bg-red-100 text-red-800";
                else if (score >= 50) color = "bg-orange-100 text-orange-800";

                return <Badge variant="secondary" className={`text-[10px] ${color}`}>{score}</Badge>;
            },
            size: 90
        }),
        columnHelper.accessor('is_script_only', {
            header: '유형',
            cell: info => info.getValue() ? <Badge variant="secondary" className="text-[10px]">대본</Badge> : <Badge variant="outline" className="text-[10px]">영상</Badge>,
            size: 80,
        }),
        columnHelper.accessor(row => row.metadata_json?.view_count, {
            id: 'views',
            header: '조회수',
            cell: info => <span className="text-xs text-muted-foreground">{info.getValue()?.toLocaleString() || '-'}</span>,
            size: 100,
        }),
    ], []);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    if (isLoading) {
        return <div className="p-10 text-center text-muted-foreground">Loading specific grid...</div>;
    }

    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <TableHead key={header.id} style={{ width: header.getSize() }}>
                                    {header.isPlaceholder ? null : (
                                        <div
                                            className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-1' : ''}
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: <ChevronUp className="h-3 w-3" />,
                                                desc: <ChevronDown className="h-3 w-3" />,
                                            }[header.column.getIsSorted() as string] ?? (header.column.getCanSort() ? <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" /> : null)}
                                        </div>
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map(row => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && 'selected'}
                                onClick={() => onRowClick(row.original)}
                                className="cursor-pointer hover:bg-muted/50"
                            >
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id} className="py-2">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
