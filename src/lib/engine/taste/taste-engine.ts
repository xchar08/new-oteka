/**
 * Taste Engine — FART-inspired taste profiling for food recommendations.
 * 
 * Based on the methodology from:
 * "A chemical language model for molecular taste prediction" (Nature, 2025)
 * DOI: 10.1038/s41538-025-00474-z
 * 
 * Maps the 4 taste categories (sweet, bitter, sour, umami) to food items
 * and scores them against user taste preferences using cosine similarity.
 */

import tasteProfilesData from './taste-profiles.seed.json';

// ─── Types ───────────────────────────────────────────────────

export interface TasteVector {
  sweet: number;   // 0.0 to 1.0
  bitter: number;
  sour: number;
  umami: number;
}

export interface UserTasteProfile extends TasteVector {
  confidence: number;      // Number of feedback samples incorporated
  last_updated?: string;
}

export interface FoodTasteProfile {
  food_name: string;
  sweet: number;
  bitter: number;
  sour: number;
  umami: number;
  dominant_taste: string;
}

// ─── Constants ───────────────────────────────────────────────

/** Default taste profile for new users — balanced, no strong preferences */
export const DEFAULT_TASTE_PROFILE: UserTasteProfile = {
  sweet: 0.5,
  bitter: 0.5,
  sour: 0.5,
  umami: 0.5,
  confidence: 0,
};

/** Taste weight in the optimizer fitness function (same order as diversityPenalty) */
export const TASTE_WEIGHT = 300;

/** Learning rate for taste profile updates from feedback */
const TASTE_LEARNING_RATE = 0.1;

/** Minimum confidence before taste significantly affects optimization */
const MIN_CONFIDENCE_FOR_FULL_WEIGHT = 5;

// ─── Seed Data Lookup ────────────────────────────────────────

const tasteProfiles: FoodTasteProfile[] = tasteProfilesData;

/** 
 * Pre-built index for O(1) exact-match lookups.
 * Keys are lowercase food names.
 */
const tasteIndex = new Map<string, FoodTasteProfile>();
for (const profile of tasteProfiles) {
  tasteIndex.set(profile.food_name.toLowerCase(), profile);
}

// ─── Core Functions ──────────────────────────────────────────

/**
 * Look up a food's taste profile by name.
 * Performs exact match first, then fuzzy substring match.
 */
export function getFoodTasteProfile(foodName: string): TasteVector | null {
  const key = foodName.toLowerCase().trim();
  
  // 1. Exact match
  const exact = tasteIndex.get(key);
  if (exact) return toVector(exact);
  
  // 2. Fuzzy match — check if any seed name is contained in the food name or vice versa
  for (const [seedKey, profile] of tasteIndex) {
    if (key.includes(seedKey) || seedKey.includes(key)) {
      return toVector(profile);
    }
  }
  
  // 3. Word-level match — check if the first significant word matches
  const words = key.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    for (const [seedKey, profile] of tasteIndex) {
      const seedWords = seedKey.split(/\s+/);
      if (seedWords.some(sw => sw === word)) {
        return toVector(profile);
      }
    }
  }
  
  return null;
}

/**
 * Calculate taste affinity between a user's taste profile and a food's taste vector.
 * Uses cosine similarity, scaled to [0, 1].
 * 
 * Returns a value where:
 * - 1.0 = perfect match (user loves exactly what this food offers)
 * - 0.0 = complete mismatch
 */
export function calculateTasteAffinity(
  userProfile: TasteVector,
  foodTaste: TasteVector
): number {
  const u = [userProfile.sweet, userProfile.bitter, userProfile.sour, userProfile.umami];
  const f = [foodTaste.sweet, foodTaste.bitter, foodTaste.sour, foodTaste.umami];
  
  let dotProduct = 0;
  let normU = 0;
  let normF = 0;
  
  for (let i = 0; i < 4; i++) {
    dotProduct += u[i] * f[i];
    normU += u[i] * u[i];
    normF += f[i] * f[i];
  }
  
  const denominator = Math.sqrt(normU) * Math.sqrt(normF);
  if (denominator === 0) return 0.5; // Neutral if either vector is zero
  
  return dotProduct / denominator;
}

/**
 * Calculate the effective taste weight for optimization, 
 * scaled by user confidence level. New users with few feedback
 * samples have reduced taste influence.
 */
export function getEffectiveTasteWeight(profile: UserTasteProfile): number {
  const confidenceFactor = Math.min(1.0, profile.confidence / MIN_CONFIDENCE_FOR_FULL_WEIGHT);
  return TASTE_WEIGHT * confidenceFactor;
}

/**
 * Calculate taste diversity bonus for a meal plan.
 * Rewards plans that cover multiple taste categories rather than
 * being dominated by a single taste.
 * 
 * Returns a bonus value (higher = more diverse = better).
 */
export function calculateTasteDiversity(foodTastes: TasteVector[]): number {
  if (foodTastes.length === 0) return 0;
  
  // Average taste vector across all foods in the plan
  const avg: TasteVector = { sweet: 0, bitter: 0, sour: 0, umami: 0 };
  for (const taste of foodTastes) {
    avg.sweet += taste.sweet;
    avg.bitter += taste.bitter;
    avg.sour += taste.sour;
    avg.umami += taste.umami;
  }
  const n = foodTastes.length;
  avg.sweet /= n;
  avg.bitter /= n;
  avg.sour /= n;
  avg.umami /= n;
  
  // Shannon entropy of the average vector (normalized)
  const values = [avg.sweet, avg.bitter, avg.sour, avg.umami];
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  
  let entropy = 0;
  for (const v of values) {
    const p = v / sum;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  
  // Max entropy for 4 categories = log2(4) = 2.0
  // Normalize to [0, 1], then scale to bonus points
  return (entropy / 2.0) * 100;
}

/**
 * Update a user's taste profile based on feedback.
 * Uses exponential moving average — recent feedback matters more.
 * 
 * @param currentProfile - User's current taste preferences
 * @param foodTaste - Taste vector of the food they rated
 * @param tasteRating - User's taste rating (1-5 scale)
 * @returns Updated taste profile
 */
export function updateTasteProfileFromFeedback(
  currentProfile: UserTasteProfile,
  foodTaste: TasteVector,
  tasteRating: number
): UserTasteProfile {
  // Normalize rating to [-1, 1] range: 1→-1 (hate), 3→0 (neutral), 5→+1 (love)
  const normalizedRating = (tasteRating - 3) / 2;
  
  // Scale the learning rate by how extreme the rating is
  const lr = TASTE_LEARNING_RATE * Math.abs(normalizedRating);
  
  // If they liked it (positive rating), shift preferences TOWARD the food's taste
  // If they disliked it (negative rating), shift preferences AWAY from the food's taste
  const direction = normalizedRating > 0 ? 1 : -1;
  
  const updated: UserTasteProfile = {
    sweet: clamp(currentProfile.sweet + direction * lr * foodTaste.sweet, 0, 1),
    bitter: clamp(currentProfile.bitter + direction * lr * foodTaste.bitter, 0, 1),
    sour: clamp(currentProfile.sour + direction * lr * foodTaste.sour, 0, 1),
    umami: clamp(currentProfile.umami + direction * lr * foodTaste.umami, 0, 1),
    confidence: currentProfile.confidence + 1,
    last_updated: new Date().toISOString(),
  };
  
  return updated;
}

/**
 * Compute a taste penalty for the optimizer fitness function.
 * Lower value = better match = food more likely to be selected.
 * 
 * @returns A penalty value (0 = perfect match, up to TASTE_WEIGHT = terrible match)
 */
export function computeTastePenalty(
  userProfile: UserTasteProfile,
  foodName: string
): number {
  const foodTaste = getFoodTasteProfile(foodName);
  if (!foodTaste) return 0; // No taste data → no penalty (neutral)
  
  const affinity = calculateTasteAffinity(userProfile, foodTaste);
  const weight = getEffectiveTasteWeight(userProfile);
  
  // Invert: high affinity → low penalty
  return (1 - affinity) * weight;
}

// ─── Utilities ───────────────────────────────────────────────

function toVector(profile: FoodTasteProfile): TasteVector {
  return {
    sweet: profile.sweet,
    bitter: profile.bitter,
    sour: profile.sour,
    umami: profile.umami,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
