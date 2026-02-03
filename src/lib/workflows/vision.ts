import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (assuming env vars are globally available or passed in context, 
// strictly speaking for server actions we might want to ensure this is safe, but for a lib file, 
// we will instantiate it here or export a helper)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Gemini 3.0 Flash Provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Initialize DeepSeek (Nebius) Provider
const nebius = createOpenAI({
  baseURL: process.env.NEBIUS_BASE_URL,
  apiKey: process.env.NEBIUS_API_KEY,
});

export const VisionWorkflowSchema = z.object({
  masses_g: z.array(z.number()),
  total_kcal: z.number(),
  items: z.array(z.string()),
  volume_cm3: z.number(),
  confidence_score: z.number(),
  action: z.enum(['PROCEED', 'REQUEST_ANGLE_SHIFT']).default('PROCEED'),
  reasoning: z.string().optional(),
});

export type VisionWorkflowResult = z.infer<typeof VisionWorkflowSchema>;

export async function runVisionPipeline(
  imageBase64: string,
  userId: string,
  userHandWidthMm: number
): Promise<VisionWorkflowResult> {
  // 1. Connection Check (Logical check, in a real env we might check headers or use a flag)
  // For server-side function, we assume we are "Online" if this function is reached via API.
  
  // 2. Node B: Identification (Gemini 3.0 Flash)
  const geminiModel = google('gemini-1.5-flash'); // Using 1.5 Flash as proxy for "3.0 Flash" if 3.0 isn't available in SDK yet, or update to 'gemini-2.0-flash-exp' if available
  // Note: Model name might need adjustment to the exact string for "Gemini 3.0 Flash" when released/available in this key.
  // Using 'gemini-1.5-flash' for now as a safe default for high speed.

  const identificationPrompt = `
    Analyze this food image. 
    1. Identify the items present (e.g., "Basmati Rice", "Grilled Chicken").
    2. Estimate the ratio of the food volume compared to the hand visible in the frame (if any).
    3. Read any visible text (e.g. nutrition labels).
    Return a concise description for a physics engine.
  `;

  // We use generateText for the raw description first to feed into the reasoning model
  const { text: sceneDescription } = await generateText({
    model: geminiModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: identificationPrompt },
          { type: 'image', image: imageBase64 }, // generic base64 handling
        ],
      },
    ],
  });

  // 3. Node C: Physics Core (DeepSeek R1 via Nebius)
  // Converting description + relative volume + reference hand width into absolute volume.
  
  const physicsPrompt = `
    You are a Physics Core for a metabolic tracker.
    
    Input Data:
    - Scene Description: "${sceneDescription}"
    - reference_hand_width_mm: ${userHandWidthMm}
    
    Task:
    1. Estimate the volume of the food in cubic centimeters (cm³).
    2. Suggest a density for the food based on its type (e.g., Rice=1.3g/cm³).
    3. Calculate the mass in grams.
    4. Estimate total calories.
    5. Determine a confidence score (0.0 to 1.0). If the view is likely ambiguous or the angle is bad (calculated from description implying flatness or occlusion), lower the score.
    6. If confidence < 0.7, set action to "REQUEST_ANGLE_SHIFT".

    Output JSON format only.
  `;

  // Use DeepSeek R1 (DeepSeek-V3-Base or similar via Nebius if R1 specific string differs)
  // Assuming 'deepseek-ai/DeepSeek-V3' or similar. 
  // For 'DeepSeek R1', we need the specific model ID from Nebius. 
  // Common placeholders: 'deepseek-r1', 'deepseek-chat'.
  const deepseekModel = nebius('deepseek-ai/DeepSeek-R1'); 

  const { object: physicsResult } = await generateObject({
    model: deepseekModel,
    schema: VisionWorkflowSchema,
    prompt: physicsPrompt,
  });

  // 4. Log the execution (Auditing)
  await supabase.from('workflows').insert({
    user_id: userId,
    trigger_event: 'vision_pipeline',
    last_run_status: 'success',
    logs_json: {
      scene_description: sceneDescription,
      physics_result: physicsResult
    }
  });

  return physicsResult;
}
