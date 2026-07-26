import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { DndContext, useDraggable, useDroppable, pointerWithin, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { Scissors, Trash2, SplitSquareHorizontal, MousePointer2, Magnet, Link2 } from 'lucide-react';

const calculateSnap = (currentX: number, activeId: string, zoom: number, items: any[], playhead: number) => {
    const SNAP_THRESHOLD_PX = 15;
    let minDistance = SNAP_THRESHOLD_PX;
    let snappedX = currentX;

    const playheadPx = playhead * zoom;
    if (Math.abs(currentX - playheadPx) < minDistance) {
        snappedX = playheadPx;
        minDistance = Math.abs(currentX - playheadPx);
    }

    items.forEach(item => {
        if (item.id === activeId) return;
        const startPx = item.startTime * zoom;
        const endPx = (item.startTime + item.duration) * zoom;
        
        if (Math.abs(currentX - startPx) < minDistance) {
            snappedX = startPx;
            minDistance = Math.abs(currentX - startPx);
        }
        if (Math.abs(currentX - endPx) < minDistance) {
            snappedX = endPx;
            minDistance = Math.abs(currentX - endPx);
        }
    });

    return snappedX;
};

export const TimelineCore = () => {
    const { tracks, items, zoom, duration, playhead, setPlayhead, updateItem, setZoom } = useEditorStore();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isMagnetic, setIsMagnetic] = useState(true);

    useEffect(() => {
        const el = timelineRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.01 : -0.01;
                setZoom(zoom + delta);
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [zoom, setZoom]);

    const handleDragStart = (event: DragStartEvent) => {
        setDraggingId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setDraggingId(null);
        const { active, delta, over } = event;
        const item = items[active.id as string];
        if (!item) return;

        const timeDeltaMs = delta.x / zoom;
        let newStartTime = Math.max(0, item.startTime + timeDeltaMs);
        
        let newTrackId = item.trackId;
        if (over && over.id !== item.trackId) {
            newTrackId = over.id as string;
        }

        if (isMagnetic) {
            // Magnetic Snapping
            const snappedX = calculateSnap(newStartTime * zoom, item.id, zoom, Object.values(items), playhead);
            newStartTime = snappedX / zoom;
            
            // Magnetic Ripple (밀어내기)
            const trackItems = Object.values(items).filter(i => i.trackId === newTrackId && i.id !== item.id);
            trackItems.sort((a, b) => a.startTime - b.startTime);
            
            let currentEnd = newStartTime + item.duration;
            trackItems.forEach(other => {
                // If it overlaps, push it to the right
                if (other.startTime < currentEnd && other.startTime + other.duration > newStartTime) {
                    const shift = currentEnd - other.startTime;
                    updateItem(other.id, { startTime: other.startTime + shift });
                    currentEnd = other.startTime + shift + other.duration;
                }
            });
        }

        updateItem(item.id, { startTime: newStartTime, trackId: newTrackId });
    };

    const [isScrubbing, setIsScrubbing] = useState(false);
    
    const handleScrub = (e: React.MouseEvent | MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft - 192; // 192 is the width of track headers
        if (x < 0) return;
        setPlayhead(Math.max(0, x / zoom));
    };

    useEffect(() => {
        if (!isScrubbing) return;
        const handleMouseMove = (e: MouseEvent) => handleScrub(e);
        const handleMouseUp = () => setIsScrubbing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isScrubbing, zoom]);

    const timelineWidthPx = Math.max(duration * zoom, 3000); 

    return (
        <div className="w-full h-full flex flex-col bg-background text-foreground font-sans select-none relative z-20">
            
            {/* Timeline Toolbar */}
            <div className="h-10 border-b border-border flex items-center px-4 justify-between bg-card shadow-sm z-30">
                <div className="flex items-center gap-1.5">
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded transition" title="Select (V)"><MousePointer2 className="w-4 h-4" /></button>
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded transition" title="Split (B)"><Scissors className="w-4 h-4" /></button>
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded transition" title="Delete (Backspace)"><Trash2 className="w-4 h-4" /></button>
                    <div className="w-px h-5 bg-border mx-2"></div>
                    <button onClick={() => setIsMagnetic(!isMagnetic)} className={`w-8 h-8 flex items-center justify-center rounded transition ${isMagnetic ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} title="Magnetic Snap / Ripple (밀어내기)"><Magnet className="w-4 h-4" /></button>
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded transition" title="Link/Unlink"><Link2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-3">
                    <input type="range" min="0.01" max="1" step="0.01" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-32 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative bg-muted/10">
                {/* Track Headers (Fixed Left Column) */}
                <div className="w-48 bg-card border-r border-border flex flex-col shrink-0 z-20 relative shadow-[2px_0_10px_rgba(0,0,0,0.05)] pt-7">
                    {tracks.map(track => (
                        <div key={track.id} className="h-24 border-b border-border flex flex-col justify-center px-4 gap-2 hover:bg-muted/50 transition">
                            <span className="font-semibold text-xs text-foreground truncate">{track.name}</span>
                            <div className="flex gap-2">
                                <button className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${track.isMuted ? 'text-white bg-destructive' : 'text-muted-foreground bg-muted hover:bg-muted-foreground/20'}`}>M</button>
                                <button className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${track.isHidden ? 'text-white bg-blue-500' : 'text-muted-foreground bg-muted hover:bg-muted-foreground/20'}`}>V</button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Timeline Tracks Area (Scrollable) */}
                <div className="flex-1 overflow-auto relative" ref={timelineRef}>
                    <div style={{ width: `${timelineWidthPx}px` }} className="relative h-full min-h-max bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgwdjQwaDBWMHptMjAgMGgwdjQwaDBWMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzgwODA4MDExIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]">
                        
                        {/* Time Ruler Header */}
                        <div 
                            className="h-7 bg-card/90 backdrop-blur border-b border-border sticky top-0 z-20 cursor-text flex items-end"
                            onMouseDown={(e) => {
                                setIsScrubbing(true);
                                handleScrub(e);
                            }}
                        >
                            {/* Tick marks would be drawn here based on zoom */}
                            <div className="w-full h-2 border-l border-border relative"></div>
                        </div>

                        {/* Tracks Container */}
                        <DndContext 
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd} 
                            collisionDetection={pointerWithin}
                            modifiers={[restrictToFirstScrollableAncestor]}
                        >
                            <div className="flex flex-col">
                                {tracks.map(track => (
                                    <TrackRow 
                                        key={track.id} 
                                        track={track} 
                                        items={Object.values(items).filter(i => i.trackId === track.id)} 
                                        zoom={zoom} 
                                    />
                                ))}
                            </div>
                        </DndContext>

                        {/* Playhead Indicator Line */}
                        <div 
                            className="absolute top-0 bottom-0 w-px bg-primary z-30 pointer-events-none"
                            style={{ left: `${playhead * zoom}px` }}
                        >
                            <div className="absolute top-0 -left-[5.5px] w-3 h-4 bg-primary rounded-b-sm shadow-md flex items-center justify-center">
                                <div className="w-0.5 h-2 bg-white/50 rounded-full"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

const TrackRow = ({ track, items, zoom }: { track: any, items: any[], zoom: number }) => {
    const { setNodeRef } = useDroppable({ id: track.id });
    return (
        <div ref={setNodeRef} className="h-24 border-b border-border/50 relative bg-black/5 dark:bg-white/5">
            {items.map(item => <ClipItem key={item.id} item={item} zoom={zoom} />)}
        </div>
    );
};

const ClipItem = ({ item, zoom }: { item: any, zoom: number }) => {
    const { selectedItemIds, setSelection } = useEditorStore();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
    
    const isSelected = selectedItemIds.includes(item.id);
    const leftPx = item.startTime * zoom;
    const widthPx = item.duration * zoom;
    
    // Smooth translation snapping if not dragging, else follow mouse
    const style = {
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : 10,
    };

    const colorClasses = {
        video: 'bg-blue-600/90 border-blue-500',
        audio: 'bg-emerald-600/90 border-emerald-500',
        text: 'bg-amber-600/90 border-amber-500',
        image: 'bg-purple-600/90 border-purple-500',
        effect: 'bg-pink-600/90 border-pink-500',
    }[item.type as string] || 'bg-zinc-600/90 border-zinc-500';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`absolute h-20 top-2 rounded-md border shadow-sm cursor-grab overflow-hidden transition-shadow ${colorClasses} 
                ${isSelected ? 'ring-2 ring-white outline outline-2 outline-primary outline-offset-1 z-20 brightness-110' : ''}
                ${isDragging ? 'opacity-70 scale-[1.01] z-50' : 'opacity-100 hover:brightness-110'}`}
            onClick={(e) => { e.stopPropagation(); setSelection([item.id]); }}
            {...attributes}
            {...listeners}
        >
            <div className="w-full h-full px-2 py-1.5 flex flex-col justify-between relative z-10">
                <span className="text-xs font-bold text-white drop-shadow-md truncate">{item.name || item.type.toUpperCase()}</span>
                <span className="text-[10px] text-white/80 font-mono bg-black/20 self-start px-1 rounded backdrop-blur-sm">{(item.duration / 1000).toFixed(1)}s</span>
            </div>

            {/* Simulated Thumbnails for Video Tracks */}
            {item.type === 'video' && (
                <div className="absolute inset-0 flex opacity-30 mix-blend-overlay overflow-hidden">
                     <div className="w-20 h-full bg-zinc-900 border-r border-black/20 shrink-0"></div>
                     <div className="w-20 h-full bg-zinc-800 border-r border-black/20 shrink-0"></div>
                     <div className="w-20 h-full bg-zinc-900 border-r border-black/20 shrink-0"></div>
                </div>
            )}
        </div>
    );
};
