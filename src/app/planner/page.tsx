'use client';

import { useState } from 'react';
import { runOptimization } from '@/lib/engine/planner/worker';
import { PlannerControls, PlannerConstraints } from '@/components/planner/PlannerControls';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

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

      // 1. Get real inventory
      const { data: items } = await supabase
        .from('pantry')
        .select('*, foods(*)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      // 2. Get User Profile & Metrics
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (!profile) throw new Error("Please complete your profile first.");

      // 3. Get Conditions
      const { data: conditions } = await supabase
        .from('user_conditions')
        .select('*, conditions(*)')
        .eq('user_id', user.id);

      const activeConditions = conditions?.map(c => c.conditions) || [];

      // 4. Offload to Web Worker
      setStatus('Optimizing (NSGA-II)...');
      
      const result = await runOptimization({
        pantry_items: items || [],
        user_profile: profile,
        conditions: activeConditions,
        constraints: {
          ...constraints,
          calories_min: 0, // Could be derived from BMR in profile if I added BMR calc
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
    <div className="p-4 max-w-lg mx-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Metabolic Planner</h1>
        <p className="text-sm text-zinc-500">AI-driven meal compositions</p>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PlannerControls onRun={handleRun} />
      
      <div className="mt-8">
        {loading && (
          <div className="flex items-center justify-center p-8 text-blue-600 space-x-2">
             <Loader2 className="h-5 w-5 animate-spin" />
             <span className="animate-pulse">{status}</span>
          </div>
        )}
        
        {!loading && status && !error && (
           <div className="text-sm text-emerald-600 mb-4 font-medium flex items-center">
             ✓ {status}
           </div>
        )}
        
        <div className="space-y-4">
          {plans.map((plan, i) => (
            <div key={i} className="border border-white/5 p-4 rounded-xl bg-palenight-surface shadow-lg hover:brightness-110 transition-all text-zinc-100">
              <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-lg">Option {i + 1}</h3>
                  <span className="bg-palenight-bg text-zinc-400 text-xs px-2 py-1 rounded-full font-mono">
                    {plan.stats.calories} kcal
                 </span>
              </div>
              
              <div className="text-sm text-zinc-700 space-y-1">
                {plan.menu.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2" />
                    {item}
                  </div>
                ))}
              </div>
              
              {/* Debug info to show we used the profile */}
              {plan.personalized_note && (
                 <div className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    {plan.personalized_note}
                 </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
