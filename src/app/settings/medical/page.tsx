'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ShieldAlert, Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

type Condition = {
  id: string;
  name: string;
  active: boolean;
};

export default function MedicalSettingsPage() {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch available global conditions
      const { data: allConditions } = await supabase.from('conditions').select('id, name');

      // 2. Fetch user's active conditions
      const { data: userConditions } = await supabase
        .from('user_conditions')
        .select('condition_id')
        .eq('user_id', user.id);

      const activeIds = new Set(userConditions?.map((uc: any) => uc.condition_id));

      setConditions(allConditions?.map((c: any) => ({
        ...c,
        active: activeIds.has(c.id)
      })) || []);

      setLoading(false);
    }
    load();
  }, []);

  const toggleCondition = async (id: string, currentActive: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic UI
    setConditions(prev => prev.map(c => c.id === id ? { ...c, active: !currentActive } : c));

    if (currentActive) {
      await supabase.from('user_conditions').delete().match({ user_id: user.id, condition_id: id });
    } else {
      await supabase.from('user_conditions').insert({ user_id: user.id, condition_id: id });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 max-w-md mx-auto space-y-8 pb-24 transition-colors">
      <header className="flex items-center gap-4 pt-safe">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Medical Guardrails</h1>
          <p className="hud-label text-[var(--text-secondary)] opacity-50 mt-1">Safety Protocols</p>
        </div>
      </header>

      <div className="flex items-start gap-3 p-5 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
          <ShieldAlert size={18} />
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
          Select any active medical conditions. The AI Vision system automatically checks every food log against these constraints.
        </p>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-10 text-[var(--text-secondary)]">
            <Loader2 size={18} className="animate-spin text-[var(--primary)]" />
            <span className="hud-label">Loading conditions</span>
          </div>
        )}

        {!loading && conditions.length === 0 && (
          <div className="p-6 bg-[var(--bg-surface)] rounded-3xl border border-dashed border-[var(--border)] text-center text-sm text-[var(--text-secondary)]">
            No global conditions found in database.
          </div>
        )}

        {conditions.map((c) => (
          <motion.div
            key={c.id}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer ${
              c.active
                ? 'bg-[var(--error)]/10 border-[var(--error)]/40 shadow-sm'
                : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--primary)]/30 shadow-sm'
            }`}
            onClick={() => toggleCondition(c.id, c.active)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${
                c.active
                  ? 'bg-[var(--error)] border-[var(--error)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-app)]'
              }`}>
                {c.active && <Check size={14} strokeWidth={3.5} />}
              </div>
              <span className={`text-sm font-bold ${c.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {c.name}
              </span>
            </div>

            {c.active && (
              <span className="text-[9px] bg-[var(--error)] text-white px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                Active
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
