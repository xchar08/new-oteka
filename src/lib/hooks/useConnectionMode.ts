'use client';

import { useEffect } from 'react';

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
};

function getConnection(): NetworkInformation | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (navigator as any).connection as NetworkInformation | undefined;
}

export function useConnectionMode(opts?: {
  onMode?: (mode: 'online' | 'offline' | 'save-data') => void;
}) {
  useEffect(() => {
    const notify = () => {
      const conn = getConnection();
      const saveData = !!conn?.saveData;
      const online = navigator.onLine;

      const mode: 'online' | 'offline' | 'save-data' =
        !online ? 'offline' : saveData ? 'save-data' : 'online';

      opts?.onMode?.(mode);
    };

    notify();

    window.addEventListener('online', notify);
    window.addEventListener('offline', notify);

    const conn = getConnection();
    conn?.addEventListener?.('change', notify);

    return () => {
      window.removeEventListener('online', notify);
      window.removeEventListener('offline', notify);
      conn?.removeEventListener?.('change', notify);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
