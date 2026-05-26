'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/state/appStore';
import { useUser } from './useUser';

export function usePantryData() {
  const supabase = createClient();
  const isOnline = useAppStore((s) => s.isOnline);
  const { authUser } = useUser();

  const { data: pantryItems = [], isLoading: isPantryLoading, refetch: refetchPantry } = useQuery({
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

  const { data: globalFoods = [], isLoading: isGlobalFoodsLoading } = useQuery({
    queryKey: ['global-foods'],
    queryFn: async () => {
      const { data } = await supabase
        .from('foods')
        .select('name, nutritional_info, category_decay_rate')
        .limit(100);
      return data || [];
    },
    enabled: isOnline,
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
  });

  return {
    pantryItems,
    globalFoods,
    loading: isPantryLoading || isGlobalFoodsLoading,
    refetchPantry
  };
}
