// Test the TS Optimizer logic exactly as written in the edge function
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

function runTSOptimization(
  profile: any,
  constraints: any,
  pantry: Gene[],
  recentFeedback: any[],
  userConditions: any[],
) {
  const targetCal = profile?.calorie_target || 2000;
  const targetProt = profile?.metabolic_state_json?.protein_target || 150;
  const MAX_ITEMS = 5;

  const conditions = userConditions || [];
  const bannedNames = new Set(
    conditions.flatMap((c: any) =>
      (c.never_recommend_json || []).map((s: string) => s.toLowerCase())
    ),
  );
  const safePool = pantry.filter((g) => !bannedNames.has(g.name.toLowerCase()));
  if (safePool.length === 0) return [];

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

  for (let i = 0; i < MAX_ITEMS && remainCal > 50; i++) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let j = 0; j < safePool.length; j++) {
      if (used.has(j)) continue;
      const g = safePool[j];

      // Medical constraint check
      if (totalSodium + (g.sodium || 0) > maxSodium) continue;
      if (totalSugar + (g.sugar || 0) > maxSugar) continue;

      // Score = weighted distance to remaining targets (lower = better)
      const calGap = Math.abs(remainCal - g.calories);
      const protGap = Math.max(0, remainProt - g.protein) * 2;
      const pantryBonus = g.inPantry ? 0 : (constraints.strictness ? 5000 : 50);

      // Freshness bonus: prioritize items expiring soon
      let expiryBonus = 0;
      if (g.expiry) {
        const daysLeft = (new Date(g.expiry).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24);
        if (daysLeft > 0 && daysLeft <= 2) expiryBonus = -500; // Encourage use-soon
        if (daysLeft < 0) continue; // Skip expired
      }

      // Feedback penalty
      let fbPenalty = 0;
      const pastRating = recentFeedback.find((f: any) => f.item === g.name);
      if (pastRating && pastRating.score < 3) fbPenalty = 500;

      const score = calGap + protGap + pantryBonus + expiryBonus + fbPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx < 0) break;
    const pick = safePool[bestIdx];
    selected.push(pick);
    used.add(bestIdx);
    remainCal -= pick.calories;
    remainProt -= pick.protein;
    totalSodium += pick.sodium || 0;
    totalSugar += pick.sugar || 0;
  }

  return selected;
}

const pantryPool = DEFAULT_FALLBACK_FOODS.map((f) => ({
  ...f,
  inPantry: false,
  decay_coefficient: 0.05,
}));

const result = runTSOptimization(
  { calorie_target: 2000, metabolic_state_json: { protein_target: 150 } },
  { strictness: true },
  pantryPool,
  [],
  []
);

console.log("TS Optimization test result:", result.map(r => r.name));
