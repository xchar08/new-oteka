'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Ruler, Weight, Calendar, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfileOnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    age: '',
    gender: 'female',
    height_cm: '',
    weight_kg: '',
    goal: 'maintenance'
  });

  const supabase = createClient();
  const router = useRouter();

  const handleContinue = async () => {
    if (!formData.age || !formData.height_cm || !formData.weight_kg) {
        alert("Please fill in all fields");
        return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Fetch existing JSON to merge
      const { data: current } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
      const existing = current?.metabolic_state_json || {};

      const updatedState = {
          ...existing,
          age: parseInt(formData.age),
          gender: formData.gender,
          height_cm: parseInt(formData.height_cm),
          weight_kg: parseInt(formData.weight_kg),
          current_goal: formData.goal,
          bmr: calculateBMR(
              parseInt(formData.weight_kg), 
              parseInt(formData.height_cm), 
              parseInt(formData.age), 
              formData.gender
          )
      };

      await supabase.from('users').update({
          metabolic_state_json: updatedState
      }).eq('id', user.id);
    }

    setLoading(false);
    router.push('/onboarding/medical');
  };

  // Simple Mifflin-St Jeor Equation
  const calculateBMR = (w: number, h: number, a: number, g: string) => {
      let bmr = (10 * w) + (6.25 * h) - (5 * a);
      if (g === 'male') bmr += 5;
      else bmr -= 161;
      return Math.round(bmr);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col animate-in fade-in duration-500">
      
      <div className="space-y-6 flex-1">
        <header className="pt-safe space-y-2">
            <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
                <div className="w-1/3 h-full bg-[var(--primary)] rounded-full" />
            </div>
            <h1 className="text-3xl font-light tracking-tight">Basic Info</h1>
            <p className="text-[var(--text-secondary)]">
                We use these metrics to calculate your metabolic baseline (BMR).
            </p>
        </header>

        <div className="space-y-5">
            {/* GENDER */}
            <div className="grid grid-cols-2 gap-3">
                {['female', 'male'].map(g => (
                    <button
                        key={g}
                        onClick={() => setFormData(p => ({ ...p, gender: g }))}
                        className={`p-4 rounded-xl border text-center capitalize font-medium transition-all ${
                            formData.gender === g 
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]' 
                            : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                    >
                        {g}
                    </button>
                ))}
            </div>

            {/* AGE */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <Calendar className="text-[var(--text-secondary)]" />
                <div className="flex-1">
                    <label className="text-xs text-[var(--text-secondary)] uppercase font-bold">Age</label>
                    <input 
                        type="number" 
                        value={formData.age}
                        onChange={e => setFormData(p => ({ ...p, age: e.target.value }))}
                        className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-[var(--text-secondary)]/50"
                        placeholder="Years"
                    />
                </div>
            </div>

            {/* HEIGHT */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <Ruler className="text-[var(--text-secondary)]" />
                <div className="flex-1">
                    <label className="text-xs text-[var(--text-secondary)] uppercase font-bold">Height (cm)</label>
                    <input 
                        type="number" 
                        value={formData.height_cm}
                        onChange={e => setFormData(p => ({ ...p, height_cm: e.target.value }))}
                        className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-[var(--text-secondary)]/50"
                        placeholder="cm"
                    />
                </div>
            </div>

            {/* WEIGHT */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <Weight className="text-[var(--text-secondary)]" />
                <div className="flex-1">
                    <label className="text-xs text-[var(--text-secondary)] uppercase font-bold">Weight (kg)</label>
                    <input 
                        type="number" 
                        value={formData.weight_kg}
                        onChange={e => setFormData(p => ({ ...p, weight_kg: e.target.value }))}
                        className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-[var(--text-secondary)]/50"
                        placeholder="kg"
                    />
                </div>
            </div>

            {/* GOAL */}
            <div className="space-y-2 pt-4">
                 <label className="text-sm font-medium text-[var(--text-secondary)] ml-1">Current Goal</label>
                 <div className="grid grid-cols-3 gap-2">
                    {['lose', 'maintenance', 'gain'].map(g => (
                        <button
                            key={g}
                            onClick={() => setFormData(p => ({ ...p, goal: g }))}
                            className={`p-3 rounded-xl border text-center capitalize text-sm font-medium transition-all ${
                                formData.goal === g 
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)]' 
                                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <Button 
        onClick={handleContinue} 
        disabled={loading}
        className="w-full h-14 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-2xl font-semibold shadow-lg text-lg flex items-center justify-center gap-2 mt-8"
      >
        {loading ? 'Saving...' : 'Next Step'} <ChevronRight size={20} />
      </Button>
    </div>
  );
}
