'use client';

type MacroData = {
  label: string;
  current: number;
  target: number;
  color: string;
};

export function NutrientRadar({ macros }: { macros: MacroData[] }) {
  // Simple linear progress bars for the MVP (Radar charts often confusing on small screens)
  return (
    <div className="space-y-4 bg-[var(--palenight-surface)] p-4 rounded-xl shadow-lg border border-white/5">
      <h3 className="font-semibold text-zinc-400 mb-2">Daily Fuel</h3>
      
      {macros.map((m) => {
        const percent = Math.min(100, Math.max(0, (m.current / m.target) * 100));
        
        return (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-zinc-500">{m.label}</span>
              <span className="text-zinc-300">{m.current} / {m.target}g</span>
            </div>
            <div className="h-2 bg-[var(--palenight-bg)] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${m.color}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
