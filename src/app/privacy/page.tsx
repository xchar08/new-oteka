export default function PrivacyPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto prose">
      <h1>Privacy Policy</h1>
      <p>Oteka processes images to estimate food volume.</p>
      <h3>Camera Usage</h3>
      <p>We use your camera strictly for food analysis. Images are processed by Gemini/DeepSeek and are not sold to third parties.</p>
      <h3>Offline Data</h3>
      <p>When offline, data is stored locally on your device using AES encryption until connectivity is restored.</p>
    </div>
  );
}
