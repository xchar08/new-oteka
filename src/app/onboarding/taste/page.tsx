'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronRight, LogOut, Utensils } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { userService } from '@/lib/services/user.service';

export default function TasteOnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [taste, setTaste] = useState({
    sweet: 50,
    bitter: 50,
    sour: 50,
    umami: 50
  });

  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleContinue = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      try {
        await userService.updateTasteProfile(user.id, {
          sweet: taste.sweet / 100,
          bitter: taste.bitter / 100,
          sour: taste.sour / 100,
          umami: taste.umami / 100,
          confidence: 1 // Start with confidence 1 so the optimizer uses it
        });
      } catch (err: any) {
        alert("TASTE PROFILE ERROR: " + err.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push('/dashboard');
  };

  const handleUpdate = (key: keyof typeof taste, val: number) => {
    setTaste(p => ({ ...p, [key]: val }));
  };

  const renderSlider = (key: keyof typeof taste, label: string, leftLabel: string, rightLabel: string, colorClass: string) => (
    <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border)] flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-black tracking-tight text-[var(--text-primary)] capitalize">{label}</label>
        <div className="text-[10px] font-bold text-[var(--text-secondary)] tabular-nums px-2 py-0.5 bg-[var(--bg-app)] rounded-md border border-[var(--border)]">
          {taste[key]}%
        </div>
      </div>
      <div className="w-full space-y-3 mt-1">
        <Slider
          min={0}
          max={100}
          step={5}
          value={[taste[key]]}
          onValueChange={(val: number[]) => handleUpdate(key, val[0])}
          className={`w-full ${colorClass}`}
        />
        <div className="flex justify-between text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col animate-in fade-in duration-500">
      
      <div className="space-y-6 flex-1">
        <header className="pt-safe space-y-2">
          <div className="flex justify-between items-center mb-6">
            <div className="w-12 h-1 bg-[var(--border)] rounded-full">
              <div className="w-full h-full bg-[var(--primary)] rounded-full" />
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all py-1.5 px-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-sm"
            >
              <LogOut size={11} />
              Sign Out
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Utensils size={20} />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Taste Profile</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm font-medium mt-2">
            Fine-tune the neural optimizer's food recommendations to your exact palate. We use a FART-derived chemical language model to match your preferences.
          </p>
        </header>

        <div className="space-y-4 pt-2">
          {renderSlider('umami', 'Umami / Savory', 'Avoid', 'Love', 'accent-orange-500')}
          {renderSlider('sweet', 'Sweet', 'Avoid', 'Love', 'accent-pink-500')}
          {renderSlider('sour', 'Sour / Acidic', 'Avoid', 'Love', 'accent-yellow-500')}
          {renderSlider('bitter', 'Bitter', 'Avoid', 'Love', 'accent-green-500')}
        </div>
      </div>

      <Button 
        onClick={handleContinue} 
        disabled={loading}
        className="w-full h-16 bg-[var(--primary)] text-white hover:opacity-90 rounded-[24px] font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 mt-8"
      >
        {loading ? 'Finalizing Setup...' : 'Complete Setup'} <ChevronRight size={20} />
      </Button>
    </div>
  );
}
