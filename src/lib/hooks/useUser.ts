'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/state/appStore';
import { normalizeError } from '@/lib/utils/errors';
import { STORAGE_KEYS } from '@/lib/utils/storage';

export function useUser() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const setPlan = useAppStore((s) => s.setPlan);

  const { data: authUser, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (authUser?.id) {
      const storageKey = STORAGE_KEYS.LAST_ENTROPY_RUN(authUser.id);
      const lastRun = localStorage.getItem(storageKey);
      const today = new Date().toLocaleDateString('en-CA'); 

      if (lastRun !== today) {
        supabase.rpc('run_entropy_cycle', { p_user_id: authUser.id }).then(({ error }) => {   
          if (!error) {
            localStorage.setItem(storageKey, today);
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('session_id') && authUser) {
            refetchProfile();
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }
  }, [authUser, refetchProfile]);

  useEffect(() => {
    if (user?.plan) setPlan(user.plan as any);
  }, [user?.plan, setPlan]);

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

  return {
    authUser,
    user,
    activeConditions,
    loading: isAuthLoading || isUserLoading || isConditionsLoading,
    refetchProfile
  };
}
