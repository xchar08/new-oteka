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
    <div className="p-6 max-w-md mx-auto space-y-6 pb-24">
      <h1 className="text-2xl font-bold">Medical Guardrails</h1>
      <p className="text-sm text-gray-500">
        Select any active medical conditions. The AI Vision system will automatically check food logs against these constraints.
      </p>
      
      <div className="space-y-3">
        {loading && <div className="text-center py-4 text-gray-400">Loading conditions...</div>}
        
        {!loading && conditions.length === 0 && (
          <div className="p-4 bg-gray-50 rounded border text-center text-sm">
            No global conditions found in database.
          </div>
        )}

        {conditions.map((c) => (
          <div 
            key={c.id} 
            className={`
              flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer
              ${c.active ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-gray-200'}
            `}
            onClick={() => toggleCondition(c.id, c.active)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded flex items-center justify-center border ${c.active ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'}`}>
                {c.active && '✓'}
              </div>
              <span className={`font-medium ${c.active ? 'text-red-900' : 'text-gray-700'}`}>
                {c.name}
              </span>
            </div>
            
            {c.active && <span className="text-xs text-red-600 font-semibold">ACTIVE</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
