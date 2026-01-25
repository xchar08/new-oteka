import { createClient } from '@/lib/supabase/server';

/**
 * Constants for decay rates (k)
 * Higher k = faster probability decay
 */
const DECAY_RATES: Record<string, number> = {
  'dairy': 0.15,
  'leafy_greens': 0.20,
  'meat_fresh': 0.25,
  'dry_grains': 0.001,
  'canned_goods': 0.0005,
  'default': 0.05
};

/**
 * Run the daily entropy cycle.
 * Called via Cron Job (pg_cron) or Edge Function.
 */
export async function runEntropyCycle() {
  const supabase = await createClient();

  // 1. Fetch active pantry items with their category decay rates
  const { data: items, error } = await supabase
    .from('pantry')
    .select(`
      id, 
      probability_score, 
      foods ( category_decay_rate )
    `)
    .eq('status', 'active');

  if (error || !items) throw new Error("Entropy Fetch Failed");

  const updates = [];

  for (const item of items) {
    const k = item.foods?.[0]?.category_decay_rate ?? DECAY_RATES['default'];
    
    // Formula: P_new = P_old * (1 - k)
    let p_new = Number(item.probability_score) * (1 - Number(k));

    // Clamp to 0
    if (p_new < 0) p_new = 0;

    // "Ghost Check" Trigger: If P < 0.3, flag for review
    const status = p_new < 0.3 ? 'review_needed' : 'active';

    updates.push({
      id: item.id,
      probability_score: p_new,
      status: status
    });
  }

  // 2. Batch Update
  const { error: updateError } = await supabase
    .from('pantry')
    .upsert(updates);

  if (updateError) throw new Error("Entropy Update Failed");

  return { processed: updates.length, flagged: updates.filter(u => u.status === 'review_needed').length };
}
