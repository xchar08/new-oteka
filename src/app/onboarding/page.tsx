import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Ruler } from 'lucide-react';

export default function OnboardingIndex() {
  return (
    <div className="min-h-screen bg-palenight-bg p-8 flex flex-col justify-center items-center text-center space-y-8 text-zinc-100">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Setup Core
        </h1>
        <p className="text-zinc-400 text-lg max-w-xs mx-auto">
          Before we can estimate volume, we need to calibrate your physical reference.
        </p>
      </div>

      <div className="bg-palenight-surface p-6 rounded-2xl w-full max-w-xs flex flex-col items-center gap-4 border border-white/5 shadow-xl">
        <div className="w-16 h-16 bg-palenight-accent/20 rounded-full flex items-center justify-center text-palenight-accent">
          <Ruler size={32} />
        </div>
        <div className="font-semibold text-white">Hand Calibration</div>
        <p className="text-sm text-zinc-400">
          We use your hand width as a reference scale for food volume.
        </p>
      </div>

      <Link href="/onboarding/metrics" className="w-full max-w-xs">
        <Button className="w-full h-12 text-lg gap-2">
          Start Calibration <ArrowRight size={18} />
        </Button>
      </Link>
    </div>
  );
}
