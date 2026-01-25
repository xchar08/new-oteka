'use client';

export type PlannerConstraints = {
  calories_max: number;
  protein_target: number;
  strictness: boolean;
};

export function PlannerControls({ onRun }: { onRun: (c: PlannerConstraints) => void }) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onRun({
      calories_max: Number(formData.get('calories')),
      protein_target: Number(formData.get('protein')),
      strictness: formData.get('strict') === 'on',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium">Max Calories</label>
        <input name="calories" type="number" defaultValue={600} className="w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium">Min Protein (g)</label>
        <input name="protein" type="number" defaultValue={30} className="w-full border p-2 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <input name="strict" type="checkbox" id="strict" defaultChecked />
        <label htmlFor="strict" className="text-sm">Strict Pantry Only (No Shopping)</label>
      </div>
      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700">
        Generate Plan (WASM)
      </button>
    </form>
  );
}
