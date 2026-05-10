'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Centralized Handler for Capacitor Local Notifications
 * Manages deep linking for metabolic calibration alerts.
 */
export function NotificationHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAction = (notification: any) => {
      console.log('[NotificationHandler] Processing action:', notification);
      const extraData = notification.extra;
      
      if (extraData?.route) {
        console.log(`[NotificationHandler] Routing to: ${extraData.route}`);
        router.push(extraData.route);
      } else if (notification.title?.includes('Calibrate')) {
        router.push('/rating');
      }
    };

    // Handle notification click when app is in foreground or background
    const setupListeners = async () => {
      // 1. Check if app was launched from a notification (Cold Start)
      const launchNotification = await LocalNotifications.getLaunchNotification();
      if (launchNotification?.notification) {
        console.log('[NotificationHandler] App launched via notification');
        handleAction(launchNotification.notification);
      }

      // 2. Listen for actions while app is running
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        handleAction(action.notification);
      });
    };

    setupListeners();

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, [router]);

  return <>{children}</>;
}
