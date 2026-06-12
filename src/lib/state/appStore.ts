import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPlan } from '@/lib/utils/plan';

export type ColorTheme = 'solar' | 'emerald' | 'cobalt' | 'midnight';
export type { UserPlan };

type AppState = {
  isOnline: boolean;
  saveData: boolean;
  lastSyncAt: string | null;
  colorTheme: ColorTheme;
  plan: UserPlan;

  setConnection: (p: { isOnline: boolean; saveData: boolean }) => void;
  setLastSyncAt: (iso: string) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setPlan: (plan: UserPlan) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      saveData: false,
      lastSyncAt: null,
      colorTheme: 'solar',
      plan: 'free',

      setConnection: ({ isOnline, saveData }) => set({ isOnline, saveData }),
      setLastSyncAt: (iso) => set({ lastSyncAt: iso }),
      setColorTheme: (theme) => set({ colorTheme: theme }),
      setPlan: (plan) => set({ plan }),
    }),
    {
      name: 'oteka-app-storage',
      // Persist 'lastSyncAt', 'colorTheme', and 'plan'.
      partialize: (state) => ({ 
        lastSyncAt: state.lastSyncAt,
        colorTheme: state.colorTheme,
        plan: state.plan
      }),
    }
  )
);
