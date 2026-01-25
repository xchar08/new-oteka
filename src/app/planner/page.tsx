'use client';

import { useState } from 'react';
import { runOptimization } from '@/lib/engine/planner/worker';
import { PlannerControls, PlannerConstraints } from '@/components/planner/PlannerControls';
import { createClient } from '@/lib/supabase/client';

export default function PlannerPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const supabase = createClient();

  const handleRun = async (constraints: PlannerConstraints) => {
    setLoading(true);
    setStatus('Loading Pantry...');
    
    // 1. Get real inventory
    const { data: items } = await supabase.from('pantry').select('*, foods(*)').eq('status', 'active');
    
    // 2. Offload to Web Worker
    setStatus('Optimizing (NSGA-II)...');
    try {
      const result = await runOptimization({
        constraints: {
          ...constraints,
          calories_min: 0,
          excluded_ingredients: []
        },
        pantry_items: items || []
      });

      if (result.retries_used > 0) {
        setStatus(`Solved with relaxed constraints (Retries: ${result.retries_used})`);
      } else {
        setStatus('Optimal solution found.');
      }
      setPlans(result.solutions);
      
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Metabolic Planner</h1>
      <PlannerControls onRun={handleRun} />
      
      <div className="mt-6">
        {loading && <div className="text-blue-600 animate-pulse">{status}</div>}
        {!loading && status && <div className="text-sm text-gray-500 mb-2">{status}</div>}
        
        <div className="space-y-3">
          {plans.map((plan, i) => (
            <div key={i} className="border p-3 rounded bg-green-50">
              <h3 className="font-bold">Option {i + 1}</h3>
              <div className="text-sm mt-1">
                {plan.menu.join(' + ')}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                {plan.stats.calories} kcal
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
