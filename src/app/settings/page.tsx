'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function SettingsPage() {
  const [goal, setGoal] = useState('maintenance');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
      if (data?.metabolic_state_json?.current_goal) {
        setGoal(data.metabolic_state_json.current_goal);
      }
    }
    load();
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Merge with existing JSON
    const { data: existing } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
    const newState = { ...existing?.metabolic_state_json, current_goal: goal };

    await supabase.from('users').update({ metabolic_state_json: newState }).eq('id', user.id);
    setLoading(false);
    alert('Metabolic Profile Updated');
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Metabolic Config</h1>
      
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-lg">Current Goal</h2>
          <p className="text-sm text-gray-500">Guides the AI Advisor & Planner</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {['cutting', 'bulking', 'maintenance'].map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  goal === g 
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-bold capitalize">{g}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {g === 'cutting' && 'Prioritize protein, deficit volume.'}
                  {g === 'bulking' && 'Surplus optimization, carb timing.'}
                  {g === 'maintenance' && 'Homeostasis & energy stability.'}
                </div>
              </button>
            ))}
          </div>
          
          <Button onClick={saveSettings} disabled={loading} className="w-full mt-4">
            {loading ? 'Syncing...' : 'Update Context'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
