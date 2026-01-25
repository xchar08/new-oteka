'use client';

import { OptimisticCapture } from '@/components/vision/OptimisticCapture';
import { useRouter } from 'next/navigation';

export default function VisionPage() {
  const router = useRouter();

  const handleCapture = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob);

    // Call the pipeline
    const res = await fetch('/api/vision/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Analysis failed");
    }

    const data = await res.json();
    return {
      total_calories: data.summary?.calories,
      summary: data.summary?.name
    };
  };

  return (
    <div className="h-screen w-full bg-black">
      <OptimisticCapture onCapture={handleCapture} />
      
      {/* Back Button Overlay */}
      <button 
        onClick={() => router.back()}
        className="absolute top-12 left-6 z-20 text-white/80 font-medium text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md"
      >
        ← Back
      </button>
    </div>
  );
}
