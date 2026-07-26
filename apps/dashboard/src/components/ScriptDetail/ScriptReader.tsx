import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Wand2, Type } from 'lucide-react';
import { toast } from "sonner";

interface ScriptReaderProps {
    content: string;
}

export const ScriptReader: React.FC<ScriptReaderProps> = ({ content }) => {
    const [fontSize, setFontSize] = useState(16);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        toast.success("스크립트가 복사되었습니다.");
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setFontSize(Math.max(12, fontSize - 1))}>
                        <Type className="h-3 w-3 mr-1" /> -
                    </Button>
                    <span className="text-xs text-muted-foreground">{fontSize}px</span>
                    <Button variant="ghost" size="sm" onClick={() => setFontSize(Math.min(24, fontSize + 1))}>
                        <Type className="h-4 w-4 mr-1" /> +
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy} className="h-8">
                        <Copy className="h-3 w-3 mr-2" />
                        전체 복사
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 bg-card">
                <div
                    className="max-w-3xl mx-auto leading-loose whitespace-pre-wrap text-foreground/90 font-medium"
                    style={{ fontSize: `${fontSize}px` }}
                >
                    {content || (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground opacity-50">
                            <Type className="h-12 w-12 mb-4" />
                            <p>스크립트 내용이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
