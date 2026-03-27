// Searches multiple nutrition data sources in parallel and merges results.
// Sources (in priority order):
//   1. User-submitted foods (Firestore) — highest priority
//   2. USDA FoodData Central — great for raw ingredients

import { searchCustomFoods } from "./foodsDb";

export interface NutritionResult {
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  source: "custom" | "usda";
}

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_KEY = import.meta.env.VITE_USDA_API_KEY as string | undefined;

// USDA nutrient IDs — newer Foundation foods use 2048/2047 instead of 1008 for energy
const ENERGY_IDS = [1008, 2048, 2047];
const NUTRIENT_PROTEIN = 1003;
const NUTRIENT_FAT = 1004;
const NUTRIENT_CARBS = 1005;

interface USDAFood {
  description: string;
  dataType?: string;
  foodNutrients?: Array<{ nutrientId: number; value: number }>;
}

function getNutrient(food: USDAFood, nutrientId: number): number | undefined {
  const n = food.foodNutrients?.find((n) => n.nutrientId === nutrientId);
  return n?.value != null && typeof n.value === "number" ? n.value : undefined;
}

// Clean up USDA names: "Chicken, breast, boneless, raw" → "Chicken breast, boneless, raw"
function cleanName(description: string): string {
  // Title case: "CHICKEN BREAST" → "Chicken breast"
  let name = description
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  // If all-caps, convert to sentence case
  if (name === name.toUpperCase()) {
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  // Merge first two comma segments if the second is a cut/part
  // "Chicken, breast, raw" → "Chicken breast, raw"
  const parts = name.split(", ");
  if (parts.length >= 2) {
    const second = parts[1].toLowerCase();
    const bodyParts = ["breast", "thigh", "leg", "wing", "loin", "rib", "chop", "steak", "fillet", "whole"];
    if (bodyParts.some((bp) => second.startsWith(bp))) {
      parts[0] = `${parts[0]} ${parts[1]}`;
      parts.splice(1, 1);
    }
  }

  return parts.join(", ");
}

async function fetchUSDA(query: string, dataType: string): Promise<USDAFood[]> {
  if (!USDA_KEY) return [];

  const params = new URLSearchParams({
    query,
    api_key: USDA_KEY,
    dataType,
    pageSize: "8",
    pageNumber: "1",
  });

  const response = await fetch(`${USDA_BASE}?${params}`);
  if (!response.ok) return [];

  const data = await response.json();
  return (data?.foods ?? []) as USDAFood[];
}

function getEnergy(food: USDAFood): number | undefined {
  for (const id of ENERGY_IDS) {
    const val = getNutrient(food, id);
    if (val) return val;
  }
  return undefined;
}

function mapUSDAFoods(foods: USDAFood[]): NutritionResult[] {
  const results: NutritionResult[] = [];
  for (const food of foods) {
    const kcal = getEnergy(food);
    if (!kcal) continue;
    results.push({
      name: cleanName(food.description),
      caloriesPer100g: Math.round(kcal),
      proteinPer100g: getNutrient(food, NUTRIENT_PROTEIN),
      fatPer100g: getNutrient(food, NUTRIENT_FAT),
      carbsPer100g: getNutrient(food, NUTRIENT_CARBS),
      source: "usda",
    });
  }
  return results;
}

async function searchUSDA(query: string): Promise<NutritionResult[]> {
  if (!USDA_KEY) return [];

  // Query Foundation and SR Legacy separately so Foundation always appears first
  const [foundationFoods, srLegacyFoods] = await Promise.all([
    fetchUSDA(query, "Foundation"),
    fetchUSDA(query, "SR Legacy"),
  ]);

  const foundation = mapUSDAFoods(foundationFoods);
  const srLegacy = mapUSDAFoods(srLegacyFoods);
  const all = [...foundation, ...srLegacy];

  // Deduplicate by simplified name (keep first = Foundation priority)
  const seen = new Set<string>();
  const deduped: NutritionResult[] = [];
  for (const item of all) {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.slice(0, 5);
}

export async function searchIngredient(query: string): Promise<NutritionResult[]> {
  if (!query || query.trim().length < 2) return [];

  const [customResult, usdaResult] = await Promise.allSettled([
    searchCustomFoods(query).then((foods) =>
      foods.map((f) => ({
        name: f.name,
        caloriesPer100g: f.caloriesPer100g,
        proteinPer100g: f.proteinPer100g,
        fatPer100g: f.fatPer100g,
        carbsPer100g: f.carbsPer100g,
        source: "custom" as const,
      }))
    ),
    searchUSDA(query),
  ]);

  const custom = customResult.status === "fulfilled" ? customResult.value : [];
  const usda = usdaResult.status === "fulfilled" ? usdaResult.value : [];

  const all = [...custom, ...usda];

  const seen = new Set<string>();
  return all
    .filter((r) => {
      const key = r.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
