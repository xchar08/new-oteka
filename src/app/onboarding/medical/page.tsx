'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Condition = {
  id: string;
  name: string;
  category: string;
  desc?: string;
};

// Fallback data if DB is empty
const FALLBACK_CONDITIONS: Condition[] = [
  { id: 'type-1-diabetes', name: 'Type 1 Diabetes', category: 'Medical', desc: 'Insulin-dependent glucose management.' },
  { id: 'type-2-diabetes', name: 'Type 2 Diabetes', category: 'Medical', desc: 'Insulin resistance & carb sensitivity.' },
  { id: 'celiac', name: 'Celiac Disease', category: 'Autoimmune', desc: 'Strict gluten-free requirement.' },
  { id: 'ibs', name: 'IBS (Low FODMAP)', category: 'Digestive', desc: 'Sensitivity to fermentable carbs.' },
  { id: 'keto-strict', name: 'Strict Keto', category: 'Dietary', desc: '<20g net carbs per day.' },
  { id: 'vegan', name: 'Vegan', category: 'Dietary', desc: 'No animal products.' },
];

export default function MedicalOnboardingPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>(FALLBACK_CONDITIONS);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Load conditions from DB (optional enhancement)
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('conditions').select('*');
      if (data && data.length > 0) {
        setConditions(data);
      }
    }
    load();
  }, [supabase]);

  const toggleCondition = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Clear old conditions first (simple logic for now)
      await supabase.from('user_conditions').delete().eq('user_id', user.id);

      if (selected.length > 0) {
        const payload = selected.map(cid => ({
          user_id: user.id,
          condition_id: cid
        }));
        await supabase.from('user_conditions').insert(payload);
      }
    }

    setLoading(false);
    router.push('/onboarding/calibration');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col justify-between animate-in fade-in duration-500">
      
      <div className="space-y-6">
        <header className="pt-safe space-y-2">
          <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
            <div className="w-1/3 h-full bg-[var(--primary)] rounded-full" />
          </div>
          <h1 className="text-3xl font-light tracking-tight">Health Profile</h1>
          <p className="text-[var(--text-secondary)]">
            Select any conditions so the metabolic engine can adapt your safety constraints.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3">
          {conditions.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCondition(c.id)}
              className={`p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center ${
                selected.includes(c.id)
                  ? 'bg-[var(--bg-surface-2)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-surface-2)]'
              }`}
            >
              <div>
                <div className={`font-medium ${selected.includes(c.id) ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                    {c.name}
                </div>
                {c.desc && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{c.desc}</div>}
              </div>
              
              {selected.includes(c.id) && (
                <div className="bg-[var(--primary)] text-white p-1 rounded-full">
                    <Check size={14} strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)] text-center">
          Information is encrypted and used solely for metabolic safety rules.
        </p>
        <Button 
          onClick={handleContinue} 
          disabled={loading}
          className="w-full h-14 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-2xl font-semibold shadow-lg text-lg flex items-center justify-center gap-2"
        >
          {loading ? 'Saving...' : 'Continue'} <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  );
}
