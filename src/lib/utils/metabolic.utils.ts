import type {
  LogEntry,
  LogMetadata,
  NutrientEntry,
  ScanResult,
} from "../types/metabolic";

/**
 * Centrailized Metadata Extractor
 * Safely resolves both modern (flattened) and legacy (wrapped in .macros) data.
 */
export function extractLogStats(log: LogEntry) {
  const meta = (log.metabolic_tags_json || {}) as LogMetadata & {
    macros?: any;
    food_name?: string;
    feedback?: any;
    status?: string;
  };
  const rawMacros = meta.macros || meta;

  // Identify planned items (e.g. from Menu Scanner) where weight is yet to be determined
  const isPlanned = meta.status === 'planned' || log.grams === 0;

  return {
    name: meta.food_name || meta.item || "Unknown Food",
    calories: Number(rawMacros.calories || 0),
    protein: Number(rawMacros.protein || 0),
    carbs: Number(rawMacros.carbs || 0),
    fat: Number(rawMacros.fats || rawMacros.fat || 0),
    fiber: Number(rawMacros.fiber || 0),
    sugar: Number(rawMacros.sugar || 0),
    sodium: Number(rawMacros.sodium || 0),
    cholesterol: Number(rawMacros.cholesterol || 0),
    vitamins: meta.vitamins || [],
    minerals: meta.minerals || [],
    micros: meta.micros || [],
    ingredients: meta.ingredients || [],
    feedback: meta.feedback,
    imagePath: meta.image_path || log.image_url, // image_url is the resolved signed URL
    capturedAt: log.captured_at,
    isPlanned,
  };
}

/**
 * Utility to build log metadata from a vision scan result.
 */
export function buildLogMetadata(scan: ScanResult): LogMetadata {
  return {
    item: scan.items?.[0]?.name || "Unknown Food",
    calories: scan.macros?.calories || 0,
    protein: scan.macros?.protein || 0,
    carbs: scan.macros?.carbs || 0,
    fat: scan.macros?.fat || 0,
    fiber: scan.macros?.fiber || 0,
    sugar: scan.macros?.sugar || 0,
    sodium: scan.macros?.sodium || 0,
    cholesterol: scan.macros?.cholesterol || 0,
    vitamins: scan.vitamins || [],
    minerals: scan.minerals || [],
    micros: scan.micros || [],
    ingredients: (scan.ingredients || []).map((ing) =>
      typeof ing === "string" ? ing : ing.name || ""
    ),
    reasoning: scan.reasoning_trace,
    metabolic_insight: scan.metabolic_insight?.layman_explanation || "",
    image_path: scan.imagePath || null,
  };
}

/**
 * Unit normalization map to convert everything to a base unit.
 * Base units:
 * - weight: mg (minerals/vitamins)
 * - macros: g
 */
const UNIT_CONVERSION: Record<string, number> = {
  "g": 1000,
  "mg": 1,
  "mcg": 0.001,
  "µg": 0.001,
  "ug": 0.001,
  "iu": 1, // Simplified for general tracking
  "%": 1,
  "": 1,
};

/**
 * Parses a nutrient amount string like "2.5mg" or "100mcg" into normalized value (in mg) and unit.
 */
export function parseNutrientAmount(
  amountStr: string,
): { value: number; unit: string; normalized: number } {
  const match = amountStr.match(/^([\d.]+)\s*([a-zA-Z%µ]*)$/);
  if (!match) return { value: 0, unit: "", normalized: 0 };

  const value = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase();
  const multiplier = UNIT_CONVERSION[unit] || 1;

  return {
    value,
    unit,
    normalized: value * multiplier,
  };
}

/**
 * Aggregates nutrient entries into a map for daily tracking.
 * Ensures consistent math across different units (e.g. 500mcg + 1mg = 1.5mg)
 */
export function aggregateNutrients(
  existing: Record<
    string,
    { amount: number; unit: string; daily_value_pct: number }
  >,
  newEntries: NutrientEntry[],
) {
  const result = { ...existing };

  newEntries.forEach((entry) => {
    const { normalized, unit: parsedUnit } = parseNutrientAmount(entry.amount);
    const name = entry.name;

    if (result[name]) {
      // Add to existing normalized amount
      result[name].amount += normalized;
      result[name].daily_value_pct += entry.daily_value_pct || 0;
    } else {
      result[name] = {
        amount: normalized,
        unit: "mg", // Standardize internal storage to mg
        daily_value_pct: entry.daily_value_pct || 0,
      };
    }
  });

  return result;
}
