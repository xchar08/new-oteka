'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Zap, Activity, Battery, Flame, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const [goal, setGoal] = useState('maintenance');
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const supabase = createClient();
  const router = useRouter();

  // Load existing settings
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
  }, [supabase]);

  const saveSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Merge with existing JSON
    const { data: existing } = await supabase.from('users').select('metabolic_state_json').eq('id', user.id).single();
    const newState = { ...existing?.metabolic_state_json, current_goal: goal };

    await supabase.from('users').update({ metabolic_state_json: newState }).eq('id', user.id);
    setLoading(false);
  };

  const strategies = [
      { id: 'fat_loss', label: 'Fat Loss', icon: <Flame className="h-5 w-5 text-orange-400" />, desc: 'High protein, caloric deficit prioritization.' },
      { id: 'muscle_gain', label: 'Hypertrophy', icon: <Zap className="h-5 w-5 text-yellow-400" />, desc: 'Surplus calories, carb timing for performance.' },
      { id: 'maintenance', label: 'Maintenance', icon: <Activity className="h-5 w-5 text-emerald-400" />, desc: 'Metabolic homeostasis and stability.' },
      { id: 'longevity', label: 'Longevity', icon: <Battery className="h-5 w-5 text-blue-400" />, desc: 'Autophagy optimization and nutrient density.' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 pb-32 flex flex-col gap-8 animate-in fade-in duration-500 transition-colors">
      
      {/* Header */}
      <header className="flex items-center gap-4 pt-safe">
        <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <div>
           <h1 className="text-3xl font-light tracking-tight mb-1">Configuration</h1>
           <p className="text-[var(--text-secondary)] text-sm">Tune the engine parameters.</p>
        </div>
      </header>
      
      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest px-1">Appearance</h2>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--bg-app)] text-[var(--text-primary)]">
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-xs text-[var(--text-secondary)]">
                   {theme === 'dark' ? 'Cosmic Theme active' : 'Clinical Theme active'}
                </div>
              </div>
           </div>
           
           <button 
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             className={`w-12 h-7 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[var(--primary)]' : 'bg-gray-200'}`}
           >
             <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
           </button>
        </div>
      </section>

      {/* Objective */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest px-1">Primary Objective</h2>
        
          <div className="grid grid-cols-1 gap-3">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setGoal(s.id)}
                className={`group relative p-5 rounded-2xl border text-left transition-all duration-300 ${
                  goal === s.id 
                    ? 'bg-[var(--bg-surface-2)] border-[var(--primary)] shadow-sm' 
                    : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-surface-2)]'
                }`}
              >
                <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] ${goal === s.id ? 'ring-1 ring-[var(--primary)]' : ''}`}>
                        {s.icon}
                    </div>
                    <div>
                        <div className={`font-medium text-lg transition-colors ${goal === s.id ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                            {s.label}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                            {s.desc}
                        </div>
                    </div>
                </div>
              </button>
            ))}
          </div>
          
          <Button 
            onClick={saveSettings} 
            disabled={loading} 
            className="w-full h-14 mt-6 bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 rounded-2xl font-semibold shadow-lg text-lg"
          >
            {loading ? 'Syncing...' : 'Update Context'}
          </Button>
      </section>
    </div>
  );
}
