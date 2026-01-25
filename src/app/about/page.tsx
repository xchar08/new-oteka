export default function AboutPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">About Oteka</h1>
      <p>
        Oteka is a metabolic intelligence engine designed to remove the friction from tracking.
      </p>
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold">Core Tech</h3>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Volumetric Vision (Gemini 3.0 + DeepSeek R1)</li>
          <li>Entropy-Based Pantry Management</li>
          <li>WASM Metabolic Planner</li>
        </ul>
      </div>
    </div>
  );
}
