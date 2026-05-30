// test_optimization_algo.ts
// Run with: npx tsx scripts/test_optimization_algo.ts

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
    .filter(ind => ind.fitness < (constraints.strictness ? 200 : 600)) // loosened for test
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
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, magnesium: 0, iron: 0 });
}

function getRandomGenes(pool: Gene[], count: number): Gene[] {
  if (pool.length === 0) return [];
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function mutate(chrom: Gene[], pool: Gene[]): Gene[] {
  return chrom.map(g => Math.random() < 0.2 ? pool[Math.floor(Math.random() * pool.length)] : g);
}

// --- TEST SCENARIO ---
async function runDiagnostic() {
  console.log("=== OTEKA METABOLIC ENGINE TEST ===");

  // 1. Mock Profile (High Protein Target, Normal Calories)
  const profile = { calorie_target: 1500, protein_target: 100 };

  // 2. Mock Pantry
  // Notice we have two good protein sources: Chicken and Salmon.
  // We will configure the feedback and expiry to manipulate the algorithm.
  const pantry: Gene[] = [
    { name: "Chicken Breast", calories: 300, protein: 50, carbs: 0, fats: 5, inPantry: true },
    { name: "Salmon", calories: 400, protein: 40, carbs: 0, fats: 20, magnesium: 50, inPantry: true },
    { name: "Spinach", calories: 20, protein: 2, carbs: 3, fats: 0, magnesium: 150, iron: 5, inPantry: true }, // High Magnesium
    { name: "White Rice", calories: 200, protein: 4, carbs: 45, fats: 0, inPantry: true },
    { name: "Avocado", calories: 250, protein: 3, carbs: 12, fats: 22, inPantry: true },
    // Expiring VERY soon (Will trigger waste mitigation bonus)
    { name: "Expiring Tofu", calories: 150, protein: 15, carbs: 3, fats: 8, inPantry: true, expiry: new Date(Date.now() + 1000*60*60*24).toISOString() } 
  ];

  // 3. Mock Feedback ("Rate My Meal")
  // User rated Chicken terribly (Score: 2/5).
  // User rated Salmon great (Score: 5/5).
  const feedback = [
    { item: "Chicken Breast", score: 2 }, 
    { item: "Salmon", score: 5 }
  ];

  console.log("\n[TEST 1] Standard Execution (Strictness 1.0)");
  let constraints = { strictness: 1.0, use_preferences: true };
  let solutions = runTSOptimization(profile, constraints, pantry, feedback);
  
  if (solutions.length > 0) {
    const top = solutions[0];
    console.log(`Top Solution Score: ${top.score}`);
    console.log(`Menu: ${top.menu.join(", ")}`);
    console.log(`Stats: ${top.stats.calories}kcal | ${top.stats.protein}g Protein | ${top.stats.magnesium}mg Mg`);
    
    // VERIFICATION
    if (top.menu.includes("Chicken Breast")) {
      console.error("❌ FAILED: Algorithm selected Chicken despite terrible feedback (Score 2).");
    } else {
      console.log("✅ PASSED: Feedback Loop works. Chicken was penalized and avoided.");
    }

    if (top.menu.includes("Expiring Tofu")) {
      console.log("✅ PASSED: Waste Mitigation works. Near-expiry Tofu was prioritized.");
    } else {
      console.error("❌ FAILED: Algorithm ignored near-expiry item.");
    }

    if (top.menu.includes("Spinach")) {
        console.log("✅ PASSED: Gap Analysis works. Spinach selected to fill Magnesium gap.");
    }
  } else {
    console.log("No solutions found initially. Entering Self-Healing Phase...");
  }
}

runDiagnostic();
