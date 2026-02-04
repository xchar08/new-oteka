'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

    // 1. Try to fetch profile
    let { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    // 2. Self-Healing: Create if missing
    if (!profile && !fetchError) {
      // Sometimes .single() returns null data without error if no rows found (depending on config)
      // but usually it throws PGRST116. Let's assume consistent "no row" behavior.
    } 

    if (fetchError && fetchError.code === 'PGRST116') {
      console.log('Profile missing, creating default...');
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          display_name: authUser.email?.split('@')[0] || 'User',
          metabolic_state_json: { current_goal: 'maintenance' },
          hand_width_mm: 85, // Default average
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

    // 3. Populate Form
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
      // Refresh
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-24 text-zinc-100">
      <header className="mb-8 mt-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-zinc-400">Manage your metrics & settings</p>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-6 border-red-900 bg-red-950/50 text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* IDENTITY */}
        <Card className="border-zinc-800 bg-zinc-900/50 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-lg">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">User ID</Label>
              <div className="rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-500 break-all">
                {user?.id}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Display Name</Label>
              <Input disabled value={user?.display_name || ''} className="bg-zinc-950 border-zinc-800" />
            </div>
          </CardContent>
        </Card>

        {/* PHYSICS METRICS */}
        <Card className="border-zinc-800 bg-zinc-900/50 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-lg flex justify-between items-center">
              Physics Calibration
              <span className="text-xs font-normal text-amber-500 bg-amber-950/30 px-2 py-1 rounded">Critical for Vision</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Hand Width (mm)</Label>
              <Input 
                type="number" 
                value={handWidth} 
                onChange={(e) => setHandWidth(e.target.value)} 
                className="bg-zinc-950 border-zinc-800 text-white" 
              />
              <p className="text-xs text-zinc-500">Measure the width of your palm (excluding thumb) for accurate volumetric analysis.</p>
            </div>
          </CardContent>
        </Card>

        {/* METABOLIC GOALS */}
        <Card className="border-zinc-800 bg-zinc-900/50 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-lg">Metabolic Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Current Goal</Label>
              <select 
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="maintenance">Maintenance</option>
                <option value="fat_loss">Fat Loss</option>
                <option value="muscle_gain">Muscle Gain</option>
                <option value="longevity">Longevity / Anti-Aging</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ACTIONS */}
        <div className="flex gap-4">
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
          
          <Button 
            variant="outline" 
            className="flex-1 border-red-900/50 text-red-400 hover:bg-red-950 hover:text-red-300" 
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
