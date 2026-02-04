'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const OptimisticCapture = dynamic(() => import('@/components/vision/OptimisticCapture').then(m => m.OptimisticCapture), { ssr: false });

export default function VisionPage() {
  const router = useRouter();

  return (
    <div className="h-screen w-full bg-black">
      <OptimisticCapture />
      <button
        onClick={() => router.back()}
        className="absolute top-12 left-6 z-20 text-white/80 font-medium text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-md"
      >
        ← Back
      </button>
    </div>
  );
}
