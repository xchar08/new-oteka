'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Check, HeartPulse, ShieldAlert, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Import conditions directly from our engine logic to ensure they always load
import conditionsData from '@/lib/engine/medical/conditions.json';

type Condition = {
  id: string;
  name: string;
  category: string;
  desc?: string;
};

export default function MedicalOnboardingPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>(conditionsData as Condition[]);
  const [loading, setLoading] = useState(false); // No longer loading from DB primarily
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // We can still try to sync with DB if needed, but we have the bundled fallback
    async function syncExisting() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('user_conditions')
            .select('condition_id')
            .eq('user_id', user.id);
        
        if (data && data.length > 0) {
            setSelected(data.map(d => d.condition_id));
        }
    }
    syncExisting();
  }, [supabase]);

  const toggleCondition = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 1. Wipe existing
          await supabase.from('user_conditions').delete().eq('user_id', user.id);
          
          // 2. Insert new
          if (selected.length > 0) {
            const payload = selected.map(cid => ({
              user_id: user.id,
              condition_id: cid
            }));
            await supabase.from('user_conditions').insert(payload);
          }
        }
        
        // Use a hard redirect if possible or router.push
        router.push('/onboarding/calibration');
    } catch (err) {
        console.error(err);
    } finally {
        setSaving(false);
    }
  };

  // Group conditions by category
  const grouped = conditions.reduce((acc: Record<string, Condition[]>, c) => {
    const cat = c.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-40 flex flex-col transition-colors duration-500">
      
      <div className="space-y-8">
        <header className="pt-safe space-y-2">
          <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6">
            <div className="w-2/3 h-full bg-[var(--primary)] rounded-full shadow-[0_0_10px_rgba(var(--ring),0.5)]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Health Profile</h1>
          <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed">
            Every selection updates the engine's metabolic safety rules and recommendation weighting.
          </p>
        </header>

        <div className="space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
                <section key={category} className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] ml-1 flex items-center gap-3">
                        <span className="w-2 h-[2px] bg-[var(--primary)] rounded-full" />
                        {category}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {items.map((c) => (
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                key={c.id}
                                onClick={() => toggleCondition(c.id)}
                                className={`p-5 rounded-3xl border text-left transition-all flex justify-between items-center ${
                                    selected.includes(c.id)
                                    ? 'bg-[var(--bg-surface-2)] border-[var(--primary)] shadow-lg ring-1 ring-[var(--primary)]'
                                    : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-surface-2)] shadow-sm'
                                }`}
                            >
                                <div className="flex-1 pr-6">
                                    <div className={`font-black text-sm uppercase tracking-tight ${selected.includes(c.id) ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                                        {c.name}
                                    </div>
                                    {c.desc && <div className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-bold leading-tight opacity-60">{c.desc}</div>}
                                </div>
                                
                                <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selected.includes(c.id) ? 'bg-[var(--primary)] border-[var(--primary)] shadow-[0_0_10px_rgba(var(--ring),0.3)]' : 'border-[var(--border)]'}`}>
                                    {selected.includes(c.id) && <Check size={14} strokeWidth={4} className="text-white" />}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[var(--bg-app)]/90 backdrop-blur-xl border-t border-[var(--border)] space-y-4 z-50">
        <div className="flex items-center justify-center gap-2">
            <ShieldAlert size={12} className="text-[var(--primary)]" />
            <p className="text-[9px] text-[var(--text-secondary)] text-center font-black uppercase tracking-[0.2em] opacity-40">
                Encrypted Metabolic Signature Active
            </p>
        </div>
        <Button 
          onClick={handleContinue} 
          disabled={saving}
          className="w-full h-16 bg-[var(--primary)] text-white hover:opacity-90 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          {saving ? 'Syncing...' : 'Finalize Constraints'} <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  );
}
