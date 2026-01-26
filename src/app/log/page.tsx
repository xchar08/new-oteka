'use client';

import { useState } from 'react';
import { Camera, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/state/appStore';

export default function LogPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const supabase = createClient();

  // Handle Image Upload
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setResult(null);

    try {
      // 1. Convert to Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];

        // 2. Send to Vision Pipeline
        const { data: { session } } = await supabase.auth.getSession();
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vision-pipeline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64 }),
        });

        if (!res.ok) throw new Error('Analysis failed');

        const data = await res.json();
        setResult(data);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto pb-24 space-y-6">
      <h1 className="text-2xl font-bold">Log Meal</h1>

      {/* Camera / Upload Button */}
      <div className="relative">
        <input
          type="file"
          accept="image/*"
          capture="environment" // Forces camera on mobile
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          onChange={handleCapture}
          disabled={analyzing}
        />
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
          {analyzing ? (
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
          ) : (
            <>
              <Camera className="w-12 h-12 mb-2 text-blue-500" />
              <span className="font-medium">Tap to Snap Food</span>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start gap-4">
            <div className="bg-green-100 p-2 rounded-full">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{result.summary.name}</h3>
              <div className="text-sm text-gray-500 mt-1 space-y-1">
                <p>🔥 {result.summary.calories} Calories</p>
                <div className="flex gap-3 text-xs">
                  <span>P: {result.macros?.protein}g</span>
                  <span>C: {result.macros?.carbs}g</span>
                  <span>F: {result.macros?.fat}g</span>
                </div>
              </div>
            </div>
          </div>
          
          <Button className="w-full mt-4" onClick={() => window.location.href = '/dashboard'}>
            Confirm Log
          </Button>
        </div>
      )}
    </div>
  );
}
