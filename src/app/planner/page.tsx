'use client';

import { useState } from 'react';
import { runOptimization } from '@/lib/engine/planner/worker';
import { PlannerControls, PlannerConstraints } from '@/components/planner/PlannerControls';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChefHat, Sparkles, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function PlannerPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  const router = useRouter();

  const handleRun = async (constraints: PlannerConstraints) => {
    setLoading(true);
    setStatus('Analyzing Metabolism...');
    setError(null);
    setPlans([]);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let items, profile, conditions;

      const { data: _items } = await supabase
        .from('pantry')
        .select('*, foods(*)')
        .eq('user_id', user.id)
        .eq('status', 'active');
      items = _items;

      const { data: _profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      profile = _profile;

      const { data: _conditions } = await supabase
        .from('user_conditions')
        .select('*, conditions(*)')
        .eq('user_id', user.id);
      conditions = _conditions;
        
      if (!profile) throw new Error("Please complete your profile first.");

      const activeConditions = conditions?.map((c: any) => c.conditions) || [];

      setStatus('Optimizing Nutrients...');
      
      const result = await runOptimization({
        pantry_items: items || [],
        user_profile: profile,
        conditions: activeConditions,
        constraints: {
          ...constraints,
          calories_min: 0, 
          excluded_ingredients: []
        }
      });

      setPlans((result as any).solutions);
      setStatus(plans.length > 0 ? 'Optimal compositions found.' : '');
      
    } catch (err: any) {
      setError(err.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col gap-6 animate-in fade-in duration-500">
      <header className="flex items-center gap-4 pt-safe">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-light tracking-tight mb-1">Planner</h1>
           <p className="text-[var(--text-secondary)] text-sm">AI Compositions</p>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-600 rounded-2xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-[var(--bg-surface)] p-2 rounded-[32px] border border-[var(--border)] shadow-sm">
        <PlannerControls onRun={handleRun} />
      </div>
      
      <div className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 text-[var(--text-secondary)]">
             <div className="h-16 w-16 rounded-3xl bg-[var(--primary)]/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
             </div>
             <span className="text-xs font-bold uppercase tracking-widest">{status}</span>
          </div>
        )}
        
        <div className="space-y-4">
          {plans.map((plan, i) => (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="group relative border border-[var(--border)] p-6 rounded-[32px] bg-[var(--bg-surface)] overflow-hidden shadow-sm active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-6 relative z-10">
                 <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                         <span className="font-black text-sm">{String.fromCharCode(65 + i)}</span>
                     </div>
                     <h3 className="font-black text-[var(--text-primary)]">Composition {i + 1}</h3>
                 </div>
                 <span className="bg-[var(--bg-app)] text-[var(--primary)] text-xs px-4 py-1.5 rounded-full font-bold border border-[var(--border)]">
                    {plan.stats.calories} kcal
                 </span>
              </div>
              
              <div className="space-y-4 relative z-10 mb-6">
                {plan.menu.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 group/item">
                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full group-hover/item:scale-150 transition-transform" />
                    <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{item}</span>
                  </div>
                ))}
              </div>
              
              {plan.personalized_note && (
                 <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-app)] p-4 rounded-2xl border border-[var(--border)] leading-relaxed relative z-10 italic">
                    <div className="flex items-center gap-2 mb-2 not-italic">
                        <Sparkles size={12} className="text-[var(--primary)]" />
                        <span className="font-bold uppercase tracking-widest text-[9px] text-[var(--primary)]">Metabolic Advisor</span>
                    </div>
                    "{plan.personalized_note}"
                 </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
