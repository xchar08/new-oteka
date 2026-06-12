'use client';

import { create } from 'zustand';

/**
 * Tracks how many LogEntryCards are currently in edit mode, so containers
 * (dashboard tabs, week pager, date strip) can refuse state changes that
 * would unmount an editing card and silently discard its draft.
 */
interface EditingLogsState {
  count: number;
  begin: () => void;
  end: () => void;
}

export const useEditingLogs = create<EditingLogsState>((set) => ({
  count: 0,
  begin: () => set((s) => ({ count: s.count + 1 })),
  end: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));
