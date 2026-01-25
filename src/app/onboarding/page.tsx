import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Ruler } from 'lucide-react';

export default function OnboardingIndex() {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col justify-center items-center text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
          Setup Core
        </h1>
        <p className="text-gray-500 text-lg max-w-xs mx-auto">
          Before we can estimate volume, we need to calibrate your physical reference.
        </p>
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl w-full max-w-xs flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
          <Ruler size={32} />
        </div>
        <div className="font-semibold text-blue-900">Hand Calibration</div>
        <p className="text-sm text-blue-700">
          We use your hand width as a reference scale for food volume.
        </p>
      </div>

      <Link href="/onboarding/calibration" className="w-full max-w-xs">
        <Button className="w-full h-12 text-lg gap-2">
          Start Calibration <ArrowRight size={18} />
        </Button>
      </Link>
    </div>
  );
}
