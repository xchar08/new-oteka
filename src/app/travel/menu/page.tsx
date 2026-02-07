'use client';

import { useState } from 'react';
import { Camera as LucideCamera, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export default function MenuScannerPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const supabase = createClient();

  // Helper: Resize image to max 1024px width/height to speed up upload
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1024;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]); // base64 without prefix
      };
      img.onerror = reject;
    });
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      // 1. Client-side Resize
      const base64 = await resizeImage(file);

      // 2. Call Edge Function (vision-menu)
      const { data, error } = await supabase.functions.invoke('vision-menu', {
        body: { image: base64, goal: 'travel' }, // you can pass real goal from user state
      });

      if (error) {
        console.error(error);
        throw new Error(error.message || 'Failed to analyze menu');
      }

      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not read menu. Ensure good lighting and try again.');
    } finally {
      setAnalyzing(false);
      e.target.value = ''; // allow re-selecting same file
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100 space-y-6 animate-in fade-in duration-500">
      <header className="pt-safe">
        <h1 className="text-3xl font-light tracking-tight text-white mb-1">Menu Parser</h1>
        <p className="text-zinc-500 text-sm">AI Analysis • Travel Mode</p>
      </header>

      {error && (
        <div className="bg-red-500/10 text-red-200 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!result && !analyzing && (
        <div 
          onClick={async () => {
             // ... existing camera logic ... (lines 100-121)
             if (Capacitor.isNativePlatform()) {
                try {
                  const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.Base64
                  });
                  if (image.base64String) {
                     setAnalyzing(true);
                     const { data, error } = await supabase.functions.invoke('vision-menu', {
                        body: { image: image.base64String, goal: 'travel' }, 
                     });
                      if (error) throw new Error(error.message);
                      setResult(data);
                      setAnalyzing(false);
                  }
                } catch (e) {
                   console.error("Camera cancelled or failed", e);
                }
             }
          }}
          className="relative border border-dashed border-white/10 h-64 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex flex-col items-center justify-center w-full h-full z-10">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]">
                <LucideCamera size={32} />
              </div>
              <span className="block text-white font-medium text-lg tracking-tight">Scan Menu</span>
              <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">
                {Capacitor.isNativePlatform() ? "Tap to Camera" : "Upload Image"}
              </span>
            </div>
            
            {!Capacitor.isNativePlatform() && (
               <input
                type="file"
                accept="image/*"
                onChange={handleCapture}
                className="opacity-0 absolute inset-0 cursor-pointer"
               />
            )}
          </div>
        </div>
      )}

      {analyzing && (
        <div className="text-center p-12 space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="font-bold text-white tracking-tight">Analyzing Menu...</h3>
            <p className="text-zinc-500 text-sm">Identifying high-protein options</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-light text-white tracking-tight">
              {result.restaurant_name || 'Menu Results'}
            </h2>
            <Button
              variant="ghost"
              onClick={() => setResult(null)}
              className="text-zinc-400 hover:text-white px-2 py-1 text-sm h-auto"
            >
              <RefreshCw size={14} className="mr-2" /> Scan Again
            </Button>
          </div>

          <div className="grid gap-4">
            {result.items?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="border border-white/5 p-5 rounded-2xl shadow-sm bg-white/5 text-zinc-100 backdrop-blur-md"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white text-lg leading-tight w-[70%]">
                    {item.name}
                  </span>
                  <span
                    className={`font-mono text-sm px-2 py-0.5 rounded ${
                      item.health_score >= 8
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.estimated_calories} kcal
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  {item.description}
                </p>

                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold border ${
                      item.health_score >= 8
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : item.health_score >= 5
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    Score: {item.health_score}/10
                  </span>

                  {item.tags?.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
            <strong>Dietary Note:</strong>{' '}
            {result.dietary_warnings?.join(', ') ||
              'No major warnings detected.'}
          </div>

          <Button onClick={() => setResult(null)} className="w-full h-12 text-lg">
            Scan Another Menu
          </Button>
        </div>
      )}
    </div>
  );
}
