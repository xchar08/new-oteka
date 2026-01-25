'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Camera, BookOpen, ShoppingCart, Plane } from 'lucide-react';
import { useConnectionMode } from '@/lib/hooks/useConnectionMode';
import { useAppStore } from '@/lib/state/appStore';
// Assuming NutrientRadar exists or we use a placeholder
import { NutrientRadar } from '@/components/viz/NutrientRadar';

export default function DashboardPage() {
  useConnectionMode(); // Init connection listener

  const [user, setUser] = useState<any>(null);
  const [advice, setAdvice] = useState<string>("Analyzing metabolic state...");
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { isOnline, lastSyncAt } = useAppStore(s => ({ 
    isOnline: s.isOnline, 
    lastSyncAt: s.lastSyncAt 
  }));

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      setUser(profile);

      // 2. Fetch Active Conditions (Medical Guardrails) - NEW
      const { data: conditionsData } = await supabase
        .from('user_conditions')
        .select('conditions(name)')
        .eq('user_id', authUser.id);
      
      setActiveConditions(conditionsData?.map((c: any) => c.conditions?.name).filter(Boolean) || []);
      
      // 3. Fetch Real AI Advice (Server-Side + Caching)
      try {
        if (navigator.onLine) {
          const res = await fetch('/api/advisor/context');
          if (res.ok) {
            const data = await res.json();
            setAdvice(data.advice || "Metabolic state nominal.");
          } else {
            setAdvice("Advisor unavailable (API Error)");
          }
        } else {
          setAdvice("Offline Mode: Using cached protocols.");
        }
      } catch (e) {
        setAdvice("Advisor offline.");
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Syncing Metabolic State...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header / Status Bar - Merged */}
      <header className="bg-white p-6 pb-8 rounded-b-3xl shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Good Morning</h1>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-gray-500 text-sm">Streak: {user?.streak_count || 0} Days</p>
               {!isOnline && (
                 <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-full">
                   OFFLINE
                 </span>
               )}
            </div>
          </div>
          <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold capitalize">
            {user?.metabolic_state_json?.current_goal || 'Maintenance'}
          </div>
        </div>

        {/* Agentic Advice Card */}
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl relative overflow-hidden">
          <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wide">Metabolic Advisor</div>
          <p className="text-indigo-900 text-sm font-medium leading-relaxed relative z-10">
            {advice}
          </p>
          {/* Decorative background element */}
          <div className="absolute right-0 bottom-0 opacity-5">
            <BookOpen size={64} />
          </div>
        </div>

        {/* Active Medical Conditions (Merged from v1) */}
        {activeConditions.length > 0 && (
           <div className="flex gap-2 flex-wrap mt-2">
             {activeConditions.map(c => (
               <span key={c} className="text-[10px] px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-md font-medium">
                 🛡️ {c} Check Active
               </span>
             ))}
           </div>
        )}
      </header>

      <main className="p-6 space-y-6">
        {/* Viz */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-sm font-semibold text-gray-700 mb-4">Nutrient Targeting</h3>
           {/* Fallback if component missing, else render */}
           {NutrientRadar ? (
             <NutrientRadar 
               macros={[
                 { label: 'Protein', current: 120, target: 180, color: 'bg-blue-500' },
                 { label: 'Carbs', current: 150, target: 250, color: 'bg-green-500' },
                 { label: 'Fats', current: 45, target: 70, color: 'bg-yellow-500' },
               ]} 
             />
           ) : (
             <div className="h-40 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-xs">Radar Placeholder</div>
           )}
        </div>

        {/* Quick Actions Grid */}
        <h3 className="font-semibold text-gray-700">Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/vision" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-95">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Camera size={20} />
            </div>
            <span className="font-medium text-sm">Vision Log</span>
          </Link>

          <Link href="/pantry" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-95">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <BookOpen size={20} />
            </div>
            <span className="font-medium text-sm">Pantry</span>
          </Link>

          <Link href="/shopping" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-95">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
              <ShoppingCart size={20} />
            </div>
            <span className="font-medium text-sm">Shopping</span>
          </Link>

          <Link href="/travel/menu" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-95">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <Plane size={20} />
            </div>
            <span className="font-medium text-sm">Travel Mode</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
