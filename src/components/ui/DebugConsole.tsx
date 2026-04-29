'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, ChevronDown, Trash2 } from 'lucide-react';

export function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<{ type: string; msg: string; ts: string }[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, ...args: any[]) => {
      const msg = args.map(a => {
        if (typeof a === 'object' && a !== null) {
            try {
                return JSON.stringify(a);
            } catch {
                return "[Circular Object]"; 
            }
        }
        return String(a);
      }).join(' ');
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

    const handleError = (event: ErrorEvent) => {
        addLog('error', `Global: ${event.message} at ${event.lineno}:${event.colno}`);
    };

    window.addEventListener('error', handleError);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isMounted) return null;

  return (
    <>
      <button 
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // alert("DEBUG CONSOLE TOGGLE"); // Temporary verification
            setIsOpen(!isOpen);
        }}
        style={{ 
            zIndex: 999999,
            position: 'fixed',
            top: '20px',
            right: '20px',
            pointerEvents: 'auto'
        }}
        className="w-12 h-12 bg-[var(--primary)] text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(var(--ring),0.4)] active:scale-95 transition-transform"
      >
        {isOpen ? <ChevronDown size={24} /> : <Terminal size={24} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ zIndex: 99999 }}
            className="fixed inset-4 bottom-20 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-[32px] flex flex-col font-mono text-[10px] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                <span className="text-white/40 uppercase font-black tracking-widest flex items-center gap-2">
                    <Terminal size={12} /> System Kernel
                </span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setLogs([])} className="text-white/40 hover:text-white p-2"><Trash2 size={14} /></button>
                    <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white p-2"><X size={14} /></button>
                </div>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                {logs.length === 0 && <div className="text-white/20 italic">Listening for system output...</div>}
                {logs.map((l, i) => (
                    <div key={i} className="flex gap-3 border-b border-white/5 pb-2 last:border-0">
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
