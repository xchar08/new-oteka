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
    const isLocked = status === 'locked';

    return (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            {/* Neural Grid Background */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: isScanning ? 0.3 : 0.1 }}
                className="absolute inset-0"
                style={{
                    backgroundImage: `linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                    perspective: '1000px',
                    transform: 'rotateX(60deg) translateY(-20%)',
                }}
            />

            {/* Corner Brackets */}
            <div className="absolute inset-10 border-[var(--primary)]/20 border-2 rounded-[40px]">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[var(--primary)] rounded-tl-3xl shadow-[0_0_15px_rgba(255,140,0,0.5)]" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[var(--primary)] rounded-tr-3xl shadow-[0_0_15px_rgba(255,140,0,0.5)]" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[var(--primary)] rounded-bl-3xl shadow-[0_0_15px_rgba(255,140,0,0.5)]" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[var(--primary)] rounded-br-3xl shadow-[0_0_15px_rgba(255,140,0,0.5)]" />
            </div>

            {/* Floating HUD Data */}
            <div className="absolute top-24 left-12 space-y-1">
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--primary)] block">Neural Sync</span>
                <span className="text-[10px] font-mono text-white/60 tabular-nums">98.42% OPTIMAL</span>
            </div>

            <div className="absolute top-24 right-12 text-right space-y-1">
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--primary)] block">Vital Signature</span>
                <span className="text-[10px] font-mono text-white/60 tabular-nums">LAT: 42.00 / OSC: {isScanning ? 'ACTIVE' : 'IDLE'}</span>
            </div>

            {/* Central Reticle */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 h-48">
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-2 border-dashed border-[var(--primary)]/30 rounded-full"
                    />
                    <motion.div 
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-4 border-2 border-[var(--primary)] rounded-full flex items-center justify-center"
                    >
                        <div className="w-1 h-1 bg-[var(--primary)] rounded-full shadow-[0_0_10px_var(--primary)]" />
                    </motion.div>
                </div>
            </div>

            {/* Bottom Frequency Wave */}
            <div className="absolute bottom-40 left-0 right-0 h-12 flex items-end justify-center gap-[2px]">
                {Array.from({ length: 40 }).map((_, i) => (
                    <motion.div 
                        key={i}
                        animate={{ 
                            height: isScanning ? [4, Math.random() * 30 + 4, 4] : 4 
                        }}
                        transition={{ 
                            duration: 0.5, 
                            repeat: Infinity,
                            delay: i * 0.02 
                        }}
                        className="w-[2px] bg-[var(--primary)] rounded-full opacity-40"
                    />
                ))}
            </div>

            {/* Scanning Bar */}
            {isScanning && (
                <motion.div 
                    initial={{ top: '15%' }}
                    animate={{ top: '85%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent shadow-[0_0_20px_var(--primary)] z-10"
                />
            )}

            <div className="absolute bottom-48 left-0 right-0 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white drop-shadow-lg">
                    {isScanning ? 'Extracting Bio-Logistics' : 'Neural Core Ready'}
                </span>
            </div>
        </div>
    );
}
