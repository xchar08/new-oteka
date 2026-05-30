// This is a Web Worker
// Implementing a robust Genetic Algorithm in TypeScript for offline fallback

export {};

type TasteVector = {
  sweet: number;
  bitter: number;
  sour: number;
  umami: number;
};

type Gene = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  inPantry: boolean;
  sodium?: number;
  sugar?: number;
  taste_vector?: TasteVector;
  expiry_ms?: number;
  decay_k?: number;
  logged_at_ms?: number;
  category?: string;
};

type Individual = {
  chromosome: Gene[];
  fitness: number;
};

const FATIGUE_WEIGHT = 500;
const CATEGORY_COOLDOWN_WEIGHT = 300;
const FRESHNESS_BONUS_CAP = 50;

const ASSUMED_STAPLES: Gene[] = [
  { name: "Olive Oil", calories: 119, protein: 0, carbs: 0, fats: 13.5, sodium: 0, sugar: 0, inPantry: true },
  { name: "Butter", calories: 102, protein: 0.1, carbs: 0.1, fats: 11.5, sodium: 91, sugar: 0.1, inPantry: true },
  { name: "Salt", calories: 0, protein: 0, carbs: 0, fats: 0, sodium: 2325, sugar: 0, inPantry: true },
  { name: "Water", calories: 0, protein: 0, carbs: 0, fats: 0, sodium: 0, sugar: 0, inPantry: true }
];

const DEFAULT_FALLBACK_FOODS = [
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fats: 3.6, sodium: 74, sugar: 0 },
  { name: "Eggs", calories: 143, protein: 12.6, carbs: 0.7, fats: 9.5, sodium: 124, sugar: 0.4 },
  { name: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, sodium: 79, sugar: 0.4 },
  { name: "Salmon Fillet", calories: 208, protein: 22, carbs: 0, fats: 13, sodium: 59, sugar: 0 },
  { name: "Brown Rice", calories: 111, protein: 2.6, carbs: 23, fats: 0.9, sodium: 5, sugar: 0.4 },
  { name: "Avocado", calories: 160, protein: 2, carbs: 8.5, fats: 14.7, sodium: 7, sugar: 0.7 },
  { name: "Greek Yogurt", calories: 59, protein: 10, carbs: 3.6, fats: 0.4, sodium: 36, sugar: 3.2 },
  { name: "Almonds", calories: 579, protein: 21, carbs: 22, fats: 49, sodium: 1, sugar: 4.3 },
  { name: "Broccoli", calories: 34, protein: 2.8, carbs: 7, fats: 0.4, sodium: 33, sugar: 1.7 },
  { name: "Sweet Potato", calories: 86, protein: 1.6, carbs: 20, fats: 0.1, sodium: 55, sugar: 4.2 }
];

addEventListener("message", async (event) => {
  const { pantry_items, user_profile, conditions, constraints, global_foods, recent_history } = event.data;

  // Extract taste profile from user_profile if available
  const userTaste: TasteVector | null = user_profile?.taste_profile_json ? {
    sweet: Math.max(0, user_profile.taste_profile_json.sweet ?? 0.5),
    bitter: Math.max(0, user_profile.taste_profile_json.bitter ?? 0.5),
    sour: Math.max(0, user_profile.taste_profile_json.sour ?? 0.5),
    umami: Math.max(0, user_profile.taste_profile_json.umami ?? 0.5),
  } : null;
  const tasteConfidence = user_profile?.taste_profile_json?.confidence ?? 0;

  try {
    const targets = {
      calories: user_profile?.calorie_target || 2000,
      protein: user_profile?.metabolic_state_json?.protein_target || 150,
    };

    const POPSIZE = 40;
    const GENERATIONS = 20;

    // Track recent categories for cooldown
    const recentCategories = new Set<string>();
    if (recent_history) {
      recent_history.forEach((h: any) => {
        if (h.days_ago <= 2 && h.category) recentCategories.add(h.category.toLowerCase());
      });
    }

    // Optimization: Hoist eaten set for Epsilon-Greedy initialization
    const eatenNames = new Set((recent_history || []).map((h: any) => h.item_name.toLowerCase()));
    
    let pool: Gene[] = pantry_items && pantry_items.length > 0 
      ? pantry_items.map((p: any) => {
          const ni = p.nutritional_info || p.foods?.nutritional_info;
          const frac = p.metadata_json?.remaining_fraction ?? 1.0;
          return {
            name: p.food_name || p.foods?.name || p.name || "Unknown",
            calories: (ni?.calories || 100) * frac,
            protein: (ni?.protein || 5) * frac,
            carbs: (ni?.carbs || 10) * frac,
            fats: (ni?.fats || 2) * frac,
            sodium: (ni?.sodium || 0) * frac,
            sugar: (ni?.sugar || 0) * frac,
            inPantry: true,
            expiry_ms: p.expiry_date ? new Date(p.expiry_date).getTime() : (p.expiry ? new Date(p.expiry).getTime() : undefined),
            decay_k: p.foods?.category_decay_rate || 0.05,
            logged_at_ms: p.created_at ? new Date(p.created_at).getTime() : undefined,
            category: (ni?.category || p.metadata_json?.category || "general").toLowerCase(),
            taste_vector: ni?.taste_vector || undefined,
          };
        })
      : (global_foods && global_foods.length > 0
          ? global_foods.map((f: any) => ({
              name: f.name || "Unknown",
              calories: f.nutritional_info?.calories || 100,
              protein: f.nutritional_info?.protein || 5,
              carbs: f.nutritional_info?.carbs || 10,
              fats: f.nutritional_info?.fats || 2,
              sodium: f.nutritional_info?.sodium || 0,
              sugar: f.nutritional_info?.sugar || 0,
              inPantry: false,
              category: (f.nutritional_info?.category || "general").toLowerCase(),
              taste_vector: f.nutritional_info?.taste_vector || undefined,
            }))
          : DEFAULT_FALLBACK_FOODS.map(f => ({ ...f, inPantry: false, category: "general" }))
        );

    // Inject staples to prevent constraint failure
    pool = [...pool, ...ASSUMED_STAPLES];

    // Initialize Population
    let population: Individual[] = Array.from({ length: POPSIZE }, (_, i) => {
      const forceNovel = i < Math.floor(POPSIZE * 0.1);
      let validPool = pool;
      if (forceNovel && eatenNames.size > 0) {
        const novelPool = pool.filter(f => !eatenNames.has(f.name.toLowerCase()));
        if (novelPool.length >= 3) validPool = novelPool;
      }
      return {
        chromosome: getRandomGenes(validPool, 3),
        fitness: 0
      };
    });

    // Evolution Loop
    for (let g = 0; g < GENERATIONS; g++) {
      population.forEach(ind => {
        const totals = calculateTotals(ind.chromosome);
        const dCal = Math.abs(targets.calories - totals.calories);
        const dProt = Math.abs(targets.protein - totals.protein);
        const pantryViolations = ind.chromosome.filter(g => !g.inPantry).length;
        
        // Freshness bonus: capped total
        let wasteBonus = 0;
        const now = Date.now();
        ind.chromosome.forEach(f => {
            if (f.expiry_ms) {
                const msLeft = f.expiry_ms - now;
                const daysLeft = msLeft / (1000 * 60 * 60 * 24);
                if (daysLeft <= 2 && daysLeft > 0) wasteBonus += 25;
            } else if (f.decay_k && f.logged_at_ms) {
                const daysSince = (now - f.logged_at_ms) / (1000 * 60 * 60 * 24);
                const freshness = Math.exp(-f.decay_k * daysSince);
                if (freshness < 0.3) wasteBonus += 15;
            }
        });
        wasteBonus = Math.min(FRESHNESS_BONUS_CAP, wasteBonus);

        let medicalPenalty = 0;
        if (conditions) {
            conditions.forEach((cond: any) => {
                const rules = cond.rules_json || {};
                if (rules.max_sodium && totals.sodium > rules.max_sodium) medicalPenalty += 50000;
                if (rules.max_sugar && totals.sugar > rules.max_sugar) medicalPenalty += 50000;
            });
        }

        let fatiguePenalty = 0;
        let categoryCooldownPenalty = 0;
        if (recent_history) {
            ind.chromosome.forEach(g => {
                const hit = recent_history.find((h: any) => h.item_name.toLowerCase() === g.name.toLowerCase());
                if (hit) {
                    fatiguePenalty += (FATIGUE_WEIGHT / (hit.days_ago + 1));
                }
                if (g.category && recentCategories.has(g.category.toLowerCase())) {
                  categoryCooldownPenalty += CATEGORY_COOLDOWN_WEIGHT;
                }
            });
        }

        // Constraint relaxation: reduce penalties in later generations if not strict
        const isLateGeneration = g > GENERATIONS / 2;
        const protMultiplier = (isLateGeneration && !constraints?.strictness) ? 1 : 2;
        const calMultiplier = (isLateGeneration && !constraints?.strictness) ? 0.5 : 1;

        ind.fitness = (dCal * calMultiplier) + (dProt * protMultiplier) + (pantryViolations * (constraints?.strictness ? 1000 : 50)) + medicalPenalty + fatiguePenalty + categoryCooldownPenalty - wasteBonus;

        // Taste affinity penalty
        if (userTaste && tasteConfidence > 0) {
          const confFactor = Math.min(1.0, tasteConfidence / 5);
          ind.chromosome.forEach(g => {
            if (g.taste_vector) {
              const u = [userTaste.sweet, userTaste.bitter, userTaste.sour, userTaste.umami];
              const f = [Math.max(0, g.taste_vector.sweet), Math.max(0, g.taste_vector.bitter), Math.max(0, g.taste_vector.sour), Math.max(0, g.taste_vector.umami)];
              let dot = 0, nU = 0, nF = 0;
              for (let i = 0; i < 4; i++) { dot += u[i]*f[i]; nU += u[i]*u[i]; nF += f[i]*f[i]; }
              const denom = Math.sqrt(nU) * Math.sqrt(nF);
              const affinity = denom === 0 ? 0.5 : dot / denom;
              ind.fitness += (1 - affinity) * 300 * confFactor;
            }
          });
        }
      });

      population.sort((a, b) => a.fitness - b.fitness);
      const nextGen = population.slice(0, 10);
      while (nextGen.length < POPSIZE) {
        const p1 = population[Math.floor(Math.random() * 20)];
        nextGen.push({
          chromosome: p1.chromosome.map(g => Math.random() < 0.1 ? pool[Math.floor(Math.random() * pool.length)] : g),
          fitness: 0
        });
      }
      population = nextGen;
    }

    const solutions = population.slice(0, 3).map(ind => ({
      menu: ind.chromosome.map(g => g.name),
      stats: calculateTotals(ind.chromosome),
      personalized_note: "Computed via Local Neural Fallback (Offline)."
    }));

    postMessage({ type: "SUCCESS", result: { solutions } });
  } catch (error) {
    postMessage({ type: "ERROR", error: String(error) });
  }
});

function calculateTotals(genes: Gene[]) {
  return genes.reduce((acc, g) => ({
    calories: acc.calories + g.calories,
    protein: acc.protein + g.protein,
    carbs: acc.carbs + g.carbs,
    fats: acc.fats + g.fats,
    sodium: acc.sodium + (g.sodium || 0),
    sugar: acc.sugar + (g.sugar || 0)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, sodium: 0, sugar: 0 });
}

function getRandomGenes(pool: Gene[], count: number): Gene[] {
  if (!pool || pool.length === 0) return [];
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}
