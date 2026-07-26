import React, { useEffect, useState, useRef } from 'react';
import { Terminal, BrainCircuit, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'BRAIN';
    message: string;
    metadata?: any;
}

const CognitiveTrace = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // [Phase 4-3-2] Mocking WebSocket stream for demonstration as we evolve the backend
    // In production, this connects to ws://target.svc.cluster.local:8000/api/swarm/stream
    useEffect(() => {
        const interval = setInterval(() => {
            const levels: LogEntry['level'][] = ['INFO', 'BRAIN', 'INFO', 'WARN'];
            const level = levels[Math.floor(Math.random() * levels.length)];
            const newLog: LogEntry = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toLocaleTimeString(),
                level,
                message: level === 'BRAIN' 
                    ? `[Loopie] Semantic Wisdom Recalled: Past success in ${Math.random() > 0.5 ? 'Tech' : 'Health'} niche applied.`
                    : `Agent swarm executing mission segment ${Math.floor(Math.random() * 100)}...`
            };
            setLogs(prev => [...prev.slice(-50), newLog]);
        }, 1500);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="sovereign-card h-[450px] flex flex-col relative overflow-hidden">
            <div className="scanline" />
            
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <Terminal className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold sovereign-text tracking-wider uppercase text-xs">
                        Sovereign Cognitive Trace
                    </h3>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">Live Swarm Connection</span>
                </div>
            </div>

            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar font-mono text-xs"
            >
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-2 rounded border bg-black/20 ${
                                log.level === 'BRAIN' ? 'border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                                log.level === 'ERROR' ? 'border-red-500/30' : 
                                'border-white/5'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-white/30 whitespace-nowrap">[{log.timestamp}]</span>
                                {log.level === 'BRAIN' && <BrainCircuit className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
                                {log.level === 'WARN' && <AlertCircle className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />}
                                <p className={`${
                                    log.level === 'BRAIN' ? 'text-primary' : 
                                    log.level === 'ERROR' ? 'text-red-400' : 
                                    'text-white/70'
                                } leading-relaxed`}>
                                    {log.message}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            
            <div className="absolute bottom-4 right-4 pointer-events-none opacity-20">
                <Sparkles className="w-24 h-24 text-primary blur-3xl" />
            </div>
        </div>
    );
};

export default CognitiveTrace;
