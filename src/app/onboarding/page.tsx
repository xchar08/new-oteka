import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity } from 'lucide-react';

export default function OnboardingIndex() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-8 flex flex-col justify-center items-center text-center space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Metabolic Setup
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-xs mx-auto">
          Configure the core engine for your biological and physical parameters.
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl w-full max-w-xs flex flex-col items-center gap-4 border border-[var(--border)] shadow-xl">
        <div className="w-16 h-16 bg-[var(--bg-app)] rounded-full flex items-center justify-center text-[var(--primary)] shadow-inner">
          <Activity size={32} />
        </div>
        <div className="font-semibold">Health Profile</div>
        <p className="text-sm text-[var(--text-secondary)]">
          We need to know about any conditions to ensure safety constraints are active.
        </p>
      </div>

      <Link href="/onboarding/profile" className="w-full max-w-xs">
        <Button className="w-full h-12 text-lg gap-2 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-xl shadow-lg font-bold">
          Start Setup <ArrowRight size={18} />
        </Button>
      </Link>
    </div>
  );
}
