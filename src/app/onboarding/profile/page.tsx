'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Ruler, Weight, Calendar, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfileOnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    gender: 'female',
    height_cm: '',
    height_ft: '',
    height_in: '',
    weight_kg: '',
    weight_lb: '',
    goal: 'maintenance'
  });

  const supabase = createClient();
  const router = useRouter();

  const handleContinue = async () => {
    if (!formData.displayName || !formData.age) {
        alert("Please fill in basic fields");
        return;
    }

    let finalWeight = 0;
    let finalHeight = 0;

    if (units === 'metric') {
        finalWeight = Number(formData.weight_kg);
        finalHeight = Number(formData.height_cm);
    } else {
        // Imperial to Metric conversion for DB storage
        finalWeight = Number(formData.weight_lb) * 0.453592;
        finalHeight = (Number(formData.height_ft) * 30.48) + (Number(formData.height_in) * 2.54);
    }

    if (!finalWeight || !finalHeight) {
        alert("Please provide height and weight");
        return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: current } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
      const existing = current?.metabolic_state_json || {};

      const updatedState = {
          ...existing,
          age: parseInt(formData.age),
          gender: formData.gender,
          height_cm: Math.round(finalHeight),
          weight_kg: Math.round(finalWeight),
          units: units,
          current_goal: formData.goal,
          bmr: calculateBMR(finalWeight, finalHeight, parseInt(formData.age), formData.gender)
      };

      const { error: updateError } = await supabase.from('users').upsert({
          id: user.id,
          display_name: formData.displayName,
          metabolic_state_json: updatedState,
          updated_at: new Date().toISOString()
      });

      if (updateError) {
        alert("SAVE ERROR: " + updateError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push('/onboarding/medical');
  };

  // Mifflin-St Jeor
  const calculateBMR = (w: number, h: number, a: number, g: string) => {
      let bmr = (10 * w) + (6.25 * h) - (5 * a);
      if (g === 'male') bmr += 5;
      else bmr -= 161;
      return Math.round(bmr);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col animate-in fade-in duration-500 transition-colors">
      
      <div className="space-y-6 flex-1">
        <header className="pt-safe space-y-2">
            <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
                <div className="w-1/3 h-full bg-[var(--primary)] rounded-full" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Basic Info</h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium">Configure your biological baseline.</p>
        </header>

        <div className="space-y-5">
            {/* Unit Toggle */}
            <div className="flex p-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-sm">
                <button 
                    onClick={() => setUnits('metric')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${units === 'metric' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)]'}`}
                >
                    Metric (kg/cm)
                </button>
                <button 
                    onClick={() => setUnits('imperial')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${units === 'imperial' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)]'}`}
                >
                    Imperial (lb/ft)
                </button>
            </div>

            {/* NAME */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <User className="text-[var(--primary)]" size={20} />
                <div className="flex-1">
                    <label className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Display Name</label>
                    <input 
                        type="text" 
                        value={formData.displayName}
                        onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))}
                        className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-[var(--text-secondary)]/30"
                        placeholder="Your Name"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* GENDER */}
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex flex-col gap-2">
                    <label className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Gender</label>
                    <div className="flex gap-1">
                        {['female', 'male'].map(g => (
                            <button
                                key={g}
                                onClick={() => setFormData(p => ({ ...p, gender: g }))}
                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${formData.gender === g ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20' : 'text-[var(--text-secondary)] border border-transparent'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {/* AGE */}
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex flex-col">
                    <label className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Age</label>
                    <input 
                        type="number" 
                        value={formData.age}
                        onChange={e => setFormData(p => ({ ...p, age: e.target.value }))}
                        className="w-full bg-transparent text-lg font-bold outline-none"
                        placeholder="Years"
                    />
                </div>
            </div>

            {/* WEIGHT */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <Weight className="text-[var(--primary)]" size={20} />
                <div className="flex-1">
                    <label className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Weight ({units === 'metric' ? 'kg' : 'lb'})</label>
                    <input 
                        type="number" 
                        value={units === 'metric' ? formData.weight_kg : formData.weight_lb}
                        onChange={e => setFormData(p => ({ ...p, [units === 'metric' ? 'weight_kg' : 'weight_lb']: e.target.value }))}
                        className="w-full bg-transparent text-lg font-bold outline-none"
                        placeholder={units === 'metric' ? "0.0 kg" : "0.0 lb"}
                    />
                </div>
            </div>

            {/* HEIGHT */}
            <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-4">
                <Ruler className="text-[var(--primary)]" size={20} />
                <div className="flex-1">
                    <label className="text-[9px] text-[var(--text-secondary)] uppercase font-black tracking-widest">Height</label>
                    {units === 'metric' ? (
                        <input 
                            type="number" 
                            value={formData.height_cm}
                            onChange={e => setFormData(p => ({ ...p, height_cm: e.target.value }))}
                            className="w-full bg-transparent text-lg font-bold outline-none"
                            placeholder="0 cm"
                        />
                    ) : (
                        <div className="flex gap-4">
                            <input 
                                type="number" 
                                value={formData.height_ft}
                                onChange={e => setFormData(p => ({ ...p, height_ft: e.target.value }))}
                                className="w-20 bg-transparent text-lg font-bold outline-none border-b border-[var(--border)]"
                                placeholder="FT"
                            />
                            <input 
                                type="number" 
                                value={formData.height_in}
                                onChange={e => setFormData(p => ({ ...p, height_in: e.target.value }))}
                                className="w-20 bg-transparent text-lg font-bold outline-none border-b border-[var(--border)]"
                                placeholder="IN"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* GOAL */}
            <div className="space-y-3 pt-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Metabolic Goal</label>
                 <div className="grid grid-cols-3 gap-2">
                    {['lose', 'maintenance', 'gain'].map(g => (
                        <button
                            key={g}
                            onClick={() => setFormData(p => ({ ...p, goal: g }))}
                            className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                formData.goal === g 
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md' 
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
        className="w-full h-16 bg-[var(--primary)] text-white hover:opacity-90 rounded-[24px] font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 mt-8"
      >
        {loading ? 'Syncing Profile...' : 'Next Step'} <ChevronRight size={20} />
      </Button>
    </div>
  );
}
