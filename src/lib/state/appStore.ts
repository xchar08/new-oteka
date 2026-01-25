import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppState = {
  isOnline: boolean;
  saveData: boolean;
  lastSyncAt: string | null;

  setConnection: (p: { isOnline: boolean; saveData: boolean }) => void;
  setLastSyncAt: (iso: string) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      saveData: false,
      lastSyncAt: null,

      setConnection: ({ isOnline, saveData }) => set({ isOnline, saveData }),
      setLastSyncAt: (iso) => set({ lastSyncAt: iso }),
    }),
    {
      name: 'oteka-app-storage',
      // Only persist 'lastSyncAt'. Connection status should always reset on reload based on real network state.
      partialize: (state) => ({ lastSyncAt: state.lastSyncAt }),
    }
  )
);
