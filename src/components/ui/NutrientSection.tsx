'use client';

import React, { useState } from 'react';
import type { NutrientEntry } from '@/lib/types/metabolic';
import { NutrientInfoModal } from './NutrientInfoModal';

interface NutrientSectionProps {
  title: string;
  items: NutrientEntry[];
}

/**
 * Shared component for rendering categorized nutrient lists
 * (Vitamins, Minerals, Other Nutrients).
 * Used in log, history, and scan result views.
 */
export function NutrientSection({ title, items }: NutrientSectionProps) {
  const [selectedNutrient, setSelectedNutrient] = useState<NutrientEntry | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <div>
      <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-3 ml-1">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div 
            key={i} 
            onClick={() => setSelectedNutrient(item)}
            className="flex justify-between items-center px-1 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all rounded-lg py-1 -mx-1 group"
          >
            <span className="text-sm text-[var(--text-primary)] font-medium group-hover:text-[var(--primary)] transition-colors">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                {item.amount}
              </span>
              {item.daily_value_pct != null && (
                <span className="text-[10px] font-bold text-[var(--primary)] tabular-nums">
                  {item.daily_value_pct}% DV
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <NutrientInfoModal 
        nutrientName={selectedNutrient?.name || ''}
        isOpen={!!selectedNutrient}
        onClose={() => setSelectedNutrient(null)}
        currentDv={selectedNutrient?.daily_value_pct ?? undefined}
      />
    </div>
  );
}
