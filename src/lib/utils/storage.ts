/**
 * Centralized Storage Keys for Oteka Platform
 */
export const STORAGE_KEYS = {
  LAST_ENTROPY_RUN: (userId: string) => `oteka_v1_entropy_run_${userId}`,
  APP_THEME: 'oteka_theme_preference',
  AUTH_PENDING_UPGRADE: 'oteka_upgrade_sync_required',
};
