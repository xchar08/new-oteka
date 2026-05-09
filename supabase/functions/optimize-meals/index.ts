import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * WASM ON EDGE LOADER
 * This module dynamically loads the Planner WASM binary for elite-speed optimization.
 */
let wasmInstance: any = null;

async function getWasmInstance() {
  if (wasmInstance) return wasmInstance;
  
  // Load the WASM binary from the storage bucket or a local path in the bundle
  // In a real Supabase deploy, you would either bundle this or fetch from Storage.
  // For this environment, we'll try to fetch it or mock the speed.
  try {
      // Logic for loading .wasm in Deno
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

// DETERMINISTIC TS LOGIC (The fallback if WASM isn't bundled yet)
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
};

type Individual = {
  chromosome: Gene[];
  fitness: number;
};

function runTSOptimization(profile: any, constraints: any, pantry: Gene[], recentFeedback: any[]) {
  const POPSIZE = 50;
  const GENERATIONS = 25;
  
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
    population.forEach(ind => evaluate(ind, targets, constraints, recentFeedback));
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
    .filter(ind => ind.fitness < (constraints.strictness ? 150 : 600))
    .map(ind => ({
      menu: ind.chromosome.map(g => g.name),
      stats: calculateTotals(ind.chromosome),
      score: ind.fitness
    }));
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
      if (daysLeft <= 2 && daysLeft > 0) wastePenalty += 2500; // MASSIVE bonus to force selection
      if (daysLeft <= 0) wastePenalty -= 2000;
    } else if (gene.decay_coefficient && gene.logged_at) {
      const daysSinceLog = (now - new Date(gene.logged_at).getTime()) / (1000 * 60 * 60 * 24);
      const freshness = Math.exp(-gene.decay_coefficient * daysSinceLog);
      if (freshness < 0.3 && freshness > 0.05) wastePenalty += 1000; // Use before it goes bad!
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
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, magnesium: 0, iron: 0 });
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

    const { data: profile } = await supabase
      .from("users")
      .select("metabolic_state_json, calorie_target, protein_target")
      .eq("id", user.id)
      .single();

    const { data: pantryRaw } = await supabase
      .from("pantry")
      .select("foods(name, metadata_json), quantity, expiry, created_at")
      .eq("user_id", user.id);

    const pantry: Gene[] = (pantryRaw || []).map((p: any) => ({
      name: p.foods?.name || "Unknown",
      calories: p.foods?.metadata_json?.macros?.calories || 100,
      protein: p.foods?.metadata_json?.macros?.protein || 5,
      carbs: p.foods?.metadata_json?.macros?.carbs || 10,
      fats: p.foods?.metadata_json?.macros?.fats || 2,
      magnesium: 10,
      iron: 2,
      inPantry: true,
      expiry: p.expiry,
      decay_coefficient: p.foods?.metadata_json?.decay_k || 0.05,
      logged_at: p.created_at
    }));

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

    // TRY WASM FIRST
    const wasm = await getWasmInstance();
    let solutions: any[] = [];
    let method = "TS_FALLBACK";

    if (wasm) {
        // Elite WASM Execution Path
        // const result = wasm.exports.optimize_meal_plan(...);
        // method = "WASM_ON_EDGE";
    }

    // FALLBACK / CURRENT PRIMARY
    let iteration = 0;
    while (solutions.length === 0 && iteration < 3) {
      solutions = runTSOptimization(profile, constraints, pantry, recentFeedback);
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
        meta: { method, iterations: iteration, pantry_size: pantry.length }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
