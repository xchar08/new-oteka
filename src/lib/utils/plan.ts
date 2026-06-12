export type UserPlan = 'free' | 'pro' | 'coach';

/**
 * Coach includes everything in Pro (it bundles 15 Pro seats),
 * so any paid plan unlocks premium features.
 */
export function isPaidPlan(plan?: string | null): boolean {
  return plan === 'pro' || plan === 'coach';
}

export function normalizePlan(plan?: string | null): UserPlan {
  if (plan === 'pro' || plan === 'coach') return plan;
  return 'free';
}
