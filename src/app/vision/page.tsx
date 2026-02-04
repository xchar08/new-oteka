'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const OptimisticCapture = dynamic(() => import('@/components/vision/OptimisticCapture').then(m => m.OptimisticCapture), { ssr: false });

export default function VisionPage() {
  const router = useRouter();

  return (
    <div className="h-screen w-full bg-palenight-bg">
      <OptimisticCapture />
      <button
        onClick={() => router.back()}
        className="absolute top-12 left-6 z-20 text-white/80 font-medium text-sm bg-palenight-surface/40 px-3 py-1 rounded-full backdrop-blur-md border border-white/5"
      >
        ← Back
      </button>
    </div>
  );
}
