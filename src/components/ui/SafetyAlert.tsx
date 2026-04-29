'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, AlertCircle, TriangleAlert } from 'lucide-react';

export function SafetyAlert({ 
    reason, 
    type = 'urgent' 
}: { 
    reason: string; 
    type?: 'warning' | 'urgent';
}) {
  const [isOpen, setIsOpen] = useState(false);

  const isUrgent = type === 'urgent';

  return (
    <>
      <motion.button
        animate={isUrgent ? { 
            scale: [1, 1.1, 1],
            backgroundColor: ["rgba(239, 68, 68, 0.1)", "rgba(239, 68, 68, 0.3)", "rgba(239, 68, 68, 0.1)"]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all ${
            isUrgent 
            ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
        }`}
      >
        <TriangleAlert size={10} fill="currentColor" fillOpacity={0.2} />
        {isUrgent ? 'URGENT ALERT' : 'SAFETY WARNING'}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-950 border-2 border-red-500/30 rounded-[40px] p-8 shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white">
                    <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-[32px] bg-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse">
                    <ShieldAlert size={40} />
                </div>
                
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-white uppercase italic">Protocol Violation</h3>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.3em] mt-1">Biological Integrity Compromised</p>
                </div>
                
                <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl w-full">
                    <p className="text-sm text-red-100/90 leading-relaxed font-medium">
                        {reason}
                    </p>
                </div>

                <div className="space-y-4 w-full">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="w-full h-16 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
                    >
                        Override & Acknowledge
                    </button>
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">
                        Neural Core Safety Handlers Active
                    </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
