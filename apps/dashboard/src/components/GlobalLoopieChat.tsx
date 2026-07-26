import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Volume2, VolumeX, Mic, Loader2 } from 'lucide-react';
import { cn, fetchWithRetry } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

const LoopieIcon = ({ className, isTalking, isSmall }: { className?: string, isTalking?: boolean, isSmall?: boolean }) => (
    <div className={cn("relative flex items-center justify-center shrink-0 overflow-visible", className)}>
        <style>
            {`
                @keyframes loopie-blink {
                    0%, 90%, 100% { transform: scaleY(1); }
                    95% { transform: scaleY(0.1); }
                }
                @keyframes loopie-wobble {
                    0%, 100% { transform: scale(1) rotate(0deg); border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                    50% { transform: scale(1.1) rotate(5deg); border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
                }
                @keyframes loopie-float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes loopie-talk {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(1.8) translateY(1px); }
                }
                .animate-loopie-blink { animation: loopie-blink 4s infinite; }
                .animate-loopie-wobble { animation: loopie-wobble 8s ease-in-out infinite; }
                .animate-loopie-float { animation: loopie-float 4s ease-in-out infinite; }
                .animate-loopie-talk { animation: loopie-talk 0.2s ease-in-out infinite; }
            `}
        </style>
        
        <div className="absolute inset-0 flex items-center justify-center isolate animate-loopie-float">
            <div className={cn(
                "absolute animate-loopie-wobble mix-blend-screen blur-[15px] bg-gradient-to-tr from-blue-400 via-cyan-300 to-indigo-400 transition-all duration-500",
                isSmall ? "inset-[-30%] opacity-30" : "inset-[-60%]",
                !isSmall && isTalking ? "opacity-100 scale-150 blur-[20px]" : "opacity-40"
            )} style={{ animationDuration: '10s' }} />
            
            <div className={cn(
                "absolute inset-0 animate-loopie-wobble bg-blue-600 shadow-inner-[0_0_20px_rgba(255,255,255,0.4)]",
                isSmall ? "shadow-[0_4px_12px_rgba(37,99,235,0.3)]" : "shadow-[0_10px_35px_rgba(37,99,235,0.5)]"
            )} style={{ animationDuration: '6s', animationDelay: '-2s' }} />
            
            <div className="absolute top-[10%] left-[15%] w-[40%] h-[20%] bg-white/40 blur-[3px] rounded-full rotate-[-25deg] pointer-events-none" />
        </div>
        
        <div className={cn(
            "relative z-30 flex flex-col items-center animate-loopie-float",
            isSmall ? "gap-[2px] translate-y-[2px]" : "gap-[5px] translate-y-[8px]"
        )}>
            <div className={cn("flex", isSmall ? "gap-2" : "gap-4")}>
                <div className={cn("relative bg-blue-950 rounded-full animate-loopie-blink", isSmall ? "w-[3px] h-[5px]" : "w-[7.5px] h-[12.5px]")}>
                    <div className="absolute top-[15%] right-[10%] w-[40%] h-[30%] bg-white rounded-full opacity-95" />
                </div>
                <div className={cn("relative bg-blue-950 rounded-full animate-loopie-blink", isSmall ? "w-[3px] h-[5px]" : "w-[7.5px] h-[12.5px]")}>
                    <div className="absolute top-[15%] right-[10%] w-[40%] h-[30%] bg-white rounded-full opacity-95" />
                </div>
            </div>
            <div className={cn("transition-transform", !isSmall && isTalking && "animate-loopie-talk")}>
                <svg width={isSmall ? "10" : "26"} height={isSmall ? "4" : "12"} viewBox={isSmall ? "0 0 10 4" : "0 0 26 12"} fill="none" className="opacity-90">
                    <path 
                        d={isSmall ? "M2 1C2 1 3.5 3 5 3C6.5 3 8 1 8 1" : (isTalking ? "M4 6C4 6 9 10 13 10C17 10 22 6 22 6" : "M4 4C4 4 9 8 13 8C17 8 22 4 22 4")} 
                        stroke="#082f49" 
                        strokeWidth={isSmall ? "1.5" : "3"} 
                        strokeLinecap="round" 
                    />
                </svg>
            </div>
        </div>
    </div>
);

const GlobalLoopieChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system', text: string }[]>([
        { role: 'assistant', text: "반갑습니다, 지휘관님! 바이럴루프 관제 AI 루피가 대기 중입니다. 지시를 내려주십시오." }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isTalking, setIsTalking] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    
    // --- Drag and Drop State ---
    const positionRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const chatWindowRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        positionRef.current = { x: newX, y: newY };
        
        if (chatWindowRef.current) {
            chatWindowRef.current.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px))`;
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        
        isDraggingRef.current = true;
        dragStartPos.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => {
        const handleOpenLoopie = (e: any) => {
            setIsOpen(true);
            if (e.detail && e.detail.message) {
                setMessages(prev => [...prev, { role: 'user', text: e.detail.message }]);
                // Process the message immediately if needed, or just append it
            }
        };
        window.addEventListener('OPEN_LOOPIE', handleOpenLoopie);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('OPEN_LOOPIE', handleOpenLoopie);
        };
    }, [handleMouseMove, handleMouseUp]);
    
    const voiceEnabledRef = useRef(isVoiceEnabled);
    useEffect(() => { voiceEnabledRef.current = isVoiceEnabled; }, [isVoiceEnabled]);

    // Read the configured Hermes model from settings
    const [agentProvider, setAgentProvider] = React.useState('cerebras');
    const [agentModel, setAgentModel] = React.useState('cerebras/llama3.1-8b');
    useEffect(() => {
        // FastAPI router uses @router.get("/") mounted at /api/settings
        // A trailing slash is required, otherwise it may 307 redirect or fail in fetch
        fetchWithRetry('/api/settings')
            .then(async r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                const contentType = r.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    return r.json();
                } else {
                    const text = await r.text();
                    throw new Error(`Expected JSON but got: ${text.substring(0, 20)}...`);
                }
            })
            .then(s => {
                const p = s?.hermes_agent_provider || 'cerebras';
                const m = s?.hermes_agent_model || 'llama3.1-8b';
                setAgentProvider(p);
                setAgentModel(m.startsWith(p + '/') ? m : `${p}/${m}`);
            })
            .catch(err => {
                console.warn('[Loopie] Failed to load Hermes model settings:', err);
                setAgentProvider('cerebras');
                setAgentModel('cerebras/llama3.1-8b');
            }); 
    }, []);

    const location = useLocation();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);



    // [RE-ENHANCED] Advanced Voice Selector - More robust priority
    const getBestVoice = useCallback(() => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return null;
        
        const koVoices = voices.filter(v => v.lang.includes('ko'));
        // Try Natural/Neural first, then Google, then High Quality, then local
        const premiumVoice = koVoices.find(v => 
            v.name.toLowerCase().includes('natural') || 
            v.name.toLowerCase().includes('neural') ||
            v.name.toLowerCase().includes('google')
        );
        
        return premiumVoice || koVoices[0] || voices[0];
    }, []);

    const speak = useCallback((text: string) => {
        if (!voiceEnabledRef.current) return;
        
        // --- Pre-process text to convert English to Korean phonetics for TTS ---
        let ttsText = text
            // Replace common IT/System terminology
            .replace(/ViraLoop/gi, '바이럴루프')
            .replace(/Loopie/gi, '루피')
            .replace(/Hermes/gi, '헤르메스')
            .replace(/DB/gi, '디비')
            .replace(/System/gi, '시스템')
            .replace(/JSON/gi, '제이슨')
            .replace(/API/gi, '에이피아이')
            .replace(/Dashboard/gi, '대시보드')
            .replace(/UI/gi, '유아이')
            .replace(/LLM/gi, '엘엘엠')
            .replace(/AI/gi, '에이아이')
            .replace(/Done/gi, '완료')
            .replace(/Error/gi, '에러')
            // Remove formatting artifacts that TTS might try to read
            .replace(/[*_~`#]/g, '');

        // Stop current speech cleanly with a tiny delay to avoid audio glitch
        window.speechSynthesis.cancel();

        // Split into natural sentence chunks to avoid TTS stuttering on long texts
        const sentences = ttsText.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [ttsText];
        
        let utteranceIndex = 0;
        const speakNext = () => {
            if (utteranceIndex >= sentences.length) {
                setIsTalking(false);
                return;
            }
            const chunk = sentences[utteranceIndex].trim();
            if (!chunk) { utteranceIndex++; speakNext(); return; }
            
            const utterance = new SpeechSynthesisUtterance(chunk);
            const voices = window.speechSynthesis.getVoices();
            const koVoices = voices.filter(v => v.lang.startsWith('ko'));
            // Prefer Google Korean which tends to sound most natural
            const best = koVoices.find(v => v.name.includes('Google')) 
                || koVoices.find(v => v.name.toLowerCase().includes('natural'))
                || koVoices[0] 
                || voices[0];

            if (best) {
                utterance.voice = best;
                utterance.lang = best.lang;
            } else {
                utterance.lang = 'ko-KR';
            }

            // Slightly elevated pitch for a cheerful, playful feel
            utterance.pitch = 1.15;
            utterance.rate = 0.95;
            utterance.volume = 1.0;

            if (utteranceIndex === 0) utterance.onstart = () => setIsTalking(true);
            utterance.onend = () => { utteranceIndex++; speakNext(); };
            utterance.onerror = () => { setIsTalking(false); };

            window.speechSynthesis.speak(utterance);
        };

        // Small delay after cancel() to let audio engine reset cleanly
        setTimeout(speakNext, 50);
    }, []);

    // --- WebSocket for Swarm Background Tasks ---
    useEffect(() => {
        let ws: WebSocket | null = null;
        let retryTimeout: ReturnType<typeof setTimeout>;
        let isMounted = true;
        let lastMessage = ''; // Prevent duplicate voice/text spam

        const connectWebSocket = () => {
            if (!isMounted) return;
            const isFileProtocol = window.location.protocol === 'file:';
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = isFileProtocol ? '127.0.0.1:8000' : window.location.host;
            ws = new WebSocket(`${wsProtocol}//${wsHost}/api/swarm/ws`);
            
            ws.onopen = () => {
                console.log("[Loopie] Swarm WebSocket connected");
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    // Expected payload: { type: 'task_progress' | 'task_complete', message: string, action?: any }
                    if (payload.message && payload.message !== lastMessage) {
                        lastMessage = payload.message;
                        setMessages((prev: any[]) => {
                            // Avoid appending the exact same message twice
                            if (prev.length > 0 && prev[prev.length - 1].text === payload.message) {
                                return prev;
                            }
                            return [...prev, { role: 'assistant', text: payload.message }];
                        });
                        speak(payload.message);
                    }
                    if (payload.type === 'task_complete' && payload.action && payload.action.type === 'navigate') {
                        navigate(payload.action.params.path);
                    }
                } catch (err) {
                    console.error("[Loopie] Swarm WS Parse Error:", err);
                }
            };

            ws.onclose = () => {
                if (isMounted) {
                    console.log("[Loopie] Swarm WebSocket disconnected, retrying in 5s...");
                    retryTimeout = setTimeout(connectWebSocket, 5000);
                }
            };
            
            ws.onerror = (err) => {
                console.error("[Loopie] Swarm WebSocket error", err);
                if (ws) ws.close();
            };
        };

        connectWebSocket();

        return () => {
            isMounted = false;
            clearTimeout(retryTimeout);
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    ws.onopen = () => { ws.close(); };
                }
            }
        };
    }, [navigate, speak]);

    // Ensure voices are always ready
    useEffect(() => {
        const handleVoicesChanged = () => {
            console.log("Voices updated:", window.speechSynthesis.getVoices().length);
        };
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    const toggleVoice = () => {
        const nextState = !isVoiceEnabled;
        setIsVoiceEnabled(nextState);
        if (nextState) {
            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = () => {
                    speak("지휘관님, 이제 루피의 목소리를 들으실 수 있습니다. 명령만 내려주세요!");
                };
            } else {
                setTimeout(() => speak("지휘관님, 이제 루피의 목소리를 들으실 수 있습니다. 명령만 내려주세요!"), 200);
            }
        }
    };

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => { setInput(event.results[0][0].transcript); };
        recognition.start();
    };

    // [SOVEREIGN FIX] Use HTTP health-check instead of broken socket.io connection
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetchWithRetry('/api/hermes/status');
                setIsConnected(res.ok);
            } catch {
                setIsConnected(false);
            }
        };
        checkConnection();
        const interval = setInterval(checkConnection, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isThinking) return;
        const msg = input.trim();
        setMessages((prev: any[]) => [...prev, { role: 'user', text: msg }]);
        setInput('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        setIsThinking(true);
        try {
            const res = await fetchWithRetry('/api/agent/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: msg,
                    context: { currentPath: location.pathname },
                    provider: agentProvider,
                    model: agentModel
                })
            });
            // Guard against non-JSON responses (e.g. 502, empty body)
            const text = await res.text();
            let replyText = '명령을 처리했습니다.';
            if (text) {
                try {
                    const data = JSON.parse(text);
                    replyText = data.message || replyText;
                    
                    // --- Action Executor ---
                    if (data.actions && Array.isArray(data.actions)) {
                        for (const action of data.actions) {
                            if (action.type === 'navigate') {
                                navigate(action.params.path);
                            } else if (action.type === 'delegate_to_openclaw') {
                                // Send background task dispatch to backend
                                fetchWithRetry('/api/swarm/dispatch', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(action.params)
                                }).catch(err => console.error("[Loopie] Dispatch failed:", err));
                            }
                        }
                    }
                } catch {
                    replyText = text.slice(0, 300);
                }
            }
            setMessages((prev: any[]) => [...prev, { role: 'assistant', text: replyText }]);
            speak(replyText);
        } catch (err) {
            setMessages((prev: any[]) => [...prev, { role: 'assistant', text: 'API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    const chatWindowContent = useMemo(() => {
        if (!isOpen) return null;
        return (
            <div
                ref={chatWindowRef}
                style={{ 
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: `translate(calc(-50% + ${positionRef.current.x}px), calc(-50% + ${positionRef.current.y}px))`,
                    width: '400px',
                    height: '600px',
                    overflow: 'visible',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column'
                }}
                className="bg-white/95 backdrop-blur-3xl rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.3)] border border-white/50"
            >
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-20">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-400/30 blur-3xl rounded-full scale-150 animate-pulse" />
                        <LoopieIcon className="w-24 h-24" isTalking={isTalking} />
                    </div>
                </div>

                <div 
                    className="drag-handle pt-16 pb-4 px-6 flex flex-col items-center cursor-move relative z-10"
                    onMouseDown={handleMouseDown}
                >
                    <h3 className="text-slate-900 text-[20px] font-black tracking-tight mb-1">AI 루피</h3>
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-400")} />
                        <span className="text-[12px] text-slate-500 font-extrabold uppercase tracking-widest">
                            {isConnected ? '연결됨' : '연결 중...'}
                        </span>
                    </div>
                    
                    <div className="absolute right-6 top-8 flex items-center gap-2">
                        <button onClick={toggleVoice} className={cn("p-2.5 rounded-[18px] transition-all", isVoiceEnabled ? "bg-blue-600 text-white shadow-xl scale-110" : "text-slate-700 hover:text-slate-600 hover:bg-slate-100")}>
                            {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="p-2.5 text-slate-700 hover:text-slate-600 hover:bg-slate-100 rounded-[18px] transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex flex-col max-w-[90%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                            <div className={cn(
                                "px-5 py-4 rounded-[28px] text-[15px] leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all animate-in zoom-in-95 duration-400",
                                msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none shadow-blue-200" : "bg-white border border-slate-50 text-slate-800 rounded-tl-none font-medium"
                            )}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-6 bg-white/60 backdrop-blur-md border-t border-slate-100/30 rounded-b-[32px]">
                    <div className="flex flex-col gap-4">
                        <div className="relative flex-1 group">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    // Auto-resize logic
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                rows={1}
                                disabled={isThinking}
                                placeholder={isListening ? "지휘관님의 명령 청취 중..." : isThinking ? "루피가 생각하고 있습니다..." : "루피에게 명령 하달..."}
                                className={cn(
                                    "w-full pl-6 pr-14 py-4 bg-slate-100/70 border-none rounded-[20px] text-[15px] font-semibold focus:outline-none transition-all focus:bg-white focus:ring-8 focus:ring-blue-500/5 resize-none min-h-[56px] max-h-[150px] custom-scrollbar disabled:opacity-60",
                                    isListening && "ring-8 ring-blue-500/10 bg-white"
                                )}
            />
                            <button 
                                onClick={startListening} 
                                className={cn(
                                    "absolute right-4 top-4 p-2.5 rounded-2xl transition-all", 
                                    isListening ? "text-red-500 bg-red-50 shadow-inner scale-110" : "text-slate-600 hover:text-blue-600"
                                )}
                            >
                                <Mic className={cn("w-6 h-6", isListening && "animate-pulse")} />
                            </button>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={() => handleSendMessage()} 
                                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-300/50 font-bold"
                            >
                                <Send className="w-5 h-5" />
                                <span>명령 전송</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [isOpen, isConnected, isVoiceEnabled, isListening, messages, input, location.pathname, isTalking]);

    return (
        <div className="relative">
            {!isOpen && (
                <button onClick={(e) => { e.stopPropagation(); setIsOpen(true); }} className="relative group focus:outline-none transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-0.5 rounded-full hover:bg-blue-50/50">
                    <LoopieIcon className="w-7 h-7" isSmall />
                </button>
            )}
            {isOpen && createPortal(chatWindowContent, document.body)}
        </div>
    );
};

export default GlobalLoopieChat;
