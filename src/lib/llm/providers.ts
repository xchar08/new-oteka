import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

// Gemini for Vision (Multimodal)
export const geminiProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// DeepSeek R1 (via OpenAI-compatible endpoint) for Physics/Reasoning
export const deepseekProvider = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1', // Official DeepSeek Endpoint
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export const MODEL_VISION = 'gemini-1.5-flash';
export const MODEL_REASONING = 'deepseek-reasoner'; // R1
