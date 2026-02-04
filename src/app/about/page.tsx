export default function AboutPage() {
  return (
    <div className="min-h-screen bg-palenight-bg p-8 max-w-2xl mx-auto space-y-6 text-zinc-100">
      <h1 className="text-3xl font-bold text-white">About Oteka</h1>
      <p className="text-zinc-400 leading-relaxed">
        Oteka is a metabolic intelligence engine designed to remove the friction from tracking.
      </p>
      <div className="bg-palenight-surface p-6 rounded-2xl border border-white/5 shadow-xl">
        <h3 className="font-bold text-white text-lg">Core Tech</h3>
        <ul className="list-disc pl-5 space-y-2 mt-3 text-zinc-300">
          <li>Volumetric Vision (Gemini 3.0 + DeepSeek R1)</li>
          <li>Entropy-Based Pantry Management</li>
          <li>WASM Metabolic Planner</li>
        </ul>
      </div>
    </div>
  );
}
