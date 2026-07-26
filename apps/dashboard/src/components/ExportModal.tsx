import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Film, Music, Image as ImageIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (config: ExportConfig) => void;
}

export interface ExportConfig {
    video: { enabled: boolean; format: 'mp4' | 'mov'; resolution: '4k' | '1080p' | '720p'; fps: number; quality: 'high' | 'medium' | 'low'; codec: 'h264' | 'hevc'; };
    audio: { enabled: boolean; format: 'mp3' | 'wav' | 'aac'; };
    image: { enabled: boolean; format: 'png' | 'jpg'; };
    subtitle: { enabled: boolean; format: 'srt' | 'txt'; };
}

const ExportModal = ({ isOpen, onClose, onExport }: ExportModalProps) => {
    // Toggles
    const [isVideo, setIsVideo] = useState(true);
    const [isAudio, setIsAudio] = useState(false);
    const [isImage, setIsImage] = useState(false);
    const [isSubtitle, setIsSubtitle] = useState(false);

    // Video Config
    const [vFormat, setVFormat] = useState<'mp4' | 'mov'>('mp4');
    const [vRes, setVRes] = useState<'4k' | '1080p' | '720p'>('1080p');
    const [vFps, setVFps] = useState('30');
    const [vQuality, setVQuality] = useState<'high' | 'medium' | 'low'>('high');
    const [vCodec, setVCodec] = useState<'h264' | 'hevc'>('h264');

    // Audio Config
    const [aFormat, setAFormat] = useState<'mp3' | 'wav' | 'aac'>('mp3');

    // Image Config
    const [iFormat, setIFormat] = useState<'png' | 'jpg'>('png');

    // Subtitle Config
    const [sFormat, setSFormat] = useState<'srt' | 'txt'>('srt');

    const handleExport = () => {
        onExport({
            video: { enabled: isVideo, format: vFormat, resolution: vRes, fps: parseInt(vFps), quality: vQuality, codec: vCodec },
            audio: { enabled: isAudio, format: aFormat },
            image: { enabled: isImage, format: iFormat },
            subtitle: { enabled: isSubtitle, format: sFormat }
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle>Export</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Export your project in various formats.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex gap-6 py-4">
                    {/* Left: Type Selection */}
                    <div className="w-1/3 flex flex-col gap-3 border-r pr-4">
                        <div className={cn("flex items-center space-x-2 p-2 rounded cursor-pointer", isVideo ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50")} onClick={() => setIsVideo(!isVideo)}>
                            <Checkbox checked={isVideo} onCheckedChange={(c) => setIsVideo(!!c)} />
                            <Film className="w-4 h-4 text-blue-500" />
                            <Label className="cursor-pointer">Video Export</Label>
                        </div>
                        <div className={cn("flex items-center space-x-2 p-2 rounded cursor-pointer", isAudio ? "bg-emerald-50 border border-emerald-200" : "hover:bg-slate-50")} onClick={() => setIsAudio(!isAudio)}>
                            <Checkbox checked={isAudio} onCheckedChange={(c) => setIsAudio(!!c)} />
                            <Music className="w-4 h-4 text-emerald-500" />
                            <Label className="cursor-pointer">Audio Export</Label>
                        </div>
                        <div className={cn("flex items-center space-x-2 p-2 rounded cursor-pointer", isImage ? "bg-orange-50 border border-orange-200" : "hover:bg-slate-50")} onClick={() => setIsImage(!isImage)}>
                            <Checkbox checked={isImage} onCheckedChange={(c) => setIsImage(!!c)} />
                            <ImageIcon className="w-4 h-4 text-orange-500" />
                            <Label className="cursor-pointer">Image (Still)</Label>
                        </div>
                        <div className={cn("flex items-center space-x-2 p-2 rounded cursor-pointer", isSubtitle ? "bg-purple-50 border border-purple-200" : "hover:bg-slate-50")} onClick={() => setIsSubtitle(!isSubtitle)}>
                            <Checkbox checked={isSubtitle} onCheckedChange={(c) => setIsSubtitle(!!c)} />
                            <FileText className="w-4 h-4 text-purple-500" />
                            <Label className="cursor-pointer">Subtitle</Label>
                        </div>
                    </div>

                    {/* Right: Detailed Settings */}
                    <div className="flex-1 space-y-6">
                        {isVideo && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                                <h3 className="font-semibold text-sm flex items-center"><Film className="w-3 h-3 mr-2" /> Video Settings</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Format</Label><SelectRoot value={vFormat} onChange={setVFormat} opts={['mp4', 'mov']} /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Resolution</Label><SelectRoot value={vRes} onChange={setVRes} opts={['4k', '1080p', '720p']} /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Frame Rate</Label><SelectRoot value={vFps} onChange={setVFps} opts={['24', '30', '60']} /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Codec</Label><SelectRoot value={vCodec} onChange={setVCodec} opts={['h264', 'hevc']} /></div>
                                </div>
                            </div>
                        )}

                        {isAudio && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                                <h3 className="font-semibold text-sm flex items-center"><Music className="w-3 h-3 mr-2" /> Audio Settings</h3>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">Format</Label><SelectRoot value={aFormat} onChange={setAFormat} opts={['mp3', 'wav', 'aac']} /></div>
                            </div>
                        )}

                        {isImage && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                                <h3 className="font-semibold text-sm flex items-center"><ImageIcon className="w-3 h-3 mr-2" /> Image Settings</h3>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">Format</Label><SelectRoot value={iFormat} onChange={setIFormat} opts={['png', 'jpg']} /></div>
                                <p className="text-[10px] text-slate-600">Exports the current frame.</p>
                            </div>
                        )}

                        {isSubtitle && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                                <h3 className="font-semibold text-sm flex items-center"><FileText className="w-3 h-3 mr-2" /> Subtitle Settings</h3>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">Format</Label><SelectRoot value={sFormat} onChange={setSFormat} opts={['srt', 'txt']} /></div>
                            </div>
                        )}

                        {(!isVideo && !isAudio && !isImage && !isSubtitle) && (
                            <div className="h-full flex items-center justify-center text-slate-600 text-sm italic">
                                Select an export type to see settings
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700" disabled={!isVideo && !isAudio && !isImage && !isSubtitle}>
                        <Download className="w-4 h-4 mr-2" /> Export Selected
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SelectRoot = ({ value, onChange, opts }: { value: any, onChange: (v: any) => void, opts: string[] }) => (
    <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            {opts.map(o => <SelectItem key={o} value={o} className="text-xs uppercase">{o}</SelectItem>)}
        </SelectContent>
    </Select>
)

export default ExportModal;
