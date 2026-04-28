'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Check, Activity, ShieldAlert, HeartPulse } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type Condition = {
  id: string;
  name: string;
  category: string;
  desc?: string;
};

export default function MedicalOnboardingPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('conditions')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (data) setConditions(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const toggleCondition = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from('user_conditions').delete().eq('user_id', user.id);
      if (selected.length > 0) {
        const payload = selected.map(cid => ({
          user_id: user.id,
          condition_id: cid
        }));
        await supabase.from('user_conditions').insert(payload);
      }
    }

    setSaving(false);
    router.push('/onboarding/calibration');
  };

  // Group conditions by category
  const grouped = conditions.reduce((acc: Record<string, Condition[]>, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-40 flex flex-col transition-colors duration-500">
      
      <div className="space-y-8">
        <header className="pt-safe space-y-2">
          <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
            <div className="w-2/3 h-full bg-[var(--primary)] rounded-full" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Health Profile</h1>
          <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed">
            Every selection updates the engine's metabolic safety rules and recommendation weighting.
          </p>
        </header>

        {Object.entries(grouped).length === 0 ? (
            <div className="py-20 text-center bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-[32px]">
                <HeartPulse className="mx-auto h-10 w-10 text-[var(--text-secondary)] opacity-20 mb-4" />
                <p className="text-[var(--text-secondary)] font-medium">No system constraints defined.</p>
                <button onClick={handleContinue} className="mt-4 text-[var(--primary)] text-xs font-black uppercase tracking-widest">Skip Step</button>
            </div>
        ) : (
            <div className="space-y-8">
                {Object.entries(grouped).map(([category, items]) => (
                    <section key={category} className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-[var(--primary)]" />
                           {category}
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {items.map((c) => (
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    key={c.id}
                                    onClick={() => toggleCondition(c.id)}
                                    className={`p-4 rounded-2xl border text-left transition-all flex justify-between items-center ${
                                        selected.includes(c.id)
                                        ? 'bg-[var(--bg-surface-2)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]'
                                        : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-surface-2)] shadow-sm'
                                    }`}
                                >
                                    <div className="flex-1 pr-4">
                                        <div className={`font-black text-sm uppercase tracking-tight ${selected.includes(c.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                                            {c.name}
                                        </div>
                                        {c.desc && <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-bold leading-tight opacity-70">{c.desc}</div>}
                                    </div>
                                    
                                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${selected.includes(c.id) ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                                        {selected.includes(c.id) && <Check size={12} strokeWidth={4} className="text-white" />}
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[var(--bg-app)]/80 backdrop-blur-xl border-t border-[var(--border)] space-y-4">
        <p className="text-[9px] text-[var(--text-secondary)] text-center font-black uppercase tracking-widest opacity-40">
           Sovereign Data Encryption Active
        </p>
        <Button 
          onClick={handleContinue} 
          disabled={saving}
          className="w-full h-14 bg-[var(--primary)] text-white hover:opacity-90 rounded-[24px] font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2"
        >
          {saving ? 'Syncing Profile...' : 'Finalize Constraints'} <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
