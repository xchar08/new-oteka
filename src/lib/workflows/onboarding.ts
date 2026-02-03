import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const OnboardingSchema = z.object({
  userId: z.string(),
  handWidthMm: z.number().min(50).max(150),
  creditCardCalibration: z.boolean().optional(), // If they used a card to calibrate
});

export async function submitOnboardingData(data: z.infer<typeof OnboardingSchema>) {
  const { userId, handWidthMm } = data;

  const { error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      hand_width_mm: handWidthMm,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Onboarding failed: ${error.message}`);
  }

  // Initialize empty workflows/stats if needed
  return { success: true };
}
