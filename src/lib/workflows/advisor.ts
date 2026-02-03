import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const nebius = createOpenAI({
  baseURL: process.env.NEBIUS_BASE_URL,
  apiKey: process.env.NEBIUS_API_KEY,
});

const AdvisorSchema = z.object({
  analysis: z.string(),
  recommendations: z.array(z.string()),
  metabolic_tags: z.array(z.string()),
  actionable_insight: z.string(),
});

export async function runMetabolicAdvisor(userId: string, context: any) {
  // Fetch user's recent logs or metabolic state if needed
  // specific context can be passed in 'context' arg

  const prompt = `
    You are a Metabolic Advisor powered by DeepSeek R1.
    Analyze the following user context and provide optimization advice.
    
    Context:
    ${JSON.stringify(context)}
    
    Focus on:
    - Glucose spikes
    - Randle Cycle optimization (Fat/Carb separation)
    - Circadian timing
    
    Provide specific, actionable advice.
  `;

  const { object: result } = await generateObject({
    model: nebius('deepseek-ai/DeepSeek-R1'),
    schema: AdvisorSchema,
    prompt: prompt,
  });

  // Log to workflows
  await supabase.from('workflows').insert({
    user_id: userId,
    trigger_event: 'metabolic_advisor',
    last_run_status: 'success',
    logs_json: { context, result }
  });

  return result;
}
