'use client';

import { useState } from 'react';

interface ReviewNeededCardProps {
  id: number;
  name: string;
  probability: number;
  onConfirmGood: () => Promise<void> | void;
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
      // In optimistic UIs, the card might disappear before this runs, 
      // which is fine (React handles unmount cleanup).
      setBusy(false);
    }
  };

  // Convert "Health Score" (0-1) to "Spoilage Risk" %
  const spoilageChance = Math.round((1 - props.probability) * 100);

  return (
    <div className={`
      relative bg-white border border-orange-200 rounded-lg p-4 shadow-sm 
      flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 
      animate-in slide-in-from-right-2 fade-in duration-300
      ${busy ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
            Review Needed
          </span>
        </div>
        
        <div className="text-lg font-semibold text-gray-900 mt-1">
          {props.name}
        </div>
        
        <div className="text-xs text-orange-600 mt-1">
          {spoilageChance}% calculated risk of spoilage
        </div>
      </div>

      <div className="flex gap-3 w-full sm:w-auto">
        <button
          disabled={busy}
          onClick={() => handleClick(props.onConfirmSpoiled)}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-red-50 text-red-700 rounded-md hover:bg-red-100 border border-red-200 transition-colors"
        >
          Spoiled / Used
        </button>
        
        <button
          disabled={busy}
          onClick={() => handleClick(props.onConfirmGood)}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-md hover:bg-green-100 border border-green-200 transition-colors"
        >
          Still Have It
        </button>
      </div>
    </div>
  );
}
