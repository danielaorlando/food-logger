// Barcode lookup — checks our Firestore foods collection.

import { lookupFoodByBarcode } from "./foodsDb";

export interface BarcodeResult {
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  source: "custom";
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult | null> {
  if (!barcode.trim()) return null;

  const customFood = await lookupFoodByBarcode(barcode.trim());
  if (!customFood) return null;

  return {
    name: customFood.name,
    caloriesPer100g: customFood.caloriesPer100g,
    proteinPer100g: customFood.proteinPer100g,
    fatPer100g: customFood.fatPer100g,
    carbsPer100g: customFood.carbsPer100g,
    source: "custom",
  };
}
