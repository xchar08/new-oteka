// This is a Web Worker
// Implementing a robust Genetic Algorithm in TypeScript for offline fallback

export {};

type Gene = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  inPantry: boolean;
  sodium?: number;
  sugar?: number;
};

type Individual = {
  chromosome: Gene[];
  fitness: number;
};

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
  const { pantry_items, user_profile, conditions, constraints, global_foods } = event.data;

  try {
    const targets = {
      calories: user_profile?.calorie_target || 2000,
      protein: user_profile?.metabolic_state_json?.protein_target || 150,
    };

    const POPSIZE = 40;
    const GENERATIONS = 20;
    
    let pool: Gene[] = pantry_items && pantry_items.length > 0 
      ? pantry_items.map((p: any) => {
          const frac = p.metadata_json?.remaining_fraction ?? 1.0;
          return {
            name: p.foods?.name || p.name || "Unknown",
            calories: (p.foods?.nutritional_info?.calories || p.nutritional_info?.calories || 100) * frac,
            protein: (p.foods?.nutritional_info?.protein || p.nutritional_info?.protein || 5) * frac,
            carbs: (p.foods?.nutritional_info?.carbs || p.nutritional_info?.carbs || 10) * frac,
            fats: (p.foods?.nutritional_info?.fats || p.nutritional_info?.fats || 2) * frac,
            sodium: (p.foods?.nutritional_info?.sodium || p.nutritional_info?.sodium || 0) * frac,
            sugar: (p.foods?.nutritional_info?.sugar || p.nutritional_info?.sugar || 0) * frac,
            inPantry: true
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
              inPantry: false
            }))
          : DEFAULT_FALLBACK_FOODS.map(f => ({ ...f, inPantry: false }))
        );

    // Inject staples to prevent constraint failure
    pool = [...pool, ...ASSUMED_STAPLES];

    // Initialize Population
    let population: Individual[] = Array.from({ length: POPSIZE }, () => ({
      chromosome: getRandomGenes(pool, 3),
      fitness: 0
    }));

    // Evolution Loop
    for (let g = 0; g < GENERATIONS; g++) {
      population.forEach(ind => {
        const totals = calculateTotals(ind.chromosome);
        const dCal = Math.abs(targets.calories - totals.calories);
        const dProt = Math.abs(targets.protein - totals.protein);
        const pantryViolations = ind.chromosome.filter(g => !g.inPantry).length;
        
        let medicalPenalty = 0;
        if (conditions) {
            conditions.forEach((cond: any) => {
                const rules = cond.rules_json || {};
                if (rules.max_sodium && totals.sodium > rules.max_sodium) medicalPenalty += 10000;
                if (rules.max_sugar && totals.sugar > rules.max_sugar) medicalPenalty += 10000;
            });
        }

        // Constraint relaxation: reduce penalties in later generations if not strict
        const isLateGeneration = g > GENERATIONS / 2;
        const protMultiplier = (isLateGeneration && !constraints?.strictness) ? 1 : 2;
        const calMultiplier = (isLateGeneration && !constraints?.strictness) ? 0.5 : 1;

        ind.fitness = (dCal * calMultiplier) + (dProt * protMultiplier) + (pantryViolations * (constraints?.strictness ? 1000 : 50)) + medicalPenalty;
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
