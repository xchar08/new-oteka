'use client';

import React, { useRef } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface PricingGuardProps {
  plan?: string;
  children: React.ReactNode;
  featureName?: string;
}

export function PricingGuard({ plan = 'free', children, featureName = 'This feature' }: PricingGuardProps) {
  const lastToastTime = useRef<number>(0);
  const isPro = plan === 'pro';

  const handleClickCapture = (e: React.MouseEvent) => {
    if (isPro) return;
    
    // STOP EVERYTHING in the capture phase
    e.preventDefault();
    e.stopPropagation();

    // Rate limit toast to once every 3 seconds to prevent spam
    const now = Date.now();
    if (now - lastToastTime.current < 3000) return;
    lastToastTime.current = now;

    toast.custom((t) => (
      <div className="bg-[var(--secondary)] border border-[var(--primary)] text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
        <div className="w-10 h-10 bg-[var(--primary)]/20 rounded-xl flex items-center justify-center text-[var(--primary)] shrink-0">
          <Lock size={20} fill="currentColor" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary)]">Premium Access</span>
            <Sparkles size={10} className="text-[var(--primary)] animate-pulse" />
          </div>
          <p className="text-xs font-bold leading-tight">
            {featureName} requires Oteka Solar.
          </p>
        </div>
        <button 
          onClick={() => {
            toast.dismiss(t);
            window.location.href = '/pricing';
          }}
          className="bg-[var(--primary)] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg ml-2 active:scale-95 transition-transform"
        >
          Upgrade
        </button>
      </div>
    ), {
      duration: 3000,
      position: 'bottom-center'
    });
  };

  return (
    <div onClickCapture={handleClickCapture} className="relative group cursor-pointer h-full">
      {children}
      {!isPro && (
        <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-[var(--primary)] text-white p-1 rounded-full shadow-lg border border-[var(--bg-app)] z-20 scale-75 group-hover:scale-100 transition-transform">
          <Lock size={8} fill="currentColor" />
        </div>
      )}
    </div>
  );
}
