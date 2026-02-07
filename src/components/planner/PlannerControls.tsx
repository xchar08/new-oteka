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
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl shadow-sm space-y-5">
      <div className="p-3 bg-blue-500/10 text-blue-200 text-sm rounded-lg border border-blue-500/20 leading-relaxed">
        <strong className="text-blue-400">Auto-Optimized:</strong> Macros are calculated based on your biological profile.
      </div>

      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => (document.getElementById('strict') as HTMLInputElement)?.click()}>
        <input 
          name="strict" 
          type="checkbox" 
          id="strict" 
          defaultChecked 
          className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50 h-5 w-5"
        />
        <label htmlFor="strict" className="text-sm text-zinc-300 font-medium cursor-pointer">
          Strict Pantry Only <span className="text-zinc-500 font-normal">(No Shopping)</span>
        </label>
      </div>

      <button 
        type="submit" 
        className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-all shadow-lg shadow-white/5 active:scale-95"
      >
        Generative Meal Plan
      </button>
    </form>
  );
}
