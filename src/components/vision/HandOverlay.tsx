'use client';

import React from 'react';

export function HandOverlay() {
    return (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            {/* Semi-transparent overlay to guide hand placement */}
            <div className="relative h-64 w-48 border-2 border-dashed border-white/50 bg-black/20 backdrop-blur-sm">
                <div className="absolute inset-0 flex items-center justify-center text-white/80">
                    <span className="text-center text-sm font-medium">
                        Align Hand Here<br />
                        (Reference for Volume)
                    </span>
                </div>

                {/* Corner markers */}
                <div className="absolute top-0 left-0 h-4 w-4 border-l-2 border-t-2 border-emerald-400"></div>
                <div className="absolute top-0 right-0 h-4 w-4 border-r-2 border-t-2 border-emerald-400"></div>
                <div className="absolute bottom-0 left-0 h-4 w-4 border-l-2 border-b-2 border-emerald-400"></div>
                <div className="absolute bottom-0 right-0 h-4 w-4 border-r-2 border-b-2 border-emerald-400"></div>
            </div>
        </div>
    );
}
