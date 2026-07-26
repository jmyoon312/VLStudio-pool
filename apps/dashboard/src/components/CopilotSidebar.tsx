import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../hooks/useEditorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Sparkles, Loader2, Settings2 } from 'lucide-react';
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import AIModelSelector from './shared/AIModelSelector';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'reasoning';
    content: string;
    status?: 'thinking' | 'done' | 'error';
    task?: string;
}

interface CopilotSidebarProps {
    videoTitle?: string;
    currentStep?: string;
}

const CopilotSidebar: React.FC<CopilotSidebarProps> = ({ videoTitle, currentStep }) => {
    const { addClip, updateClip, tracks } = useEditorStore();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: "지휘관님, ViraLoop의 두뇌 '루피(Loopie)'입니다. 현재 작전 구역을 분석 중입니다." },
        { id: 'reasoning-init', role: 'reasoning', task: 'Source Analysis', content: "분석 중: 원본 메타데이터 및 바이럴 지수 측정...", status: 'done' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // AI Model State
    const [provider, setProvider] = useState("auto");
    const [model, setModel] = useState("auto");
    const [showSettings, setShowSettings] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (videoTitle) {
            const stepText = currentStep || "준비";
            setMessages(prev => [
                ...prev.filter(m => !m.content.includes('[상황 전파]')), // 중복 제거
                { 
                    id: uuidv4(), 
                    role: 'assistant', 
                    content: `[상황 전파] 지휘관님, '${videoTitle}' 작전 파일 로드 완료. (현재 상태: ${stepText})` 
                }
            ]);
        }
    }, [videoTitle, currentStep]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: uuidv4(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Call Backend Agent
            const res = await api.post('/agent/command', {
                command: userMsg.content,
                provider: provider,
                model: model
            });

            const { actions, message } = res.data;

            // Execute Actions
            if (actions && actions.length > 0) {
                actions.forEach((action: any) => {
                    executeAction(action);
                });
            }

            const botMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: message || `Executed ${actions.length} actions.`
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: "죄송합니다, 명령을 처리하는 중 서버와 통신 오류가 발생했습니다." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const executeAction = (action: any) => {
        console.log("Executing Action:", action);

        switch (action.type) {
            case 'add_text':
                // Add text clip with default settings first
                const { id: textClipId, trackId: textTrackId } = addClip(null, null, '', 'text', 0, 5);

                // Update with specific content and style
                updateClip(textTrackId, textClipId, {
                    name: action.params.content || "New Text",
                    style: {
                        fontSize: 40,
                        color: '#ffffff',
                        ...action.params.style
                    }
                });
                break;

            case 'add_music':
                // In a real app, this would search for music and add it.
                // Here we just add a placeholder audio clip.
                addClip(null, null, '/files/demo_music.mp3', 'audio', 0, 10);
                break;

            case 'remove_silence':
                // This is complex, usually requires backend processing of the file.
                // We'll just show a visual indicator or toast.
                alert(`Copilot: Removing silence with threshold ${action.params.threshold}dB... (Simulation)`);
                break;

            case 'cut_clip':
                // Logic to cut clip at start/end
                alert(`Copilot: Cutting video from ${action.params.start}s to ${action.params.end}s... (Simulation)`);
                break;

            default:
                console.warn("Unknown action:", action.type);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0F172A] border-l border-slate-200 w-[280px]">
            <div className="p-4 border-b border-slate-200 bg-[#1E293B] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h3 className="font-bold text-[11px] text-slate-600 tracking-tighter uppercase">Operations Log (Loopie)</h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(!showSettings)}>
                        <Settings2 className="w-4 h-4 text-slate-600" />
                    </Button>
                </div>

                {/* Model Selector Settings */}
                {showSettings && (
                    <div className="mt-2 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2">
                        <AIModelSelector
                            provider={provider}
                            onProviderChange={setProvider}
                            model={model}
                            onModelChange={setModel}
                            compact={true}
                        />
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1 p-4 bg-[#F8FAFC]">
                <div className="space-y-4" ref={scrollRef}>
                    {messages.map(m => (
                        m.role === 'reasoning' ? (
                            <div key={m.id} className="border-l-2 border-indigo-500/30 pl-3 py-1 my-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${m.status === 'thinking' ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-500'}`} />
                                    <span className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-wider">{m.task}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono leading-relaxed">
                                    {m.content}
                                </div>
                            </div>
                        ) : (
                            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${m.role === 'user' ? 'bg-indigo-600' : 'bg-white border border-gray-100'}`}>
                                    {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-600" />}
                                </div>
                                <div className={`p-3 rounded-2xl text-[13px] max-w-[85%] shadow-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-gray-100 rounded-tl-none'}`}>
                                    {m.content}
                                </div>
                            </div>
                        )
                    ))}
                    {isLoading && (
                        <div className="flex gap-2 items-center px-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                            <span className="text-[11px] text-indigo-500 font-bold uppercase tracking-widest">Processing Intelligence...</span>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="루피에게 작전 명령 하달..."
                        className="flex-1 bg-gray-50 border-gray-200 focus:bg-white transition-all"
                    />
                    <Button onClick={handleSend} size="icon" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {["자막 추가해줘", "정적 구간 잘라줘", "분위기에 맞는 배경음악 넣어줘"].map(suggestion => (
                        <button
                            key={suggestion}
                            onClick={() => setInput(suggestion)}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap text-gray-600 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CopilotSidebar;
