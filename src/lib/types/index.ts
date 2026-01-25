import { z } from 'zod';

export const MetabolicStateSchema = z.object({
  glucose_trend: z.enum(['rising', 'stable', 'falling']).optional(),
  last_meal_time: z.string().datetime().optional(),
  current_goal: z.enum(['cutting', 'bulking', 'maintenance']),
});

export const VisionAnalysisSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    confidence: z.number(),
    estimated_volume_cm3: z.number(),
    density_g_cm3: z.number(),
    mass_g: z.number(),
    macros: z.object({
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      calories: z.number(),
    })
  })),
  total_calories: z.number(),
  confidence_score: z.number(), // 0.0 to 1.0
  action_needed: z.enum(['none', 'tilt_45_deg', 'manual_verify']).optional(),
});

export type VisionAnalysisResult = z.infer<typeof VisionAnalysisSchema>;
