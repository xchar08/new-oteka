import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const MenuSchema = z.object({
  restaurant_name: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.number().optional(),
    estimated_calories: z.number().describe("Estimate based on description/ingredients"),
    tags: z.array(z.string()).describe("e.g. 'high-protein', 'vegan', 'spicy'"),
    health_score: z.number().min(1).max(10).describe("10 is optimal for lean bulk"),
  })),
  dietary_warnings: z.array(z.string()).optional(),
});

export async function parseMenuImage(imageBase64: string, userGoal: string) {
  // Uses Gemini 3.0 (via 1.5-flash proxy) to OCR and reason simultaneously
  const { object } = await generateObject({
    model: google('gemini-3.0-flash'),
    schema: MenuSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Parse this menu. Goal: ${userGoal}. Highlight high-protein options.` },
          { type: 'image', image: imageBase64 }
        ]
      }
    ]
  });
  return object;
}
