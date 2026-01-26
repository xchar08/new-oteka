import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@/lib/supabase/server';

type MetabolicPhenomenon = {
  id: string;
  name: string;
  mechanism: string | null;
  deepseek_prompt_template: string;
};

type ContextType = 'pre-log' | 'post-log';

export async function generateMetabolicAdvice(userId: string, context: ContextType) {
  const supabase = await createClient();

  // 1. Fetch user metabolic state
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('metabolic_state_json, streak_count')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  const state = (user.metabolic_state_json || {}) as any;

  const goal = state.current_goal ?? 'maintenance';
  const glucoseTrend = state.glucose_trend ?? 'unknown';
  const lastMealTime = state.last_meal_time ?? 'unknown';
  const recentMacros = state.recent_meal_macros ?? null; // e.g. { carbs: 60, fats: 40, protein: 30 }

  // 2. Decide which phenomena to fetch (start with Randle Cycle as primary)
  const phenomenaKeys = ['randle_cycle']; // extend later if you want

  const { data: phenomena, error: phenomenaError } = await supabase
    .from('metabolic_phenomena')
    .select('id, name, mechanism, deepseek_prompt_template')
    .in('id', phenomenaKeys);

  if (phenomenaError || !phenomena || phenomena.length === 0) {
    throw new Error('Metabolic phenomena not configured');
  }

  const randle = phenomena.find(p => p.id === 'randle_cycle') as MetabolicPhenomenon | undefined;

  // 3. Build a richer system-style prompt using phenomena
  const randleSection = randle
    ? `
Metabolic Phenomenon Focus: ${randle.name}
Mechanism: ${randle.mechanism ?? 'N/A'}
Template Hint: ${randle.deepseek_prompt_template}
`
    : '';

  const contextSummary = `
Role: Metabolic Orchestrator.

User Context:
- Streak: ${user.streak_count} days
- Goal: ${goal}
- Glucose Trend: ${glucoseTrend}
- Last Meal Time: ${lastMealTime}
- Recent Macros: ${recentMacros ? JSON.stringify(recentMacros) : 'unknown'}

Trigger: ${context}
`;

  const hardConstraints = `
Constraints:
- Reply in exactly ONE concise sentence.
- If goal is 'cutting' AND glucose_trend is 'rising', explicitly recommend minimizing fats in the next meal.
- Avoid medical jargon; speak like a coach, not a textbook.
`;

  const fullPrompt = `
${contextSummary}
${randleSection}
${hardConstraints}

Task:
Using the phenomenon above ONLY if relevant, give one actionable insight for the user's next decision (food timing, macros, or composition).
`;

  // 4. Call Reasoning Engine
  const { text } = await generateText({
    model: google('gemini-3.0-pro'),
    prompt: fullPrompt,
    temperature: 0.4, // a bit lower for consistency
  });

  return {
    advice: text.trim(),
    generated_at: new Date().toISOString(),
  };
}
