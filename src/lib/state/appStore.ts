import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'solar' | 'emerald' | 'cobalt' | 'midnight';

type AppState = {
  isOnline: boolean;
  saveData: boolean;
  lastSyncAt: string | null;
  colorTheme: ColorTheme;

  setConnection: (p: { isOnline: boolean; saveData: boolean }) => void;
  setLastSyncAt: (iso: string) => void;
  setColorTheme: (theme: ColorTheme) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      saveData: false,
      lastSyncAt: null,
      colorTheme: 'solar',

      setConnection: ({ isOnline, saveData }) => set({ isOnline, saveData }),
      setLastSyncAt: (iso) => set({ lastSyncAt: iso }),
      setColorTheme: (theme) => set({ colorTheme: theme }),
    }),
    {
      name: 'oteka-app-storage',
      // Persist 'lastSyncAt' and 'colorTheme'.
      partialize: (state) => ({ 
        lastSyncAt: state.lastSyncAt,
        colorTheme: state.colorTheme
      }),
    }
  )
);
