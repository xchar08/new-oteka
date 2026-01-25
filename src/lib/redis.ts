import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize Redis from env vars
// Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are in .env.local
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Create a generic rate limiter: 10 requests per 10 seconds
// Good for high-cost API routes (Vision/AI)
export const visionRateLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});

// Helper to check limit
export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await visionRateLimiter.limit(identifier);
  return { success, limit, remaining, reset };
}
