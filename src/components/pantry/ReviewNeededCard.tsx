'use client';

import { useState } from 'react';

interface ReviewNeededCardProps {
  id: number;
  name: string;
  probability: number;
  onConfirmGood: (fraction: number) => Promise<void> | void;
  onConfirmSpoiled: () => Promise<void> | void;
}

export function ReviewNeededCard(props: ReviewNeededCardProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (fn: () => Promise<void> | void) => {
    if (busy) return;
    try {
      setBusy(true);
      await fn();
    } finally {
      setBusy(false);
    }
  };

  // Convert "Health Score" (0-1) to "Spoilage Risk" %
  const spoilageChance = Math.round((1 - props.probability) * 100);

  return (
    <div className={`
      relative bg-[var(--bg-surface)] border border-[var(--primary)]/20 rounded-[28px] p-6 shadow-sm 
      flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 
      animate-in slide-in-from-right-2 fade-in duration-300 overflow-hidden
      ${busy ? 'opacity-50 pointer-events-none' : ''}
    `}>
      {/* Background Pulse */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)]">
            Biological Review Protocol
          </span>
        </div>
        
        <div className="text-xl font-black text-[var(--text-primary)] mt-2 tracking-tight">
          {props.name}
        </div>
        
        <div className="text-[10px] font-bold text-[var(--text-secondary)] mt-1 uppercase tracking-widest opacity-60">
          <span className="text-[var(--primary)]">{spoilageChance}%</span> Probability of Depletion
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto relative z-10">
        <div className="flex gap-2 w-full">
            {[0.25, 0.5, 0.75, 1].map((frac) => (
                <button
                  key={frac}
                  disabled={busy}
                  onClick={() => handleClick(() => props.onConfirmGood(frac))}
                  className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white rounded-xl border border-[var(--primary)]/20 transition-all active:scale-95"
                >
                  {frac === 1 ? 'Full' : `${frac * 100}%`}
                </button>
            ))}
        </div>
        <button
          disabled={busy}
          onClick={() => handleClick(props.onConfirmSpoiled)}
          className="w-full px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 transition-all active:scale-95 hover:bg-red-500 hover:text-white"
        >
          Depleted (0%)
        </button>
      </div>
    </div>
  );
}
