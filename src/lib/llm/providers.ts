import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

// Gemini for Vision (Multimodal)
export const geminiProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// DeepSeek R1 (via Nebius OpenAI-compatible endpoint) for Physics/Reasoning
export const deepseekProvider = createOpenAI({
  baseURL: 'https://api.studio.nebius.ai/v1/', // Nebius Endpoint
  apiKey: process.env.NEBIUS_API_KEY,           // Changed from DEEPSEEK_API_KEY
});

export const MODEL_VISION = 'gemini-1.5-flash';
export const MODEL_REASONING = 'deepseek-ai/DeepSeek-R1'; // Nebius Model ID
