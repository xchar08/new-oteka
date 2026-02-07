'use client';

import React from 'react';

export function HandOverlay({ status = 'idle', boundingBox }: { status?: 'idle' | 'scanning' | 'locked', boundingBox?: number[] }) {
    const isLocked = status === 'locked';
    const isScanning = status === 'scanning';
    
    // Dynamic styles
    const borderColor = isLocked ? 'border-emerald-400' : 'border-white/50';
    const shadowColor = isLocked ? 'shadow-[0_0_30px_rgb(52,211,153)]' : '';

    // Calculate Box Position
    // Default: Centered, Fixed Size (Top 50%, Left 50%, translate -50%)
    // Locked + Box: Use percentages from [ymin, xmin, ymax, xmax] (0-1000 scale)
    
    let boxStyle: React.CSSProperties = {
        top: '50%',
        left: '50%',
        width: '14rem', // 56
        height: '18rem', // 72
        transform: 'translate(-50%, -50%)' 
    };

    if (isLocked && boundingBox && boundingBox.length === 4) {
        const [ymin, xmin, ymax, xmax] = boundingBox;
        // Convert 1000-scale to percentage
        const top = (ymin / 1000) * 100;
        const left = (xmin / 1000) * 100;
        const height = ((ymax - ymin) / 1000) * 100;
        const width = ((xmax - xmin) / 1000) * 100;

        boxStyle = {
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            transform: 'none' // Remove center transform
        };
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-40 transition-all duration-300">
            {/* Center Focus Frame */}
            <div 
                className={`absolute transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${isLocked ? 'scale-[1.02] bg-emerald-500/10' : 'scale-100 bg-transparent'}`}
                style={boxStyle}
            >
                {/* Glass Blur Effect inside frame */}
                {isScanning && <div className="absolute inset-0 backdrop-blur-[1px] rounded-3xl" />}

                {/* Corners - Premium Rounded */}
                <div className={`absolute top-0 left-0 h-8 w-8 border-l-[3px] border-t-[3px] rounded-tl-3xl transition-all duration-500 ${isLocked ? 'border-emerald-400 translate-x-[-2px] translate-y-[-2px]' : 'border-white/40'}`}></div>
                <div className={`absolute top-0 right-0 h-8 w-8 border-r-[3px] border-t-[3px] rounded-tr-3xl transition-all duration-500 ${isLocked ? 'border-emerald-400 translate-x-[2px] translate-y-[-2px]' : 'border-white/40'}`}></div>
                <div className={`absolute bottom-0 left-0 h-8 w-8 border-l-[3px] border-b-[3px] rounded-bl-3xl transition-all duration-500 ${isLocked ? 'border-emerald-400 translate-x-[-2px] translate-y-[2px]' : 'border-white/40'}`}></div>
                <div className={`absolute bottom-0 right-0 h-8 w-8 border-r-[3px] border-b-[3px] rounded-br-3xl transition-all duration-500 ${isLocked ? 'border-emerald-400 translate-x-[2px] translate-y-[2px]' : 'border-white/40'}`}></div>

                {/* Scanning Beam */}
                {isScanning && (
                   <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_rgb(52,211,153)] animate-[scan_2s_ease-in-out_infinite]" />
                )}

                {/* Text Guide */}
                <div className="absolute -bottom-12 left-0 right-0 text-center whitespace-nowrap overflow-visible">
                    <p className={`text-xs uppercase tracking-[0.2em] font-medium drop-shadow-lg transition-colors duration-300 ${isLocked ? 'text-emerald-400' : 'text-white/60'}`}>
                        {isLocked ? '• Analysis Complete •' : (isScanning ? 'Processing...' : 'Ready to Scan')}
                    </p>
                </div>
            </div>
            
            <style jsx global>{`
              @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
        </div>
    );
}
