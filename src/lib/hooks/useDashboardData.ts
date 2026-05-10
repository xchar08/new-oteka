'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { visionService } from '@/lib/services/vision.service';
import { useAppStore } from '@/lib/state/appStore';
import { normalizeError } from '@/lib/utils/errors';
import { aggregateNutrients } from '@/lib/utils/metabolic.utils';
import { STORAGE_KEYS } from '@/lib/utils/storage';
import type { DashboardMacros, LogEntry } from '@/lib/types/metabolic';

export type { DashboardMacros };

export function useDashboardData() {
  const supabase = createClient();
  const isOnline = useAppStore((s) => s.isOnline);
  const queryClient = useQueryClient();

  // 0. Fetch Auth User
  const { data: authUser, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // 1. Fetch Profile
  const setPlan = useAppStore((s) => s.setPlan);

  // TRIGGER ENTROPY CYCLE (Free Tier Cron Alternative)
  // Optimization: Throttled by date in localStorage to avoid redundant calls
  useEffect(() => {
    if (authUser?.id) {
      const storageKey = STORAGE_KEYS.LAST_ENTROPY_RUN(authUser.id);
      const lastRun = localStorage.getItem(storageKey);
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

      if (lastRun !== today) {
        supabase.rpc('run_entropy_cycle', { p_user_id: authUser.id }).then(({ error }) => {   
          if (!error) {
            localStorage.setItem(storageKey, today);
            // Invalidate pantry items if the cycle ran
            queryClient.invalidateQueries({ queryKey: ['pantry-items', authUser.id] });       
          }
        });
      }
    }
  }, [authUser?.id, supabase, queryClient]);

  const { data: user, isLoading: isUserLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['user-profile', authUser?.id],
    queryFn: async () => {
      if (!authUser) return null;

      const { data } = await supabase
        .from('users')
        .select('id, display_name, hand_width_mm, metabolic_state_json, streak_count, avatar_url, calorie_target, plan, household_id, created_at')
        .eq('id', authUser.id)
        .single();

      return data;
    },
    enabled: !!authUser,
  });

  // Aggressive post-upgrade sync: If session_id is in URL, force a refetch
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('session_id') && authUser) {
            console.log("[useDashboardData] Upgrade detected, forcing profile sync...");
            refetchProfile();
            // Clean up the URL to avoid continuous refetches
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }
  }, [authUser, refetchProfile]);
  // Sync plan state to store via useEffect
  useEffect(() => {
    if (user?.plan) {
      setPlan(user.plan as any);
    }
  }, [user?.plan, setPlan]);

  // 2. Fetch Active Conditions
  const { data: activeConditions = [], isLoading: isConditionsLoading } = useQuery({
    queryKey: ['user-conditions', authUser?.id],
    queryFn: async () => {
      if (!authUser) return [];

      const { data, error } = await supabase
        .from('user_conditions')
        .select('conditions(name)')
        .eq('user_id', authUser.id);

      if (error) throw normalizeError(error);

      return data?.map((c: any) => c.conditions?.name).filter(Boolean) as string[] || [];
    },
    enabled: !!authUser,
  });

  // 3. Fetch Daily Macros via Vision Service
  const { data: dailyLogs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['daily-logs', authUser?.id],
    queryFn: async () => {
      if (!authUser) return [];
      return visionService.getDailyLogs(authUser.id);
    },
    enabled: !!authUser,
  });

  // Aggregate Macros & Micros from Logs
  const dailyMacros: DashboardMacros = dailyLogs.reduce((acc: DashboardMacros, log: LogEntry) => {
    const m = (log.metabolic_tags_json || {}) as Record<string, any>;
    return {
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fat: acc.fat + (Number(m.fat || m.fats) || 0),
      fiber: acc.fiber + (Number(m.fiber) || 0),
      sugar: acc.sugar + (Number(m.sugar) || 0),
      sodium: acc.sodium + (Number(m.sodium) || 0),
      cholesterol: acc.cholesterol + (Number(m.cholesterol) || 0),
      vitamins: aggregateNutrients(acc.vitamins || {}, m.vitamins || []),
      minerals: aggregateNutrients(acc.minerals || {}, m.minerals || []),
    };
  }, { 
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0,
    vitamins: {},
    minerals: {}
  });

  // 4. Fetch AI Advice
  const { data: advice = 'Analyzing metabolic state...', isLoading: isAdviceLoading } = useQuery({
    queryKey: ['metabolic-advice', authUser?.id],
    queryFn: async () => {
      if (!navigator.onLine) return 'Offline Mode: Sync pending.';
      
      const { data, error } = await supabase.functions.invoke('advisor-context', {
        body: { context: 'dashboard' }
      });
      
      if (error) throw normalizeError(error);
      return data?.advice || 'Metabolic state nominal.';
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!authUser && isOnline,
  });

  // 5. Fetch Pantry Items
  const { data: pantryItems = [], isLoading: isPantryLoading } = useQuery({
    queryKey: ['pantry-items', authUser?.id],
    queryFn: async () => {
      if (!authUser) return [];

      const { data } = await supabase
        .from('pantry')
        .select('*, foods(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!authUser,
  });

  return {
    user,
    advice,
    activeConditions,
    dailyMacros,
    dailyLogs,
    pantryItems,
    loading: isAuthLoading || isUserLoading || isConditionsLoading || isLogsLoading || isPantryLoading,
    isOnline
  };
}
