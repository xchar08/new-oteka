'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

export function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<{ type: string; msg: string; ts: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, ...args: any[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setLogs(prev => [...prev.slice(-100), { 
        type, 
        msg, 
        ts: new Date().toLocaleTimeString() 
      }]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', ...args);
    };
    console.error = (...args) => {
      originalError(...args);
      addLog('error', ...args);
    };
    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };

    window.onerror = (msg, url, line, col, error) => {
        addLog('error', `Global: ${msg} at ${line}:${col}`);
        return false;
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-[9999] w-10 h-10 bg-black/80 border border-white/20 rounded-full flex items-center justify-center text-white/50 backdrop-blur-xl"
      >
        {isOpen ? <ChevronDown size={20} /> : <Terminal size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 z-[9998] h-[50vh] bg-black/95 backdrop-blur-2xl border-t border-white/10 flex flex-col font-mono text-[10px]"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5">
                <span className="text-white/40 uppercase font-black tracking-widest flex items-center gap-2">
                    <Terminal size={12} /> System Kernel Logs
                </span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setLogs([])} className="text-white/40 hover:text-white"><Trash2 size={14} /></button>
                    <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
                </div>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {logs.length === 0 && <div className="text-white/20 italic">Listening for output...</div>}
                {logs.map((l, i) => (
                    <div key={i} className="flex gap-3 border-b border-white/5 pb-2">
                        <span className="text-white/20 shrink-0">{l.ts}</span>
                        <span className={`shrink-0 font-bold uppercase ${
                            l.type === 'error' ? 'text-red-500' : 
                            l.type === 'warn' ? 'text-yellow-500' : 
                            'text-blue-400'
                        }`}>[{l.type}]</span>
                        <span className="text-white/80 break-all leading-relaxed">{l.msg}</span>
                    </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
