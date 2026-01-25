import { generateText } from 'ai';
import { google } from '@ai-sdk/google'; // DeepSeek proxy for now
import { createClient } from '@/lib/supabase/server';

export async function generateMetabolicAdvice(userId: string, context: 'pre-log' | 'post-log') {
  const supabase = await createClient();
  
  // 1. Fetch User Metabolic State
  const { data: user } = await supabase
    .from('users')
    .select('metabolic_state_json, streak_count')
    .eq('id', userId)
    .single();
    
  if (!user) throw new Error("User not found");

  const state = user.metabolic_state_json as any;
  
  // 2. Construct DeepSeek R1 Prompt
  const prompt = `
    Role: Metabolic Orchestrator.
    User Context:
    - Streak: ${user.streak_count} days
    - Goal: ${state.current_goal} (e.g., Lean Bulk)
    - Glucose Trend: ${state.glucose_trend}
    - Last Meal: ${state.last_meal_time}
    
    Trigger: ${context}
    
    Task: Provide a single sentence actionable insight using the "Randle Cycle" logic if applicable.
    Constraint: If 'cutting' & 'glucose_rising', suggest avoiding fats in next meal.
  `;

  // 3. Call Reasoning Engine
  const { text } = await generateText({
    model: google('gemini-1.5-pro'), // Replace with DeepSeek R1 provider
    prompt: prompt,
    temperature: 0.7,
  });

  return {
    advice: text,
    generated_at: new Date().toISOString()
  };
}
