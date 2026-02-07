'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, User, Ruler, Activity, LogOut, ChevronRight } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [handWidth, setHandWidth] = useState<number | string>('');
  const [goal, setGoal] = useState('');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return router.push('/login');
    }

    let { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          display_name: authUser.email?.split('@')[0] || 'User',
          metabolic_state_json: { current_goal: 'maintenance' },
          hand_width_mm: 85, 
          streak_count: 0
        })
        .select()
        .single();
      
      if (createError) {
        setError('Failed to create profile: ' + createError.message);
        setLoading(false);
        return;
      }
      profile = newProfile;
    } else if (fetchError) {
       setError(fetchError.message);
       setLoading(false);
       return;
    }

    setUser(profile);
    setHandWidth(profile.hand_width_mm || '');
    setGoal(profile.metabolic_state_json?.current_goal || 'maintenance');
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        hand_width_mm: Number(handWidth),
        metabolic_state_json: { ...user.metabolic_state_json, current_goal: goal }
      })
      .eq('id', user.id);

    if (error) {
      setError('Failed to save: ' + error.message);
    } else {
      loadProfile();
    }
    setSaving(false);
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 text-zinc-100 flex flex-col gap-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex justify-between items-end pt-safe">
        <div>
           <h1 className="text-3xl font-light tracking-tight text-white mb-1">Profile</h1>
           <p className="text-zinc-500 text-sm">Manage your metabolic identity.</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="font-bold text-white text-lg">{user?.display_name?.[0].toUpperCase()}</span>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 text-red-200 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Physics Card */}
      <section className="space-y-3">
          <div className="flex items-center gap-2 text-zinc-400 px-1">
              <Ruler className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-medium">Calibration</span>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4">
               <div>
                  <Label className="text-zinc-400 text-xs mb-1.5 block">Hand Width (mm)</Label>
                  <div className="flex gap-3">
                      <Input 
                        type="number" 
                        value={handWidth} 
                        onChange={(e) => setHandWidth(e.target.value)} 
                        className="bg-black/20 border-white/10 text-white h-12 text-lg font-mono focus:border-emerald-500/50 focus:ring-emerald-500/20" 
                      />
                      <div className="w-12 flex items-center justify-center text-zinc-500 font-mono text-sm bg-white/5 rounded-md border border-white/5">
                          mm
                      </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                      *Used as the primary reference scale for all volumetric food analysis. Measure palm width excluding thumb.
                  </p>
               </div>
          </div>
      </section>

      {/* Metabolic Card */}
      <section className="space-y-3">
          <div className="flex items-center gap-2 text-zinc-400 px-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-medium">Metabolic Data</span>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                       <Label className="text-zinc-500 text-xs">Weight ({user?.metabolic_state_json?.units === 'imperial' ? 'lbs' : 'kg'})</Label>
                       <div className="h-10 border-b border-white/10 flex items-center text-white font-medium">
                           {user?.metabolic_state_json?.units === 'imperial' 
                              ? Math.round((user?.metabolic_state_json?.weight || 0) * 2.20462) 
                              : (user?.metabolic_state_json?.weight || '--')}
                       </div>
                  </div>
                  <div className="space-y-1.5">
                       <Label className="text-zinc-500 text-xs">Height ({user?.metabolic_state_json?.units === 'imperial' ? 'in' : 'cm'})</Label>
                       <div className="h-10 border-b border-white/10 flex items-center text-white font-medium">
                           {user?.metabolic_state_json?.units === 'imperial'
                              ? Math.round((user?.metabolic_state_json?.height || 0) / 2.54)
                              : (user?.metabolic_state_json?.height || '--')}
                       </div>
                  </div>
              </div>

               <div className="space-y-2 pt-2 border-t border-white/5">
                  <Label className="text-zinc-400 text-xs text-center w-full block">Current Protocol</Label>
                  <div className="relative">
                      <select 
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className="w-full h-12 appearance-none bg-black/20 border border-white/10 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="maintenance">Maintenance Phase</option>
                        <option value="fat_loss">Fat Loss Protocol</option>
                        <option value="muscle_gain">Hypertrophy Block</option>
                        <option value="longevity">Longevity / Anti-Aging</option>
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none rotate-90" />
                  </div>
              </div>
          </div>
      </section>

      {/* Actions */}
      <div className="mt-auto space-y-4">
          <Button 
            className="w-full h-14 bg-white text-black hover:bg-zinc-200 rounded-2xl font-semibold shadow-lg shadow-white/5 text-lg" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Save Changes"}
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full h-12 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl" 
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
      </div>

    </div>
  );
}
