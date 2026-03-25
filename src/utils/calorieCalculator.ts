// Simple calorie calculation for the diary.
// The recipe-manager's version handles unit conversions (cups → grams, tbsp, etc.)
// which is recipe-specific. In the diary, the user always enters grams directly,
// so we only need the core math.

export function calcPortionCalories(portionGrams: number, caloriesPer100g: number): number {
  return Math.round((portionGrams / 100) * caloriesPer100g);
}
