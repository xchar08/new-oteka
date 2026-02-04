export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-palenight-bg p-8 max-w-2xl mx-auto text-zinc-100 space-y-6">
      <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="text-zinc-300">Oteka processes images to estimate food volume.</p>
      
      <section className="space-y-2">
        <h3 className="text-xl font-bold text-white">Camera Usage</h3>
        <p className="text-zinc-400 leading-relaxed">We use your camera strictly for food analysis. Images are processed by Gemini/DeepSeek and are not sold to third parties.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xl font-bold text-white">Offline Data</h3>
        <p className="text-zinc-400 leading-relaxed">When offline, data is stored locally on your device using AES encryption until connectivity is restored.</p>
      </section>
    </div>
  );
}
