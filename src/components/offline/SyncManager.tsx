'use client';

import { useEffect } from 'react';
import { installQueueAutoSync } from '@/lib/offline/sync';
import { useAppStore } from '@/lib/state/appStore';

export function SyncManager() {
  const setConnection = useAppStore((s) => s.setConnection);

  useEffect(() => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW Registered:', reg.scope))
        .catch((err) => console.error('SW Failed:', err));
    }

    // 2. Bind Network Status to Global Store
    // This allows the whole app to react to connectivity changes immediately
    const updateStatus = () => {
      const conn = (navigator as any).connection;
      setConnection({
        isOnline: navigator.onLine,
        saveData: conn ? conn.saveData : false,
      });
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // Initial check on mount
    updateStatus();

    // 3. Start Sync Listener (Auto-process queue when 'online' event fires)
    const cleanupSync = installQueueAutoSync();

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      cleanupSync();
    };
  }, [setConnection]);

  return null; // Headless component
}
