// DIARY CONCEPT:
// A "meal log" is a single food entry for a specific day and meal time.
// Each entry stores the food name, how many grams were eaten, and the total calories.
// We copy nutrition values at log time so historical entries stay accurate
// even if the food data changes later.

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealLogEntry {
  id: string;
  userId: string;
  // "2026-03-23" — stored as a string (not a Timestamp) so day-scoped queries
  // are simple and timezone-safe. We produce this in the browser from new Date().
  dateKey: string;
  loggedAt: Date;
  meal: MealType;

  // What was eaten — values copied at log time, not looked up live
  foodId?: string;          // Firestore doc ID from "foods" collection (if from DB)
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;

  // Portion
  portionGrams: number;
  // Pre-computed: Math.round((portionGrams / 100) * caloriesPer100g)
  // Stored so the diary can sum calories without re-doing math on every render.
  totalCalories: number;
}

export interface AddMealLogPayload {
  userId: string;
  dateKey: string;
  meal: MealType;
  foodId?: string;
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  portionGrams: number;
  totalCalories: number;
}
