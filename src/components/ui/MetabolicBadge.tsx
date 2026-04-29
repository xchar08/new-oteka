'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Info, X, Zap } from 'lucide-react';

export function MetabolicBadge({ 
    name, 
    why 
}: { 
    name: string; 
    why: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(var(--ring),0.1)] transition-all"
      >
        <Zap size={10} fill="currentColor" />
        {name}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-full bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                    <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shadow-inner">
                    <Sparkles size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-[var(--text-primary)] uppercase italic">{name}</h3>
                    <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-[0.3em] mt-1">Neural Insight Triggered</p>
                </div>
                
                <div className="space-y-4">
                    <div className="bg-[var(--bg-app)] border border-[var(--border)] p-5 rounded-2xl">
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                            {why}
                        </p>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed font-bold uppercase tracking-widest opacity-40">
                        Biological context provided by Oteka Vitality Engine
                    </p>
                </div>

                <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full h-14 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
                >
                    Neural Sync Acknowledged
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
