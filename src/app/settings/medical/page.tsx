'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type Condition = {
  id: string;
  name: string;
  active: boolean;
};

export default function MedicalSettingsPage() {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
      // Remove
      await supabase.from('user_conditions').delete().match({ user_id: user.id, condition_id: id });
    } else {
      // Add
      await supabase.from('user_conditions').insert({ user_id: user.id, condition_id: id });
    }
  };

  return (
    <div className="min-h-screen bg-palenight-bg p-6 max-w-md mx-auto space-y-6 pb-24 text-zinc-100">
      <h1 className="text-2xl font-bold text-white">Medical Guardrails</h1>
      <p className="text-sm text-zinc-400">
        Select any active medical conditions. The AI Vision system will automatically check food logs against these constraints.
      </p>
      
      <div className="space-y-3">
        {loading && <div className="text-center py-4 text-zinc-500">Loading conditions...</div>}
        
        {!loading && conditions.length === 0 && (
          <div className="p-4 bg-palenight-surface rounded-xl border border-white/5 text-center text-sm text-zinc-400">
            No global conditions found in database.
          </div>
        )}

        {conditions.map((c) => (
          <div 
            key={c.id} 
            className={`
              flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer shadow-md
              ${c.active 
                ? 'bg-palenight-error/20 border-palenight-error/50' 
                : 'bg-palenight-surface border-white/5 hover:bg-palenight-bg'}
            `}
            onClick={() => toggleCondition(c.id, c.active)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${c.active ? 'bg-palenight-error border-palenight-error text-white' : 'border-zinc-700 bg-palenight-bg'}`}>
                {c.active && '✓'}
              </div>
              <span className={`font-medium ${c.active ? 'text-white' : 'text-zinc-300'}`}>
                {c.name}
              </span>
            </div>
            
            {c.active && <span className="text-[10px] bg-palenight-error text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
