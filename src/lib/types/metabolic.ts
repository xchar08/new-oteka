/**
 * Shared type definitions for the Oteka metabolic pipeline.
 * Single source of truth for all data structures flowing through
 * vision → storage → UI rendering.
 */

// ─── Taste Profile (FART-inspired) ───────────────────────────

export interface TasteVector {
  sweet: number;   // 0.0 to 1.0 intensity
  bitter: number;
  sour: number;
  umami: number;
}

export interface UserTasteProfile extends TasteVector {
  confidence: number;          // Number of feedback samples incorporated
  last_updated?: string;
}

// ─── Nutrient Data ───────────────────────────────────────────

export interface NutrientEntry {
  name: string;
  amount: string;              // Display string, e.g. "2.5mg" — used in UI rendering
  amount_mg?: number;          // Pre-normalized to milligrams at the API boundary — used for computation
  daily_value_pct?: number;
}

export interface MacroData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
}

export interface Ingredient {
  name: string;
  ratio?: number;
}

// ─── Metabolic Insight ───────────────────────────────────────

export type ImpactLevel = 'super_bad' | 'bad' | 'neutral' | 'good' | 'super_good';

export interface TriggeredPhenomenon {
  id: string;
  name: string;
  why: string;
}

export interface MetabolicInsight {
  score: number;
  impact_level: ImpactLevel;
  layman_explanation: string;
  triggered_phenomena?: TriggeredPhenomenon[];
}

export interface SafetyAlert {
  type: 'warning' | 'urgent';
  condition_id?: string;
  reason: string;
}

// ─── Scan Result (from vision-pipeline) ──────────────────────

export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  multiplier?: number; // Added for UI adjustments
  taste_vector?: TasteVector; // FART-derived taste profile
}

export interface ScanResult {
  items: FoodItem[];
  ingredients: Ingredient[];
  macros: MacroData;
  vitamins: NutrientEntry[];
  minerals: NutrientEntry[];
  micros: NutrientEntry[];
  volume_cm3: number;
  reasoning_trace?: string;
  metabolic_insight: MetabolicInsight;
  safety_alerts?: SafetyAlert[];
  imagePath?: string;
  persisted?: boolean;
}

// ─── Log Entry (stored in Supabase `logs` table) ─────────────

export interface LogMetadata {
  item: string;
  food_name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  vitamins: NutrientEntry[];
  minerals: NutrientEntry[];
  micros: NutrientEntry[];
  ingredients: string[];
  reasoning?: string;
  metabolic_insight?: string;
  image_path: string | null;
  feedback?: {
    taste: number;
    satiety: number;
    digestion: number;
  };
}

export interface LogEntry {
  id?: string;
  user_id: string;
  grams: number;
  local_date: string; // YYYY-MM-DD
  metabolic_tags_json: LogMetadata | Record<string, any>; // LogMetadata for new writes, flexible for legacy reads
  captured_at: string;
  image_url?: string; // Resolved signed URL (not stored, computed at read)
}

// ─── Dashboard Aggregation ───────────────────────────────────

export interface DashboardMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  vitamins: Record<string, { amount: number; unit: string; daily_value_pct: number }>;
  minerals: Record<string, { amount: number; unit: string; daily_value_pct: number }>;
}

// ─── Pantry ──────────────────────────────────────────────────

export interface PantryItem {
  name: string;
  quantity: string;
  expiry: string;
  ingredients?: string[];
}

// ─── Advisor Response ────────────────────────────────────────

export interface AdvisorResponse {
  analysis: string;
  recommendations: string[];
  metabolic_tags: string[];
  actionable_insight: string;
}

// ─── User Profile & State ─────────────────────────────────────

export interface MetabolicState {
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  sex?: 'male' | 'female' | 'other';
  current_goal?: 'maintenance' | 'loss' | 'gain';
  medical_verified?: boolean;
  taste_profile?: UserTasteProfile;
}

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  metabolic_state_json: MetabolicState;
  taste_profile_json: UserTasteProfile | null;
  hand_width_mm: number | null;
  streak_count: number;
  calorie_target: number;
  plan: 'free' | 'pro';
  household_id: string | null;
  created_at: string;
}
