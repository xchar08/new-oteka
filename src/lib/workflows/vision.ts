import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logWorkflowEvent } from '@/lib/audit/logger'; 
import { checkMedicalContraindications } from '@/lib/engine/medical/rules'; 

/**
 * SERVER VISION PIPELINE (Online Mode)
 * Node B: Identification (Gemini 1.5 Flash)
 * Node C: Physics & Volume (DeepSeek R1 via Nebius)
 */

// Node B: Identification
async function identifyScene(imageBase64: string) {
  // Use 1.5 Flash for speed and good vision capabilities
  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  
  const { object } = await generateObject({
    model: google('gemini-1.5-flash'),
    schema: z.object({
      scene_description: z.string(),
      items: z.array(z.string()).describe("List of visible food items"),
      menu_text: z.string().optional().describe("Any visible text from menus/labels"),
      lighting_condition: z.string(),
    }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identify food items, extract text, and assess lighting.' },
          { type: 'image', image: imageBase64 }
        ]
      }
    ]
  });
  return object;
}

// Node C: Physics Core (DeepSeek R1 via Nebius)
async function calculateVolumeAndMass(
  items: string[], 
  handWidthMm: number, 
  sceneContext: any
) {
  const prompt = `
    ACT AS A BIOPHYSICS ENGINE. Output JSON ONLY.
    
    Task: Calculate Volume and Mass.
    Reference: User hand width = ${handWidthMm}mm.
    Items: ${JSON.stringify(items)}.
    Context: ${JSON.stringify(sceneContext)}.
    
    Logic Chain:
    1. Estimate relative size of items vs reference hand.
    2. Convert to absolute volume (cm³).
    3. Lookup density (e.g., Rice=1.3g/cm³).
    4. Calculate mass (g) = volume * density.
    5. Estimate Macros (Calories, Protein, Carbs, Fat).

    Output Schema:
    {
      "foods": [
        { "name": "Steak", "mass_g": 250, "calories": 670, "macros": { "p": 62, "c": 0, "f": 45 }, "confidence": 0.85 }
      ],
      "total_calories": 670
    }
  `;

  // Direct fetch to Nebius API
  try {
    const response = await fetch('https://api.studio.nebius.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEBIUS_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-R1",
        messages: [
          { role: "system", content: "You are a physics engine. Output valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) throw new Error(`Nebius API Error: ${response.statusText}`);
    
    const data = await response.json();
    // DeepSeek R1 often includes <think> tags; clean them if necessary, 
    // though the prompt asks for JSON ONLY. JSON.parse will fail if extra text exists.
    let content = data.choices[0].message.content;
    
    // Simple cleanup to extract the JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    return JSON.parse(content);

  } catch (err) {
    console.error("Physics Engine Failed:", err);
    // Fallback: Return empty physics data so the flow doesn't crash
    return { foods: [], total_calories: 0, error: "Physics engine unavailable" };
  }
}

export async function runVisionPipeline(userId: string, imageBase64: string) {
  const supabase = await createClient();
  
  // 1. Fetch User Context
  const { data: user } = await supabase
    .from('users')
    .select('hand_width_mm')
    .eq('id', userId)
    .single();

  if (!user?.hand_width_mm) {
    throw new Error("CALIBRATION_REQUIRED");
  }

  // 2. Node B: Identification
  const identification = await identifyScene(imageBase64);

  // 3. Node C: Physics Core
  const physicsResult = await calculateVolumeAndMass(
    identification.items, 
    user.hand_width_mm, 
    identification
  );

  // 4. Medical Safety Check
  const safetyCheck = await checkMedicalContraindications(userId, {
    calories: physicsResult.total_calories,
    protein: physicsResult.foods?.reduce((acc: number, f: any) => acc + (f.macros?.p || 0), 0) || 0,
    carbs: physicsResult.foods?.reduce((acc: number, f: any) => acc + (f.macros?.c || 0), 0) || 0,
    fats: physicsResult.foods?.reduce((acc: number, f: any) => acc + (f.macros?.f || 0), 0) || 0
  });

  // 5. Volume Verification (Simulated)
  const confidenceScore = physicsResult.foods?.[0]?.confidence || 0.85;
  const action = confidenceScore < 0.7 ? 'tilt_45_deg' : 'none';

  // 6. Audit Log
  await logWorkflowEvent(userId, 'vision_log', 'success', {
    vision_model: 'gemini-1.5-flash',
    physics_model: 'deepseek-ai/DeepSeek-R1',
    confidence: confidenceScore,
    hand_width_ref: user.hand_width_mm,
    safety_warnings: safetyCheck.warnings
  });

  return {
    raw_identification: identification,
    physics_output: physicsResult,
    safety_analysis: safetyCheck,
    meta: {
      confidence_score: confidenceScore,
      action_needed: action
    }
  };
}
