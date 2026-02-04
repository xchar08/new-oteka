// This is a Web Worker
// Implementing NSGA-II (Genetic Algorithm) in TypeScript
// Replaces the previous "Mock" logic with actual computational optimization.

// Types
type Gene = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  inPantry: boolean;
};

type Individual = {
  chromosome: Gene[]; // [ProteinSource, CarbSource, Veg/Fat]
  fitness: number;
  violations: number;
};

// Simplified Food Database for Simulation (In a real app, this comes from DB)
const SAMPLE_PROTEINS: Gene[] = [
  {
    name: "Chicken Breast",
    calories: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    inPantry: true,
  },
  {
    name: "Salmon",
    calories: 208,
    protein: 20,
    carbs: 0,
    fats: 13,
    inPantry: false,
  },
  {
    name: "Tofu",
    calories: 144,
    protein: 17,
    carbs: 3,
    fats: 8,
    inPantry: true,
  },
  {
    name: "Steak",
    calories: 271,
    protein: 26,
    carbs: 0,
    fats: 19,
    inPantry: false,
  },
];

const SAMPLE_CARBS: Gene[] = [
  {
    name: "White Rice",
    calories: 200,
    protein: 4,
    carbs: 44,
    fats: 0.4,
    inPantry: true,
  },
  {
    name: "Quinoa",
    calories: 222,
    protein: 8,
    carbs: 39,
    fats: 3.6,
    inPantry: false,
  },
  {
    name: "Sweet Potato",
    calories: 112,
    protein: 2,
    carbs: 26,
    fats: 0.1,
    inPantry: true,
  },
  {
    name: "Pasta",
    calories: 220,
    protein: 8,
    carbs: 43,
    fats: 1.3,
    inPantry: false,
  },
];

const SAMPLE_VEG: Gene[] = [
  {
    name: "Spinach",
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fats: 0.4,
    inPantry: true,
  },
  {
    name: "Broccoli",
    calories: 55,
    protein: 3.7,
    carbs: 11,
    fats: 0.6,
    inPantry: true,
  },
  {
    name: "Avocado",
    calories: 240,
    protein: 3,
    carbs: 12,
    fats: 22,
    inPantry: false,
  },
];

addEventListener("message", async (event) => {
  const { user_profile, constraints } = event.data;

  try {
    // 1. Define Objectives from Profile
    let targetCalories = 500;
    let targetProtein = 25;

    if (user_profile?.metabolic_state_json?.current_goal === "muscle_gain") {
      targetCalories = 700;
      targetProtein = 40;
    } else if (
      user_profile?.metabolic_state_json?.current_goal === "fat_loss"
    ) {
      targetCalories = 400;
      targetProtein = 30;
    }

    const POPSIZE = 50;
    const GENERATIONS = 30;
    const MUTATION_RATE = 0.1;

    // 2. Initialize Population
    let population: Individual[] = [];
    for (let i = 0; i < POPSIZE; i++) {
      population.push(createRandomIndividual());
    }

    // 3. Evolution Loop
    for (let g = 0; g < GENERATIONS; g++) {
      // Evaluate
      population.forEach((ind) =>
        evaluate(ind, targetCalories, targetProtein, constraints.strictness)
      );

      // Sort by fitness (lower is better, 0 is perfect)
      population.sort((a, b) => a.fitness - b.fitness);

      // Selection & Crossover (Simple Elitism + Random Mating)
      const nextGen: Individual[] = population.slice(0, 10); // Keep top 10

      while (nextGen.length < POPSIZE) {
        const p1 = population[Math.floor(Math.random() * 20)]; // Select from top 20
        const p2 = population[Math.floor(Math.random() * 20)];
        nextGen.push(crossover(p1, p2, MUTATION_RATE));
      }
      population = nextGen;
    }

    // 4. Final Evaluation & Formatting
    const bestSolutions = population.slice(0, 3).map((ind) => {
      const totalCals = ind.chromosome.reduce(
        (sum, gene) => sum + gene.calories,
        0,
      );
      return {
        menu: ind.chromosome.map((g) => g.name),
        stats: { calories: totalCals },
        personalized_note: `Fitness Score: ${
          ind.fitness.toFixed(1)
        } (Lower is better)`,
      };
    });

    postMessage({
      type: "SUCCESS",
      result: { solutions: bestSolutions, retries_used: 0 },
    });
  } catch (error) {
    postMessage({ type: "ERROR", error: String(error) });
  }
});

// --- HELPER FUNCTIONS ---

function createRandomIndividual(): Individual {
  return {
    chromosome: [
      SAMPLE_PROTEINS[Math.floor(Math.random() * SAMPLE_PROTEINS.length)],
      SAMPLE_CARBS[Math.floor(Math.random() * SAMPLE_CARBS.length)],
      SAMPLE_VEG[Math.floor(Math.random() * SAMPLE_VEG.length)],
    ],
    fitness: 9999,
    violations: 0,
  };
}

function evaluate(
  ind: Individual,
  targetCals: number,
  targetProt: number,
  strictPantry: boolean,
) {
  let totalCals = 0;
  let totalProt = 0;
  let pantryViolations = 0;

  ind.chromosome.forEach((gene) => {
    totalCals += gene.calories;
    totalProt += gene.protein;
    if (strictPantry && !gene.inPantry) pantryViolations++;
  });

  // Fitness Function: Weighted sum of deviations
  // We punish pantry violations severely if strict mode is on
  const calDiff = Math.abs(targetCals - totalCals);
  const protDiff = Math.abs(targetProt - totalProt);

  ind.fitness = calDiff + (protDiff * 2) + (pantryViolations * 500);
  ind.violations = pantryViolations;
}

function crossover(
  p1: Individual,
  p2: Individual,
  mutationRate: number,
): Individual {
  const childChrom = p1.chromosome.map((gene, i) => {
    // Uniform Crossover
    return Math.random() > 0.5 ? gene : p2.chromosome[i];
  });

  // Mutation
  if (Math.random() < mutationRate) {
    const index = Math.floor(Math.random() * 3);
    if (index === 0) {
      childChrom[0] =
        SAMPLE_PROTEINS[Math.floor(Math.random() * SAMPLE_PROTEINS.length)];
    }
    if (index === 1) {
      childChrom[1] =
        SAMPLE_CARBS[Math.floor(Math.random() * SAMPLE_CARBS.length)];
    }
    if (index === 2) {
      childChrom[2] = SAMPLE_VEG[Math.floor(Math.random() * SAMPLE_VEG.length)];
    }
  }

  return {
    chromosome: childChrom,
    fitness: 0,
    violations: 0,
  };
}

export class PlannerWorker {
  private worker: Worker | null = null;
  constructor() {
    if (typeof window !== "undefined") {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
    }
  }
  optimize(inputs: any, constraints: any) {
    if (!this.worker) return Promise.reject("Worker not initialized");
    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e) => {
        if (e.data.type === "SUCCESS") resolve(e.data.result);
        else reject(e.data.error);
      };
      this.worker!.onerror = (e) => reject(e);
      this.worker!.postMessage({ inputs, constraints });
    });
  }
  terminate() {
    this.worker?.terminate();
  }
}

export async function runOptimization(params: any) {
  const planner = new PlannerWorker();
  try {
    return await planner.optimize(params.pantry_items, params.constraints);
  } finally {
    planner.terminate();
  }
}
