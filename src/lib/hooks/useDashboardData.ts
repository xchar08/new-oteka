'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { visionService } from '@/lib/services/vision.service';
import { useAppStore } from '@/lib/state/appStore';

export interface DashboardMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function useDashboardData() {
  const supabase = createClient();
  const isOnline = useAppStore((s) => s.isOnline);

  // 1. Fetch Profile
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      return data;
    },
  });

  // 2. Fetch Active Conditions
  const { data: activeConditions = [], isLoading: isConditionsLoading } = useQuery({
    queryKey: ['user-conditions'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];

      const { data } = await supabase
        .from('user_conditions')
        .select('conditions(name)')
        .eq('user_id', authUser.id);

      return data?.map((c: any) => c.conditions?.name).filter(Boolean) || [];
    },
    enabled: !!user,
  });

  // 3. Fetch Daily Macros via Vision Service
  const { data: dailyLogs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['daily-logs'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];
      return visionService.getDailyLogs(authUser.id);
    },
    enabled: !!user,
  });

  // Aggregate Macros from Logs
  const dailyMacros: DashboardMacros = dailyLogs.reduce((acc, log) => {
    const m = log.metabolic_tags_json || {};
    return {
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fats: acc.fats + (Number(m.fats) || 0),
    };
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

  // 4. Fetch AI Advice
  const { data: advice = 'Analyzing metabolic state...', isLoading: isAdviceLoading } = useQuery({
    queryKey: ['metabolic-advice'],
    queryFn: async () => {
      if (!navigator.onLine) return 'Offline Mode: Sync pending.';
      
      const { data, error } = await supabase.functions.invoke('advisor-context', {
        body: { context: 'dashboard' }
      });
      
      if (error) throw error;
      return data?.advice || 'Metabolic state nominal.';
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!user && isOnline,
  });

  // 5. Fetch Pantry Items
  const { data: pantryItems = [], isLoading: isPantryLoading } = useQuery({
    queryKey: ['pantry-items'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];

      const { data } = await supabase
        .from('pantry')
        .select('*, foods(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!user,
  });

  return {
    user,
    advice,
    activeConditions,
    dailyMacros,
    dailyLogs,
    pantryItems,
    loading: isUserLoading || isConditionsLoading || isLogsLoading || isPantryLoading,
    isOnline
  };
}
