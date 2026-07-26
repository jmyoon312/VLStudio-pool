import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { fetchWithRetry } from "@/lib/utils";
import {
    Upload, FileSpreadsheet, Hash, CheckCircle2, AlertCircle, ArrowRight,
    Layers, Columns2, Eye, ListChecks, ArrowUpDown, Tag, FileText, Trash2
} from 'lucide-react';

interface ParsedRow {
    external_id: string;
    title: string;
    description: string;
    [key: string]: string;
}

const BulkCreator = () => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [status, setStatus] = useState('');
    const [batchId, setBatchId] = useState('');
    const [sendQueueStatus, setSendQueueStatus] = useState<'idle' | 'sending' | 'done'>('idle');
    const [previewTab, setPreviewTab] = useState('table');

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast({ variant: "destructive", title: "Invalid CSV", description: "Need at least 2 rows (header + data)" }); return; }
        const h = lines[0].split(',').map(c => c.trim());
        const rows = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim());
            const obj: any = {};
            h.forEach((k, i) => obj[k] = vals[i] ?? '');
            return obj;
        });
        setHeaders(h);
        normalizeRows(rows);
    };

    const parseExcel = async (file: File, rawBytes?: Uint8Array) => {
        try {
            const XLSX = await import('xlsx');
            const data = rawBytes ? rawBytes.buffer : await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
            if (json.length < 2) { toast({ variant: "destructive", title: "Invalid Excel", description: "Need at least 2 rows" }); return; }
            const h = json[0].map((c: any) => String(c || '').trim());
            setHeaders(h);
            const rows = json.slice(1).map(row => {
                const obj: any = {};
                h.forEach((k: string, i: number) => obj[k] = row[i] != null ? String(row[i]).trim() : '');
                return obj;
            });
            normalizeRows(rows);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Excel parse error", description: err?.message || 'Failed to read file' });
        }
    };

    const normalizeRows = (rows: any[]) => {
        const tCol = headers.find(h => ['title', '제목', 'name'].includes(h.toLowerCase()));
        const dCol = headers.find(h => ['description', 'desc', '설명'].includes(h.toLowerCase()));
        const eCol = headers.find(h => ['external_id', 'id', '외부id'].includes(h.toLowerCase()));

        const mapped: ParsedRow[] = rows.map((r, i) => ({
            external_id: (eCol ? r[eCol] : `row_${i + 1}`) ?? `row_${i + 1}`,
            title: (tCol ? r[tCol] : undefined) ?? `Item ${i + 1}`,
            description: (dCol ? r[dCol] : undefined) ?? '',
            ...r
        }));
        setParsedRows(mapped);
        toast({ title: `${mapped.length} rows parsed`, description: `Columns: ${headers.join(', ')}` });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            const text = await file.text();
            parseCSV(text);
        } else if (ext === 'xlsx' || ext === 'xls') {
            const arr = new Uint8Array(await file.arrayBuffer());
            await parseExcel(file, arr);
        } else {
            toast({ variant: "destructive", title: "Unsupported", description: "Only .csv and .xlsx files are supported" });
        }
    };

    const handleSendDrafts = async () => {
        if (!parsedRows.length) return;
        setSendQueueStatus('sending');
        try {
            const file = (fileInputRef.current?.files?.[0]) || null;

            if (file && file.name.endsWith('.xlsx')) {
                const data = await file.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
                const res = await fetchWithRetry('/api/work-queue/bulk/upload-file', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64_file: base64, file_name: file.name, source_batch_id: batchId || undefined })
                });
                const result = await res.json();
                if (result.batch_id) setBatchId(result.batch_id);
                toast({ title: `${result.count} drafts created`, description: `Batch: ${result.batch_id?.substring(0, 8)}...` });
                setSendQueueStatus('done');
                setStatus('');
                return;
            }

            const items = parsedRows.map(r => ({
                title: r.title,
                description: r.description,
                source_external_id: r.external_id,
                source_type: 'BULK_IMPORT',
                upload_method: 'BROWSER_AUTO',
                target_platforms: ['youtube'],
                source_metadata: { original_row: r }
            }));
            const res = await fetchWithRetry('/api/work-queue/items/bulk/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, source_batch_id: batchId || undefined })
            });
            const result = await res.json();
            if (result.batch_id) setBatchId(result.batch_id);
            toast({ title: `${result.count} drafts created`, description: `Batch: ${result.batch_id?.substring(0, 8)}...` });
            setSendQueueStatus('done');
            setStatus('');
        } catch (err: any) {
            toast({variant: "destructive", title: "Send failed", description: err?.message || 'Server error' });
            setSendQueueStatus('idle');
        }
    };

    const clearAll = () => { setParsedRows([]); setHeaders([]); setBatchId(''); setStatus(''); setSendQueueStatus('idle'); if (fileInputRef.current) fileInputRef.current.value = ''; };

    return (
        <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Bulk Creator</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Upload CSV/Excel to draft queue items with external IDs</p>
                </div>
                <div className="flex items-center gap-2">
                    {parsedRows.length > 0 && (
                        <>
                            <Button onClick={handleSendDrafts} disabled={sendQueueStatus === 'sending'} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {sendQueueStatus === 'sending' ? 'Sending...' : sendQueueStatus === 'done' ? 'Sent ' : <><ArrowRight className="w-4 h-4 mr-2" />Send to Queue</>}
                            </Button>
                            <Button variant="outline" onClick={clearAll}><Trash2 className="w-4 h-4 mr-2" />Clear</Button>
                        </>
                    )}
                </div>
            </div>

            {/* Upload Card */}
            <Card className="border-2 border-dashed border-border hover:border-indigo-300 transition-colors">
                <CardContent className="p-10 text-center">
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" id="bulk-file-input" />
                    <label htmlFor="bulk-file-input" className="cursor-pointer">
                        <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-1">Drop CSV or Excel file here</h3>
                        <p className="text-sm text-muted-foreground mb-4">Supports .csv and .xlsx files. First row = column headers</p>
                        <Button variant="outline" type="button">
                            <Upload className="w-4 h-4 mr-2" /> Choose File
                        </Button>
                    </label>
                </CardContent>
            </Card>

            {/* Column Mapping Guide */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Tag className="w-4 h-4" /> Column Mapping</h3>
                <p className="text-xs text-muted-foreground">Your spreadsheet should include these columns. Auto-detected headers: <Badge variant="outline">title / 제목 / name</Badge> <Badge variant="outline">description / desc / 설명</Badge> <Badge variant="outline">external_id / id / 외부id</Badge></p>
                {headers.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">Detected:</span>
                        {headers.map(h => (
                            <Badge key={h} variant="secondary" className="text-[11px]">{h}</Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview */}
            {parsedRows.length > 0 && (
                <Card className="border-border">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-base">{parsedRows.length} Rows Parsed</CardTitle>
                                {batchId && <Badge variant="secondary" className="font-mono text-xs">{batchId.substring(0, 12)}...</Badge>}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={previewTab} onValueChange={setPreviewTab}>
                            <TabsList className="mb-3"><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="mapping">Mapping</TabsTrigger></TabsList>
                            <TabsContent value="table" className="mt-0">
                            <div className="max-h-96 overflow-auto rounded border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-10 text-xs">#</TableHead>
                                            <TableHead className="w-32 text-xs">External ID</TableHead>
                                            <TableHead className="text-xs">Title</TableHead>
                                            <TableHead className="text-xs">Description</TableHead>
                                            {headers.filter(h => !['external_id', 'id', '외부id', 'title', '제목', 'name', 'description', 'desc', '설명'].includes(h.toLowerCase())).slice(0, 4).map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedRows.slice(0, 100).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                                <TableCell className="text-xs font-mono text-blue-600 dark:text-blue-400">{row.external_id}</TableCell>
                                                <TableCell className="text-sm font-medium max-w-48 truncate">{row.title}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-64 truncate">{row.description}</TableCell>
                                                {headers.filter(h => !['external_id', 'id', '외부id', 'title', '제목', 'name', 'description', 'desc', '설명'].includes(h.toLowerCase())).slice(0, 4).map(h => <TableCell key={h} className="text-xs text-muted-foreground max-w-32 truncate">{row[h] || '--'}</TableCell>)}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {parsedRows.length > 100 && <p className="text-xs text-muted-foreground mt-2">Showing first 100 of {parsedRows.length} rows</p>}
                        </TabsContent>
                        <TabsContent value="mapping" className="mt-0">
                            <div className="grid grid-cols-3 gap-2">
                                {parsedRows.slice(0, 3).map((row, i) => (
                                    <Card key={i} className="bg-muted/30 border-dashed">
                                        <CardContent className="p-3 text-xs space-y-1">
                                            <p className="font-semibold text-blue-600 dark:text-blue-400">Row #{i + 1}</p>
                                            <p className="flex items-center gap-1"><Hash className="w-3 h-3" /> {row.external_id}</p>
                                            <p className="flex items-center gap-1"><FileText className="w-3 h-3" /> {row.title}</p>
                                            <p className="text-muted-foreground truncate">{row.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default BulkCreator;