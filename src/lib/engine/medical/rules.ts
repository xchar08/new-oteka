import { createClient } from '@/lib/supabase/server.server';

export type NutrientProfile = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar?: number;
  sodium?: number;
};

type ConditionRule =
  | {
      trigger_logic: 'threshold_exceeded';
      thresholds: Record<string, number>;
      severity: 'high' | 'medium';
      warning_msg: string;
    }
  | {
      trigger_logic: 'avoid_combination';
      components: string[];
      thresholds?: Record<string, number>;
      severity: 'high' | 'medium';
      warning_msg: string;
    }
  | {
      trigger_logic: 'avoid_ingredient';
      ingredients: string[];
      severity: 'high' | 'medium';
      warning_msg: string;
    };

export async function checkMedicalContraindications(userId: string, meal: NutrientProfile) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_conditions')
    .select('conditions ( name, rules_json )')
    .eq('user_id', userId);

  if (error) {
    console.error('checkMedicalContraindications error:', error.message);
    return { safe: true, warnings: [] as string[] };
  }

  const warnings: string[] = [];
  let unsafe = false;

  for (const row of data ?? []) {
    const cond = (row as any).conditions;
    if (!cond) continue;

    const rule = cond.rules_json as ConditionRule;

    if (rule.trigger_logic === 'threshold_exceeded') {
      for (const [k, limit] of Object.entries(rule.thresholds ?? {})) {
        const val = (meal as any)[k] ?? 0;
        if (typeof val === 'number' && val > limit) {
          warnings.push(`${cond.name}: ${rule.warning_msg} (${k} ${val} > ${limit}).`);
          if (rule.severity === 'high') unsafe = true;
        }
      }
    }

    if (rule.trigger_logic === 'avoid_combination') {
      const thresholds = rule.thresholds ?? {};
      const hit = rule.components.every((c) => ((meal as any)[c] ?? 0) >= (thresholds[c] ?? 0));
      if (hit) {
        warnings.push(`${cond.name}: ${rule.warning_msg}.`);
        if (rule.severity === 'high') unsafe = true;
      }
    }
  }

  return { safe: !unsafe, warnings };
}
