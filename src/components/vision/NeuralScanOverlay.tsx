'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function NeuralScanOverlay({ 
    status = 'idle', 
    show = true 
}: { 
    status?: 'idle' | 'scanning' | 'locked', 
    show?: boolean
}) {
    if (!show) return null;

    const isScanning = status === 'scanning';

    return (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden font-mono">
            {/* 1px Edge Framing */}
            <div className="absolute inset-6 border border-white/5 rounded-[40px]">
                {/* Corner Accents - 1px Precise lines */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[var(--primary)] rounded-tl-2xl shadow-[0_0_10px_rgba(255,140,0,0.3)]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[var(--primary)] rounded-tr-2xl shadow-[0_0_10px_rgba(255,140,0,0.3)]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[var(--primary)] rounded-bl-2xl shadow-[0_0_10px_rgba(255,140,0,0.3)]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[var(--primary)] rounded-br-2xl shadow-[0_0_10_rgba(255,140,0,0.3)]" />
            </div>

            {/* Precision HUD Data - JetBrains Mono style */}
            <div className="absolute top-16 left-10 space-y-0.5">
                <div className="flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse" />
                   <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--primary)]">REF: CALIB_AUTO</span>
                </div>
                <span className="text-[9px] text-white/40 tabular-nums">X_POS: 42.08 / Y_POS: 11.02</span>
            </div>

            <div className="absolute top-16 right-10 text-right space-y-0.5">
                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--primary)] block">SIGNAL: LOCK</span>
                <span className="text-[9px] text-white/40 tabular-nums">PWR: {isScanning ? 'MAX_UTIL' : 'IDLE_SYNC'}</span>
            </div>

            <div className="absolute bottom-32 left-10 space-y-0.5">
                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--primary)] block">SPEC: BIO_MASS</span>
                <span className="text-[9px] text-white/40 tabular-nums">ISO_CH: 800 / GAIN: +2dB</span>
            </div>

            <div className="absolute bottom-32 right-10 text-right space-y-0.5">
                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--primary)] block">SCAN_RES: N_HIGH</span>
                <span className="text-[9px] text-white/40 tabular-nums">LATENCY: 12ms</span>
            </div>

            {/* Central Precision Reticle */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-24 h-24 flex items-center justify-center">
                    {/* Horizontal 1px line */}
                    <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--primary)]/40 to-transparent" />
                    {/* Vertical 1px line */}
                    <div className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[var(--primary)]/40 to-transparent" />
                    
                    {/* Focal Dot */}
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_15px_var(--primary)] z-10" />
                    
                    {/* Pulsing focal ring */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-12 h-12 border border-[var(--primary)]/20 rounded-full"
                    />
                </div>
            </div>

            {/* Laser Sweep Animation */}
            {isScanning && (
                <motion.div 
                    initial={{ top: '10%', opacity: 0 }}
                    animate={{ top: '90%', opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent shadow-[0_0_10px_var(--primary)] z-10"
                />
            )}

            {/* Bottom Processing Label */}
            <div className="absolute bottom-28 left-0 right-0 text-center">
                <motion.span 
                    animate={isScanning ? { opacity: [0.4, 1, 0.4] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[8px] font-black uppercase tracking-[0.5em] text-white/80"
                >
                    {isScanning ? 'Extracting Bio-Logistics' : 'Optics Ready'}
                </motion.span>
            </div>
        </div>
    );
}
