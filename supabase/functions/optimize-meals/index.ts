import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import init, { optimize_meal_plan_wasm } from "./planner_wasm.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * WASM ON EDGE LOADER - GLOBAL CACHE
 * We store the instance in the global scope to prevent repeated binary fetching
 * and recompilation during the lifecycle of the Edge Function instance.
 */
let wasmInstance: any = null;

async function getWasmInstance() {
  if (wasmInstance) return wasmInstance;
  try {
    console.log("[WASM] Initializing binary from storage...");
    const wasmUrl = new URL("./planner_wasm_bg.wasm", import.meta.url);
    const wasmCode = await Deno.readFile(wasmUrl);
    await init(wasmCode);
    wasmInstance = true;
    return wasmInstance;
  } catch (e) {
    console.warn("[WASM] Global load failed. Reverting to TS fallback.", e);
    return null;
  }
}

// ─── Taste Scoring (FART-inspired) ────────────────────────────

type TasteVector = {
  sweet: number;
  bitter: number;
  sour: number;
  umami: number;
};

const TASTE_WEIGHT = 300;
const TASTE_MIN_CONFIDENCE = 5;
const FATIGUE_WEIGHT = 500;
const CATEGORY_COOLDOWN_WEIGHT = 300;

function calculateTasteAffinity(user: TasteVector, food: TasteVector): number {
  // Ensure non-negative magnitudes to keep cosine similarity in [0, 1] range
  const u = [Math.max(0, user.sweet), Math.max(0, user.bitter), Math.max(0, user.sour), Math.max(0, user.umami)];
  const f = [Math.max(0, food.sweet), Math.max(0, food.bitter), Math.max(0, food.sour), Math.max(0, food.umami)];
  let dot = 0, nU = 0, nF = 0;
  for (let i = 0; i < 4; i++) {
    dot += u[i] * f[i];
    nU += u[i] * u[i];
    nF += f[i] * f[i];
  }
  const denominator = Math.sqrt(nU) * Math.sqrt(nF);
  return denominator === 0 ? 0.5 : dot / denominator;
}

function computeTastePenalty(userTaste: TasteVector | null, foodTaste: TasteVector | null, confidence: number): number {
  if (!userTaste || !foodTaste) return 0;
  const affinity = calculateTasteAffinity(userTaste, foodTaste);
  const weight = TASTE_WEIGHT * Math.min(1.0, confidence / TASTE_MIN_CONFIDENCE);
  return (1 - affinity) * weight;
}

// ─── DETERMINISTIC TS LOGIC ───────────────────────────────────
type Gene = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  magnesium?: number;
  iron?: number;
  vitamin_d?: number;
  inPantry: boolean;
  expiry?: string;
  decay_coefficient?: number;
  logged_at?: string;
  sodium?: number;
  sugar?: number;
  taste_vector?: TasteVector;
  ingredients?: string[];
  category?: string;
};

type Individual = {
  chromosome: Gene[];
  fitness: number;
};

function runTSOptimization(
  profile: any,
  constraints: any,
  pool: Gene[],
  recentFeedback: any[],
  userConditions: any[],
  userTasteProfile: TasteVector | null = null,
  tasteConfidence: number = 0,
  recentHistory: Array<{ item_name: string; days_ago: number; category?: string }> = [],
) {
  // GREEDY HEURISTIC — replaces full NSGA-II to avoid edge function CPU timeouts.
  // Iteratively selects the food that best closes the remaining macro gap.
  const targetCal = profile?.calorie_target || 2000;
  const targetProt = profile?.metabolic_state_json?.protein_target || 150;
  const MAX_ITEMS = 3; // FORCED TO 3 SLOTS

  // Pre-filter banned foods from medical conditions
  const conditions = userConditions || [];
  const bannedNames = new Set(
    conditions.flatMap((c: any) =>
      (c.never_recommend_json || []).map((s: string) => s.toLowerCase())
    ),
  );
  const safePool = pool.filter((g) => !bannedNames.has(g.name.toLowerCase()));
  if (safePool.length === 0) return [];

  // Build medical threshold limits
  const maxSodium = conditions.reduce(
    (m: number, c: any) => Math.min(m, c.rules_json?.max_sodium ?? Infinity),
    Infinity,
  );
  const maxSugar = conditions.reduce(
    (m: number, c: any) => Math.min(m, c.rules_json?.max_sugar ?? Infinity),
    Infinity,
  );

  const selected: Gene[] = [];
  let remainCal = targetCal;
  let remainProt = targetProt;
  let totalSodium = 0;
  let totalSugar = 0;
  const used = new Set<number>();
  const selectedNames = new Set<string>();
  const selectedCategories = new Map<string, number>();

  // Track recent history for fatigue
  const historyMap = new Map<string, number>();
  const recentCategories = new Set<string>();
  recentHistory.forEach(h => {
    historyMap.set(h.item_name.toLowerCase(), h.days_ago);
    if (h.days_ago <= 2 && h.category) recentCategories.add(h.category.toLowerCase());
  });

  for (let i = 0; i < MAX_ITEMS && remainCal > 50; i++) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let j = 0; j < safePool.length; j++) {
      if (used.has(j)) continue;
      const g = safePool[j];
      if (selectedNames.has(g.name.toLowerCase())) continue;

      // Medical constraint check
      const containsAllergen = g.ingredients?.some(ing => bannedNames.has(ing.toLowerCase()));
      if (containsAllergen) continue; 
      
      if (totalSodium + (g.sodium || 0) > maxSodium) continue;
      if (totalSugar + (g.sugar || 0) > maxSugar) continue;

      const calGap = (Math.abs(remainCal - g.calories) / targetCal) * 1000;
      const protGap = (Math.max(0, remainProt - g.protein) / targetProt) * 1000 * 2.5;
      const pantryBonus = g.inPantry ? 0 : (constraints.strictness ? 5000 : 50);

      // Continuous Protein Density Multiplier: scales down as remainProt approaches zero
      const proteinDensity = g.protein / (g.calories || 1);
      const densityMultiplier = Math.max(0, Math.min(1.0, remainProt / targetProt));
      const densityBonus = (proteinDensity * 1200) * densityMultiplier;

      // Freshness bonus: capped at -50 as a tie-breaker
      let expiryBonus = 0;
      if (g.expiry) {
        const daysLeft = (new Date(g.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysLeft > 0 && daysLeft <= 2) expiryBonus = -50; 
        if (daysLeft < 0) continue; 
      }

      // Feedback penalty
      let fbPenalty = 0;
      const pastRating = recentFeedback.find((f: any) => f.item === g.name);
      if (pastRating && pastRating.score < 3) fbPenalty = 500;

      // Category diversity & cooldown
      const itemCategory = (g.category || 'general').toLowerCase();
      const categoryCount = selectedCategories.get(itemCategory) || 0;
      const diversityPenalty = categoryCount * 300; 
      const categoryCooldownPenalty = recentCategories.has(itemCategory) ? CATEGORY_COOLDOWN_WEIGHT : 0;

      // Fatigue Penalty
      const daysAgo = historyMap.get(g.name.toLowerCase());
      const fatiguePenalty = daysAgo !== undefined ? (FATIGUE_WEIGHT / (daysAgo + 1)) : 0;

      const tastePenalty = computeTastePenalty(userTasteProfile, g.taste_vector || null, tasteConfidence);

      const explorationBonus = Math.random() * 100;

      const score = calGap + protGap + pantryBonus + expiryBonus + fbPenalty + diversityPenalty + categoryCooldownPenalty + fatiguePenalty + tastePenalty - densityBonus - explorationBonus;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx < 0) break;
    const pick = safePool[bestIdx];
    selected.push(pick);
    used.add(bestIdx);
    selectedNames.add(pick.name.toLowerCase());
    const pickCategory = (pick.category || 'general').toLowerCase();
    selectedCategories.set(pickCategory, (selectedCategories.get(pickCategory) || 0) + 1);
    remainCal -= pick.calories;
    remainProt -= pick.protein;
    totalSodium += pick.sodium || 0;
    totalSugar += pick.sugar || 0;
  }

  if (selected.length === 0) return [];

  const stats = calculateTotals(selected);
  const fitness = Math.abs(targetCal - stats.calories) +
    Math.abs(targetProt - stats.protein) * 2;

  return [{
    menu: selected.map((g) => g.name),
    stats,
    score: fitness,
  }];
}

function evaluateWithMedical(
  ind: Individual,
  targets: any,
  constraints: any,
  feedback: any[],
  userConditions: any[],
) {
  const totals = calculateTotals(ind.chromosome);
  let medicalPenalty = 0;

  userConditions.forEach((cond) => {
    const rules = cond.rules_json || {};
    // Strict Medical Blocking
    if (rules.max_sodium && totals.sodium > rules.max_sodium) {
      medicalPenalty += 50000;
    }
    if (rules.max_sugar && totals.sugar > rules.max_sugar) {
      medicalPenalty += 50000;
    }
    if (rules.min_protein && totals.protein < rules.min_protein) {
      medicalPenalty += 10000;
    }
  });

  // Standard multi-objective sum
  evaluate(ind, targets, constraints, feedback);
  ind.fitness += medicalPenalty;
}

function evaluate(
  ind: Individual,
  targets: any,
  constraints: any,
  feedback: any[],
) {
  const totals = calculateTotals(ind.chromosome);
  const dCal = Math.abs(targets.calories - totals.calories);
  const dProt = Math.abs(targets.protein - totals.protein);
  const dMg = Math.max(0, targets.magnesium - (totals.magnesium || 0));
  const dFe = Math.max(0, targets.iron - (totals.iron || 0));
  const pantryViolations = ind.chromosome.filter((g) => !g.inPantry).length;

  let wastePenalty = 0;
  const now = new Date().getTime();
  ind.chromosome.forEach((gene) => {
    if (gene.expiry) {
      const daysLeft = (new Date(gene.expiry).getTime() - now) /
        (1000 * 60 * 60 * 24);
      if (daysLeft <= 2 && daysLeft > 0) wastePenalty += 2500;
      if (daysLeft <= 0) wastePenalty -= 2000;
    } else if (gene.decay_coefficient && gene.logged_at) {
      const daysSinceLog = (now - new Date(gene.logged_at).getTime()) /
        (1000 * 60 * 60 * 24);
      const freshness = Math.exp(-gene.decay_coefficient * daysSinceLog);
      if (freshness < 0.3 && freshness > 0.05) wastePenalty += 1000;
    }
  });

  let feedbackPenalty = 0;
  ind.chromosome.forEach((gene) => {
    const pastRating = feedback.find((f) => f.item === gene.name);
    if (pastRating && pastRating.score < 3) {
      feedbackPenalty += 500 * (3 - pastRating.score);
    }
    if (pastRating && pastRating.score >= 4) feedbackPenalty -= 200;
  });

  ind.fitness = dCal + (dProt * 2) + (dMg * 10) + (dFe * 10) +
    (pantryViolations * (constraints.strictness ? 1000 : 50)) -
    wastePenalty + feedbackPenalty;
}

function calculateTotals(genes: Gene[]) {
  return genes.reduce((acc, g) => ({
    calories: acc.calories + g.calories,
    protein: acc.protein + g.protein,
    carbs: acc.carbs + g.carbs,
    fats: acc.fats + (g.fats || 0),
    magnesium: (acc.magnesium || 0) + (g.magnesium || 0),
    iron: (acc.iron || 0) + (g.iron || 0),
    sodium: (acc.sodium || 0) + (g.sodium || 0),
    sugar: (acc.sugar || 0) + (g.sugar || 0),
  }), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    magnesium: 0,
    iron: 0,
    sodium: 0,
    sugar: 0,
  });
}

function getRandomGenes(pool: Gene[], count: number): Gene[] {
  if (pool.length === 0) return [];
  return Array.from(
    { length: count },
    () => pool[Math.floor(Math.random() * pool.length)],
  );
}

function mutate(chrom: Gene[], pool: Gene[]): Gene[] {
  return chrom.map((g) =>
    Math.random() < 0.2 ? pool[Math.floor(Math.random() * pool.length)] : g
  );
}

const DEFAULT_FALLBACK_FOODS = [
  {
    name: "Chicken Breast",
    calories: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    sodium: 74,
    sugar: 0,
  },
  {
    name: "Eggs",
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fats: 9.5,
    sodium: 124,
    sugar: 0.4,
  },
  {
    name: "Spinach",
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fats: 0.4,
    sodium: 79,
    sugar: 0.4,
  },
  {
    name: "Salmon",
    calories: 208,
    protein: 20,
    carbs: 0,
    fats: 13,
    sodium: 59,
    sugar: 0,
  },
  {
    name: "Brown Rice",
    calories: 111,
    protein: 2.6,
    carbs: 23,
    fats: 0.9,
    sodium: 5,
    sugar: 0.4,
  },
  {
    name: "Avocado",
    calories: 160,
    protein: 2,
    carbs: 8.5,
    fats: 14.7,
    sodium: 7,
    sugar: 0.7,
  },
  {
    name: "Greek Yogurt",
    calories: 59,
    protein: 10,
    carbs: 3.6,
    fats: 0.4,
    sodium: 36,
    sugar: 3.2,
  },
  {
    name: "Almonds",
    calories: 579,
    protein: 21,
    carbs: 22,
    fats: 49,
    sodium: 1,
    sugar: 4.3,
  },
  {
    name: "Broccoli",
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fats: 0.4,
    sodium: 33,
    sugar: 1.7,
  },
  {
    name: "Sweet Potato",
    calories: 86,
    protein: 1.6,
    carbs: 20,
    fats: 0.1,
    sodium: 55,
    sugar: 4.2,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth Header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      token,
    );
    if (!user || userError) throw new Error("Auth Failed");

    const reqBody = await req.json();
    let constraints = reqBody.constraints ||
      { strictness: 1.0, use_preferences: true };

    // 1. Fetch Profile & Medical
    const { data: profile } = await supabase
      .from("users")
      .select("metabolic_state_json, calorie_target, taste_profile_json")
      .eq("id", user.id)
      .single();

    // Parse user taste profile
    const userTasteProfile: TasteVector | null = profile?.taste_profile_json ? {
      sweet: profile.taste_profile_json.sweet ?? 0.5,
      bitter: profile.taste_profile_json.bitter ?? 0.5,
      sour: profile.taste_profile_json.sour ?? 0.5,
      umami: profile.taste_profile_json.umami ?? 0.5,
    } : null;
    const tasteConfidence = profile?.taste_profile_json?.confidence ?? 0;

    const proteinTarget = profile?.metabolic_state_json?.protein_target || 150;

    const { data: userConditions } = await supabase
      .from("user_conditions")
      .select(
        "condition_id, conditions(name, rules_json, never_recommend_json)",
      )
      .eq("user_id", user.id);

    const conditions = (userConditions || [])
      .map((uc: any) => uc.conditions)
      .filter((c: any) => c !== null && c !== undefined);
    const globalExclusions = conditions.flatMap((c) =>
      c.never_recommend_json || []
    ).map((s) => s.toLowerCase());

    // 2. Fetch Pantry Pool
    // NOTE: pantry has no quantity/expiry columns — that data lives in metadata_json
    // (expiry_text, quantity_estimate, ingredients). Selecting non-existent columns
    // makes PostgREST return an error and silently empties the pool.
    const { data: pantryRaw, error: pantryErr } = await supabase
      .from("pantry")
      .select("name, food_id, foods(id, name, nutritional_info, category_decay_rate), created_at, metadata_json")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (pantryErr) {
      console.error("[optimize-meals] Pantry fetch failed:", pantryErr.message);
    }

    let pantryPool: Gene[] = (pantryRaw || [])
      .filter((p: any) => {
        const itemName = p.foods?.name || p.name || "";
        return itemName && !globalExclusions.includes(itemName.toLowerCase());
      })
      .map((p: any) => {
        // Use foods table data if linked, otherwise use defaults
        const ni = p.foods?.nutritional_info || {};
        // expiry_text is free text from the vision scan; only use it if it parses as a date
        const expiryText = p.metadata_json?.expiry_text;
        const expiry = expiryText && !isNaN(new Date(expiryText).getTime())
          ? expiryText
          : undefined;
        return {
          name: p.foods?.name || p.name || "Unknown",
          calories: ni.calories || 100,
          protein: ni.protein || 5,
          carbs: ni.carbs || 10,
          fats: ni.fats || 2,
          sodium: ni.sodium || 0,
          sugar: ni.sugar || 0,
          magnesium: ni.magnesium || 10,
          iron: ni.iron || 2,
          vitamin_d: ni.vitamin_d || 0,
          inPantry: true,
          expiry,
          ingredients: Array.isArray(p.metadata_json?.ingredients) ? p.metadata_json.ingredients : undefined,
          category: ni.category || (p.metadata_json?.category) || "general",
          decay_coefficient: p.foods?.category_decay_rate || 0.05,
          logged_at: p.created_at,
          taste_vector: ni.taste_vector || undefined,
        };
      });

    if (pantryPool.length === 0) {
      const { data: globalFoods } = await supabase.from("foods").select(
        "name, nutritional_info, category_decay_rate",
      ).limit(200);
      pantryPool = (globalFoods || [])
        .filter((f: any) =>
          !globalExclusions.includes((f.name || "").toLowerCase())
        )
        .map((f: any) => ({
          name: f.name,
          calories: f.nutritional_info?.calories || 100,
          protein: f.nutritional_info?.protein || 5,
          carbs: f.nutritional_info?.carbs || 10,
          fats: f.nutritional_info?.fats || 2,
          sodium: f.nutritional_info?.sodium || 0,
          sugar: f.nutritional_info?.sugar || 0,
          magnesium: f.nutritional_info?.magnesium || 10,
          iron: f.nutritional_info?.iron || 2,
          vitamin_d: f.nutritional_info?.vitamin_d || 0,
          inPantry: false,
          decay_coefficient: f.category_decay_rate || 0.05,
          taste_vector: f.nutritional_info?.taste_vector || undefined,
        }));

      if (pantryPool.length === 0) {
        pantryPool = DEFAULT_FALLBACK_FOODS
          .filter((f) => !globalExclusions.includes(f.name.toLowerCase()))
          .map((f) => ({
            ...f,
            inPantry: false,
            decay_coefficient: 0.05,
          }));
      }
    }

    const { data: logsRaw } = await supabase
      .from("logs")
      .select("metabolic_tags_json")
      .eq("user_id", user.id)
      .not("metabolic_tags_json->feedback", "is", null);

    const recentFeedback = (logsRaw || []).map((l) => {
      const f = l.metabolic_tags_json.feedback;
      const avgScore =
        ((f.taste || 3) + (f.digestion || 3) + (f.satiety || 3)) / 3;
      return { item: l.metabolic_tags_json.item, score: avgScore };
    });

    let solutions: any[] = [];
    let method = "TS_FALLBACK";

    // TRY WASM FIRST
    const wasm = await getWasmInstance();
    if (wasm) {
      console.log("[WASM] Executing optimization...");
      try {
        // The Rust PlanRequest expects snake_case FoodItem fields and a
        // required `id` — serde rejects the request otherwise.
        const wasmReq = {
          profile: {
            calorie_target: profile?.calorie_target || 2000,
            protein_target: profile?.metabolic_state_json?.protein_target || 150,
            magnesium_target: 400,
            iron_target: 18,
            taste_sweet: userTasteProfile?.sweet ?? null,
            taste_bitter: userTasteProfile?.bitter ?? null,
            taste_sour: userTasteProfile?.sour ?? null,
            taste_umami: userTasteProfile?.umami ?? null,
            taste_confidence: tasteConfidence,
          },
          available_foods: pantryPool.map((g, i) => ({
            id: String(i),
            name: g.name,
            calories: g.calories,
            protein: g.protein,
            carbs: g.carbs,
            fats: g.fats,
            magnesium: g.magnesium ?? null,
            iron: g.iron ?? null,
            vitamin_d: g.vitamin_d ?? null,
            zinc: null,
            in_pantry: g.inPantry,
            decay_k: g.decay_coefficient ?? null,
            logged_at_ms: g.logged_at ? new Date(g.logged_at).getTime() : null,
            expiry_ms: g.expiry ? new Date(g.expiry).getTime() : null,
            taste_sweet: g.taste_vector?.sweet ?? null,
            taste_bitter: g.taste_vector?.bitter ?? null,
            taste_sour: g.taste_vector?.sour ?? null,
            taste_umami: g.taste_vector?.umami ?? null,
          })),
          recent_feedback: recentFeedback.map((f) => ({
            item_name: f.item,
            score: f.score,
          })),
          recent_history: null,
          strictness: constraints.strictness || 1.0,
        };
        const results = optimize_meal_plan_wasm(wasmReq, BigInt(Date.now()));
        if (Array.isArray(results) && results.length > 0) {
          solutions = results.map((result: any) => ({
            menu: result.selected_foods.map((f: any) => f.name),
            stats: {
              calories: result.total_calories,
              protein: result.total_protein,
              magnesium: result.total_magnesium,
              iron: result.total_iron,
              carbs: result.selected_foods.reduce(
                (acc: number, f: any) => acc + (f.carbs || 0),
                0,
              ),
              fats: result.selected_foods.reduce(
                (acc: number, f: any) => acc + (f.fats || 0),
                0,
              ),
              sodium: result.selected_foods.reduce(
                (acc: number, f: any) => acc + (f.sodium || 0),
                0,
              ),
              sugar: result.selected_foods.reduce(
                (acc: number, f: any) => acc + (f.sugar || 0),
                0,
              ),
            },
            score: result.fitness_score,
          }));
          method = "WASM_ON_EDGE";
        }
      } catch (e) {
        console.warn("[WASM] Execution failed, falling back to TS", e);
      }
    }

    let iteration = 0;
    while (solutions.length === 0 && iteration < 3) {
      solutions = runTSOptimization(
        profile,
        constraints,
        pantryPool,
        recentFeedback,
        conditions,
        userTasteProfile,
        tasteConfidence,
      );
      if (solutions.length === 0) {
        if (iteration === 0) constraints.strictness *= 0.9;
        else if (iteration === 1) constraints.use_preferences = false;
        else constraints.macro_margin = (constraints.macro_margin || 0.1) + 0.1;
        iteration++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        solutions: solutions.slice(0, 3),
        meta: { method, iterations: iteration, pantry_size: pantryPool.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
