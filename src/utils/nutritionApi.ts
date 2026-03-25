// Searches the Firestore custom foods database for nutrition data.

import { searchCustomFoods } from "./foodsDb";

export interface NutritionResult {
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  source: "custom";
}

export async function searchIngredient(query: string): Promise<NutritionResult[]> {
  if (!query || query.trim().length < 2) return [];

  const foods = await searchCustomFoods(query);
  return foods.map((f) => ({
    name: f.name,
    caloriesPer100g: f.caloriesPer100g,
    proteinPer100g: f.proteinPer100g,
    fatPer100g: f.fatPer100g,
    carbsPer100g: f.carbsPer100g,
    source: "custom" as const,
  }));
}
