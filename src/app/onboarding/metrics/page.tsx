'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';

export default function OnboardingMetrics() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [goal, setGoal] = useState('maintenance');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleNext = async () => {
    if (!weight || !height || !age) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase
            .from('users')
            .update({
                metabolic_state_json: {
                    weight: Number(weight),
                    height: Number(height),
                    age: Number(age),
                    gender,
                    current_goal: goal,
                    units: 'metric' // Defaulting to metric for now
                }
            })
            .eq('id', user.id);
    }
    
    setLoading(false);
    router.push('/onboarding/calibration');
  };

  return (
    <div className="min-h-screen bg-palenight-bg p-8 flex flex-col justify-center text-zinc-100 animate-in fade-in duration-500">
      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Your Metrics</h1>
            <p className="text-zinc-400">To calculate your metabolic needs accurately.</p>
        </div>

        <div className="space-y-4 bg-palenight-surface p-6 rounded-2xl border border-white/5 shadow-xl">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="bg-palenight-bg border-white/10" placeholder="70" />
                </div>
                <div className="space-y-2">
                    <Label>Height (cm)</Label>
                    <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="bg-palenight-bg border-white/10" placeholder="175" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Age</Label>
                    <Input type="number" value={age} onChange={e => setAge(e.target.value)} className="bg-palenight-bg border-white/10" placeholder="25" />
                </div>
                <div className="space-y-2">
                    <Label>Gender</Label>
                     <select 
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full h-10 rounded-md border border-white/10 bg-palenight-bg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                </div>
            </div>

             <div className="space-y-2 pt-2">
                  <Label>Current Goal</Label>
                  <select 
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full h-10 rounded-md border border-white/10 bg-palenight-bg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="fat_loss">Fat Loss</option>
                    <option value="muscle_gain">Muscle Gain</option>
                    <option value="longevity">Longevity</option>
                  </select>
            </div>
        </div>

        <Button 
            className="w-full h-12 text-lg" 
            onClick={handleNext} 
            disabled={loading || !weight || !height || !age}
        >
            {loading ? <Loader2 className="animate-spin" /> : <>Next Step <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}
