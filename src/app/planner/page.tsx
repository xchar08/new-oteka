'use client';

import { useState } from 'react';
import { runOptimization } from '@/lib/engine/planner/worker';
import { PlannerControls, PlannerConstraints } from '@/components/planner/PlannerControls';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChefHat, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PlannerPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleRun = async (constraints: PlannerConstraints) => {
    setLoading(true);
    setStatus('Fetching Profile & Pantry...');
    setError(null);
    setPlans([]);
    
    try {
      // 0. Auth Check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let items, profile, conditions;

      if (navigator.onLine) {
          // ONLINE: Fetch & Cache
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

          // Save to Cache
          localStorage.setItem('planner_cache_items', JSON.stringify(items));
          localStorage.setItem('planner_cache_profile', JSON.stringify(profile));
          localStorage.setItem('planner_cache_conditions', JSON.stringify(conditions));
      } else {
          // OFFLINE: Read from Cache
          setStatus('Offline Mode: Loading cached inventory...');
          const cItems = localStorage.getItem('planner_cache_items');
          const cProfile = localStorage.getItem('planner_cache_profile');
          const cConditions = localStorage.getItem('planner_cache_conditions');

          if (!cItems || !cProfile) {
              throw new Error("No offline data available. Please connect once to sync.");
          }

          items = JSON.parse(cItems);
          profile = JSON.parse(cProfile);
          conditions = JSON.parse(cConditions || '[]');
      }
        
      if (!profile) throw new Error("Please complete your profile first.");

      const activeConditions = conditions?.map((c: any) => c.conditions) || [];

      // 4. Offload to Web Worker
      setStatus('Optimizing (NSGA-II)...');
      
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

      if ((result as any).retries_used > 0) {
        setStatus(`Solved with relaxed constraints (Retries: ${(result as any).retries_used})`);
      } else {
        setStatus('Optimal solution found.');
      }
      setPlans((result as any).solutions);
      
    } catch (err: any) {
      setError(err.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100 flex flex-col gap-6 animate-in fade-in duration-500">
      <header className="pt-safe">
        <h1 className="text-3xl font-light tracking-tight text-white mb-1">Planner</h1>
        <p className="text-zinc-500 text-sm">AI-driven meal compositions</p>
      </header>

      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PlannerControls onRun={handleRun} />
      
      <div className="space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 text-zinc-500 animate-pulse">
             <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
             </div>
             <span className="text-xs font-mono uppercase tracking-widest">{status}</span>
          </div>
        )}
        
        {!loading && status && !error && (
           <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
             <Sparkles size={16} />
             {status}
           </div>
        )}
        
        <div className="space-y-4">
          {plans.map((plan, i) => (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="group relative border border-white/5 p-5 rounded-2xl bg-white/5 backdrop-blur-md overflow-hidden hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {/* Decorative Blur */}
              <div className="absolute -right-10 -top-10 h-32 w-32 bg-blue-500/20 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-500/30 transition-colors" />

              <div className="flex justify-between items-start mb-4 relative z-10">
                 <div className="flex items-center gap-2">
                     <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                         <span className="font-bold text-xs">{i + 1}</span>
                     </div>
                     <h3 className="font-bold text-zinc-200">Option {String.fromCharCode(65 + i)}</h3>
                 </div>
                 <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full font-mono border border-white/10">
                    {plan.stats.calories} kcal
                 </span>
              </div>
              
              <div className="space-y-3 relative z-10">
                {plan.menu.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_var(--primary)]" />
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{item}</span>
                  </div>
                ))}
              </div>
              
              {/* Personalized Note */}
              {plan.personalized_note && (
                 <div className="mt-4 text-xs text-amber-400/90 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed relative z-10">
                    <span className="font-bold block mb-1 uppercase tracking-wider text-[10px] text-amber-500">Advisor Note</span>
                    {plan.personalized_note}
                 </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
