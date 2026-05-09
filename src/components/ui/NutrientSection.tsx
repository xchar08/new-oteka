import type { NutrientEntry } from '@/lib/types/metabolic';

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
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h4 className="text-[9px] uppercase tracking-widest font-black text-[var(--text-secondary)] mb-3 ml-1">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center px-1">
            <span className="text-sm text-[var(--text-primary)] font-medium">
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
    </div>
  );
}
