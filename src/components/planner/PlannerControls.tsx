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
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm space-y-4">
      <div className="p-3 bg-blue-900/20 text-blue-200 text-sm rounded border border-blue-900/50">
        <strong>Auto-Optimized:</strong> Macros are now calculated based on your 
        biological profile (Hand Width & Goal).
      </div>

      <div className="flex items-center gap-2">
        <input 
          name="strict" 
          type="checkbox" 
          id="strict" 
          defaultChecked 
          className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="strict" className="text-sm text-zinc-300">
          Strict Pantry Only (No Shopping)
        </label>
      </div>

      <button 
        type="submit" 
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-500 transition-colors"
      >
        Rank Meal Compositions
      </button>
    </form>
  );
}
