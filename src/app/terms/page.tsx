export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl mx-auto text-foreground space-y-6">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: January 2026</p>
      <div className="prose dark:prose-invert">
        <p>By using Oteka, you agree to the following terms regarding metabolic data processing, volumetric estimation accuracy, and AI-driven advice.</p>
        <h3>1. Metabolic Data</h3>
        <p>Your inputs (weight, height, metabolic logs) are encrypted and used solely for the purpose of generating personalized insights.</p>
        <h3>2. AI Advice</h3>
        <p>The "Metabolic Advisor" is an AI system (Gemini/DeepSeek) and does not constitute professional medical advice.</p>
      </div>
    </div>
  );
}
