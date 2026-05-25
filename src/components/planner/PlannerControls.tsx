'use client';

export type PlannerConstraints = {
  strictness: boolean;
};

export function PlannerControls({ onRun }: { onRun: (c: PlannerConstraints) => void }) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // We only take "strictness" now. 
    // Weight, Calories, and Protein are derived from the User Profile server-side/worker-side.
    onRun({
      strictness: formData.get('strict') === 'on',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] border border-[var(--border)] backdrop-blur-md p-5 rounded-[28px] shadow-sm space-y-5">
      <div className="p-3 bg-[var(--primary)]/10 text-[var(--text-primary)] text-sm rounded-2xl border border-[var(--primary)]/20 leading-relaxed">
        <strong className="text-[var(--primary)] font-black text-[10px] uppercase tracking-widest">Auto-Optimized</strong>
        <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">Macros are calculated based on your biological profile.</p>
      </div>

      <label className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--bg-app)] transition-colors cursor-pointer border border-[var(--border)]">
        <input 
          name="strict" 
          type="checkbox" 
          id="strict" 
          defaultChecked 
          className="rounded border-[var(--border)] bg-[var(--bg-app)] text-[var(--primary)] focus:ring-[var(--primary)]/50 h-5 w-5"
        />
        <span className="text-sm text-[var(--text-primary)] font-bold">
          Strict Pantry Only <span className="text-[var(--text-secondary)] font-normal text-xs">(No Shopping)</span>
        </span>
      </label>

      <button 
        type="submit" 
        className="w-full bg-[var(--primary)] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-lg shadow-[var(--primary)]/20 active:scale-95"
      >
        Generate Meal Plan
      </button>
    </form>
  );
}
