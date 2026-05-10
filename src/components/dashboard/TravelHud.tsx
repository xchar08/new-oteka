'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Signal, Wifi, ChevronRight, Sparkles, Map } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * TravelHud - Location-Aware Metabolic Logistics
 * Aesthetic: High-end GPS hardware, monospace readouts, 1px radar lines.
 */
export function TravelHud() {
    const [mounted, setMounted] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [restaurant, setRestaurant] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        const startTracking = async () => {
            if (!Capacitor.isNativePlatform()) {
                // Mock for web
                setRestaurant('Lumina Gastro-Hub');
                setLocation({ lat: 40.7128, lng: -74.0060 });
                return;
            }

            try {
                setIsSyncing(true);
                const position = await Geolocation.getCurrentPosition();
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                
                // Logic would call a reverse geocode service here
                // For now, let's show detected state
                setRestaurant('Lumina Gastro-Hub');
            } catch (e) {
                console.error("GPS Lock Failed", e);
            } finally {
                setIsSyncing(false);
            }
        };

        startTracking();
    }, []);

    if (!mounted) return null;

    return (
        <motion.div 
            whileHover={{ y: -2 }}
            className="relative bg-[#1a1206] border border-[var(--primary)]/20 rounded-[32px] p-6 overflow-hidden shadow-2xl shadow-[var(--primary)]/5 group"
        >
            {/* Precision Radar Background HUD */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-[var(--primary)] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-[var(--primary)] rounded-full" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[var(--primary)]" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[var(--primary)]" />
            </div>

            <div className="relative z-10 flex flex-col gap-6">
                {/* Status Bar */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--primary)] font-mono">
                            GPS Signal: Active
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-[8px] font-bold text-white/30 font-mono uppercase">
                        <span>LAT: {location?.lat.toFixed(4) || '---'}</span>
                        <span>LNG: {location?.lng.toFixed(4) || '---'}</span>
                    </div>
                </div>

                {/* Main Readout */}
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 block">Detected Node</span>
                    <div className="flex items-center gap-3">
                        <h4 className="text-xl font-black text-white tracking-tight font-mono truncate">
                            {restaurant || 'Searching...'}
                        </h4>
                        {isSyncing && <Signal size={14} className="text-[var(--primary)] animate-bounce" />}
                    </div>
                </div>

                {/* Environmental Meta */}
                <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                    <div className="space-y-1">
                        <span className="text-[8px] font-bold uppercase text-white/30 block">Ambience</span>
                        <span className="text-[10px] font-black text-white font-mono uppercase tracking-widest">62dB</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] font-bold uppercase text-white/30 block">O2 Levels</span>
                        <span className="text-[10px] font-black text-white font-mono uppercase tracking-widest">Optimal</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] font-bold uppercase text-white/30 block">Status</span>
                        <span className="text-[10px] font-black text-[var(--primary)] font-mono uppercase tracking-widest">Synced</span>
                    </div>
                </div>

                {/* Launch Button */}
                <button 
                    onClick={() => router.push('/travel/menu')}
                    className="w-full h-14 mt-2 bg-[var(--primary)] text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[var(--primary)]/20 active:scale-[0.98] transition-all group/btn"
                >
                    <Map size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Launch Menu Optimizer</span>
                    <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
}
