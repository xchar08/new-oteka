import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * WASM ON EDGE LOADER
 */
let wasmInstance: any = null;

async function getWasmInstance() {
  if (wasmInstance) return wasmInstance;
  try {
      const wasmPath = new URL('./planner_wasm_bg.wasm', import.meta.url);
      const wasmCode = await Deno.readFile(wasmPath.pathname);
      const wasmModule = new WebAssembly.Module(wasmCode);
      wasmInstance = new WebAssembly.Instance(wasmModule, {});
      return wasmInstance;
  } catch (e) {
      console.warn("[WASM] Failed to load binary. Falling back to High-Performance TS logic.");
      return null;
  }
}

// DETERMINISTIC TS LOGIC
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
};

type Individual = {
  chromosome: Gene[];
  fitness: number;
};

function runTSOptimization(profile: any, constraints: any, pantry: Gene[], recentFeedback: any[], userConditions: any[]) {
  const POPSIZE = constraints.pop_size || 50;
  const GENERATIONS = constraints.generations || 25;
  
  const targets = {
    calories: profile?.calorie_target || 2000,
    protein: profile?.protein_target || 150,
    magnesium: 400,
    iron: 18,
    vitD: 20
  };

  let population: Individual[] = Array.from({ length: POPSIZE }, () => ({
    chromosome: getRandomGenes(pantry, 3),
    fitness: 0
  }));

  for (let g = 0; g < GENERATIONS; g++) {
    population.forEach(ind => evaluateWithMedical(ind, targets, constraints, recentFeedback, userConditions));
    population.sort((a, b) => a.fitness - b.fitness);

    const nextGen = population.slice(0, 10);
    while (nextGen.length < POPSIZE) {
      const p1 = population[Math.floor(Math.random() * 20)];
      nextGen.push({
        chromosome: mutate(p1.chromosome, pantry),
        fitness: 0
      });
    }
    population = nextGen;
  }

  return population
    .filter(ind => ind.fitness < 20000) // Filter out medical violations (penalty is 10k+)
    .map(ind => ({
      menu: ind.chromosome.map(g => g.name),
      stats: calculateTotals(ind.chromosome),
      score: ind.fitness
    }));
}

function evaluateWithMedical(ind: Individual, targets: any, constraints: any, feedback: any[], userConditions: any[]) {
  const totals = calculateTotals(ind.chromosome);
  let medicalPenalty = 0;

  userConditions.forEach(cond => {
    const rules = cond.rules_json || {};
    // Strict Medical Blocking
    if (rules.max_sodium && totals.sodium > rules.max_sodium) medicalPenalty += 50000;
    if (rules.max_sugar && totals.sugar > rules.max_sugar) medicalPenalty += 50000;
    if (rules.min_protein && totals.protein < rules.min_protein) medicalPenalty += 10000;
  });

  // Standard multi-objective sum
  evaluate(ind, targets, constraints, feedback); 
  ind.fitness += medicalPenalty;
}

function evaluate(ind: Individual, targets: any, constraints: any, feedback: any[]) {
  const totals = calculateTotals(ind.chromosome);
  const dCal = Math.abs(targets.calories - totals.calories);
  const dProt = Math.abs(targets.protein - totals.protein);
  const dMg = Math.max(0, targets.magnesium - (totals.magnesium || 0));
  const dFe = Math.max(0, targets.iron - (totals.iron || 0));
  const pantryViolations = ind.chromosome.filter(g => !g.inPantry).length;
  
  let wastePenalty = 0;
  const now = new Date().getTime();
  ind.chromosome.forEach(gene => {
    if (gene.expiry) {
      const daysLeft = (new Date(gene.expiry).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 2 && daysLeft > 0) wastePenalty += 2500; 
      if (daysLeft <= 0) wastePenalty -= 2000;
    } else if (gene.decay_coefficient && gene.logged_at) {
      const daysSinceLog = (now - new Date(gene.logged_at).getTime()) / (1000 * 60 * 60 * 24);
      const freshness = Math.exp(-gene.decay_coefficient * daysSinceLog);
      if (freshness < 0.3 && freshness > 0.05) wastePenalty += 1000; 
    }
  });

  let feedbackPenalty = 0;
  ind.chromosome.forEach(gene => {
    const pastRating = feedback.find(f => f.item === gene.name);
    if (pastRating && pastRating.score < 3) feedbackPenalty += 500 * (3 - pastRating.score);
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
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, magnesium: 0, iron: 0, sodium: 0, sugar: 0 });
}

function getRandomGenes(pool: Gene[], count: number): Gene[] {
  if (pool.length === 0) return [];
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function mutate(chrom: Gene[], pool: Gene[]): Gene[] {
  return chrom.map(g => Math.random() < 0.2 ? pool[Math.floor(Math.random() * pool.length)] : g);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth Header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Auth Failed");

    const reqBody = await req.json();
    let constraints = reqBody.constraints || { strictness: 1.0, use_preferences: true };

    // 1. Fetch Profile & Medical
    const { data: profile } = await supabase
      .from("users")
      .select("metabolic_state_json, calorie_target, protein_target")
      .eq("id", user.id)
      .single();

    const { data: userConditions } = await supabase
      .from("user_conditions")
      .select("condition_id, conditions(name, rules_json)")
      .eq("user_id", user.id);

    const conditions = (userConditions || []).map((uc: any) => uc.conditions);

    // 2. Fetch Pantry Pool
    const { data: pantryRaw } = await supabase
      .from("pantry")
      .select("foods(id, name, metadata_json), quantity, expiry, created_at")
      .eq("user_id", user.id);

    let pantryPool: Gene[] = (pantryRaw || []).map((p: any) => ({
      name: p.foods?.name || "Unknown",
      calories: p.foods?.metadata_json?.macros?.calories || 100,
      protein: p.foods?.metadata_json?.macros?.protein || 5,
      carbs: p.foods?.metadata_json?.macros?.carbs || 10,
      fats: p.foods?.metadata_json?.macros?.fats || 2,
      sodium: p.foods?.metadata_json?.macros?.sodium || 0,
      sugar: p.foods?.metadata_json?.macros?.sugar || 0,
      magnesium: 10,
      iron: 2,
      inPantry: true,
      expiry: p.expiry,
      decay_coefficient: p.foods?.metadata_json?.decay_k || 0.05,
      logged_at: p.created_at
    }));

    if (pantryPool.length === 0) {
      const { data: globalFoods } = await supabase.from("foods").select("name, metadata_json").limit(40);
      pantryPool = (globalFoods || []).map((f: any) => ({
        name: f.name,
        calories: f.metadata_json?.macros?.calories || 100,
        protein: f.metadata_json?.macros?.protein || 5,
        carbs: f.metadata_json?.macros?.carbs || 10,
        fats: f.metadata_json?.macros?.fats || 2,
        sodium: f.metadata_json?.macros?.sodium || 0,
        sugar: f.metadata_json?.macros?.sugar || 0,
        inPantry: false,
        decay_coefficient: 0.05
      }));
    }

    const { data: logsRaw } = await supabase
      .from("logs")
      .select("metabolic_tags_json")
      .eq("user_id", user.id)
      .not("metabolic_tags_json->feedback", "is", null);

    const recentFeedback = (logsRaw || []).map(l => {
      const f = l.metabolic_tags_json.feedback;
      const avgScore = ((f.taste || 3) + (f.digestion || 3) + (f.satiety || 3)) / 3;
      return { item: l.metabolic_tags_json.item, score: avgScore };
    });

    let solutions: any[] = [];
    let method = "TS_FALLBACK";

    let iteration = 0;
    while (solutions.length === 0 && iteration < 3) {
      solutions = runTSOptimization(profile, constraints, pantryPool, recentFeedback, conditions);
      if (solutions.length === 0) {
        if (iteration === 0) constraints.strictness *= 0.9;
        else if (iteration === 1) constraints.use_preferences = false;
        else constraints.macro_margin = (constraints.macro_margin || 0.1) + 0.1;
        iteration++;
      }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        solutions: solutions.slice(0, 3),
        meta: { method, iterations: iteration, pantry_size: pantryPool.length }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
