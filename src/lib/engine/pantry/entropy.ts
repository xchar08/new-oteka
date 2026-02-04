export interface PantryItem {
  id: string;
  food_id: string;
  name: string; // fallback if food_id is null
  category: "dairy" | "rice" | "produce" | "meat" | "other";
  probability_score: number;
  last_verified_at: string; // ISO date
}

const DECAY_RATES: Record<string, number> = {
  dairy: 0.15,
  rice: 0.001,
  produce: 0.10,
  meat: 0.20,
  other: 0.05,
};

export function calculateEntropy(
  item: PantryItem,
  daysElapsed: number,
): number {
  const k = DECAY_RATES[item.category] || DECAY_RATES["other"];
  // Pnew = Pold * (1 - k)^days
  // Assuming Pold was 1.0 at last_verified_at check
  // or we iteratively apply it. Simpler: P = (1 - k)^days

  const p = Math.pow(1 - k, daysElapsed);
  return Math.max(0, p);
}

export function isGhost(probability: number): boolean {
  return probability < 0.3;
}

export function applyPantryEntropy(items: PantryItem[]): PantryItem[] {
  const now = new Date();

  return items.map((item) => {
    const lastVerify = new Date(item.last_verified_at);
    const diffTime = Math.abs(now.getTime() - lastVerify.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const newScore = calculateEntropy(item, diffDays);

    return {
      ...item,
      probability_score: newScore,
    };
  });
}
